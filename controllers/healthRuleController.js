/**
 * 健康规则管理控制器（迭代优化版）
 * 包含导入、更新、版本管理、模板关联等核心功能
 * 
 * 业务价值说明：
 * - 增量导入：提升操作安全性，避免误删现有规则
 * - 标准字典同步：确保指标权威性，减少手动录入错误
 * - 版本化管理：完整记录规则变更历史，支持回滚和审计
 */

const { sequelize } = require('../config/db');
const { success, error, validationError } = require('../utils/response');
const { recordLog, getLogs } = require('../utils/operateLog');

// 动态导入xlsx，避免缺少依赖时启动失败
let XLSX;
try {
  XLSX = require('xlsx');
} catch (err) {
  // 静默处理，在实际使用时再提示
  // console.warn('⚠️  xlsx未安装，Excel相关功能将不可用。请运行: npm install xlsx@0.18.x');
}

/**
 * 导入卫健委指标接口（优化版）
 * POST /api/health-rule/import
 * 
 * 优化点：
 * 1. 新增增量导入模式，避免误删现有规则
 * 2. 自动关联标准字典表，填充推荐阈值和来源
 * 3. 校验阈值是否在卫健委推荐范围内
 */
const importHealthRule = async (req, res) => {
  try {
    const { 
      importMode = 'increment', // full-全量覆盖，increment-增量更新
      rules = [], // 规则数组
      versionDesc = '' // 版本说明
    } = req.body;
    const adminId = req.admin?.id; // 从token中获取管理员ID

    if (!rules || rules.length === 0) {
      return validationError(res, '规则数据不能为空');
    }

    const transaction = await sequelize.transaction();
    const results = {
      success: [],
      failed: [],
      warnings: []
    };

    try {
      // 全量模式：先删除所有现有规则（需二次确认，这里仅做标记）
      if (importMode === 'full') {
        // 注意：实际删除需要管理员密码确认，这里仅做标记
        console.log('[全量导入] 将删除所有现有规则');
      }

      // 处理每条规则
      for (const ruleData of rules) {
        try {
          const {
            indicatorName,
            category,
            thresholdValue,
            thresholdUnit,
            authorityExplanation
          } = ruleData;

          if (!indicatorName || !thresholdValue) {
            results.failed.push({
              indicatorName: indicatorName || '未知',
              reason: '指标名称或阈值不能为空'
            });
            continue;
          }

          // 1. 查询标准字典，自动匹配推荐阈值
          let sourceDictId = null;
          let warning = null;
          
          try {
            const [dictResult] = await sequelize.query(
              `SELECT dict_id, recommend_threshold, source_url, source_desc 
               FROM health_standard_dict 
               WHERE indicator_name = :indicatorName AND status = 1
               LIMIT 1`,
              {
                replacements: { indicatorName },
                transaction
              }
            );

            const dict = dictResult[0];

            if (dict) {
              sourceDictId = dict.dict_id;
              
              // 2. 校验阈值是否在推荐范围内
              const recommendRange = dict.recommend_threshold;
              if (recommendRange && !isThresholdInRange(thresholdValue, recommendRange)) {
                warning = {
                  indicatorName,
                  message: `阈值 ${thresholdValue} 超出卫健委推荐范围 ${recommendRange}`,
                  recommendValue: recommendRange
                };
                results.warnings.push(warning);
              }
            } else {
              warning = {
                indicatorName,
                message: '未找到对应的标准字典，将使用自定义阈值'
              };
              results.warnings.push(warning);
            }
          } catch (dictErr) {
            // 字典表不存在时忽略
            console.warn('标准字典表不存在或查询失败：', dictErr.message);
          }

          // 3. 增量模式：检查是否已存在
          let ruleId = null;
          if (importMode === 'increment') {
            const [existing] = await sequelize.query(
              `SELECT rule_id FROM health_rule WHERE indicator_name = :indicatorName LIMIT 1`,
              {
                replacements: { indicatorName },
                transaction
              }
            );

            if (existing.length > 0) {
              // 更新现有规则
              ruleId = existing[0].rule_id;
              await sequelize.query(
                `UPDATE health_rule 
                 SET category = :category,
                     source_dict_id = :sourceDictId,
                     threshold_value = :thresholdValue,
                     threshold_unit = :thresholdUnit,
                     authority_explanation = :authorityExplanation,
                     updated_at = NOW()
                 WHERE rule_id = :ruleId`,
                {
                  replacements: {
                    category,
                    sourceDictId,
                    thresholdValue,
                    thresholdUnit,
                    authorityExplanation,
                    ruleId
                  },
                  transaction
                }
              );
            }
          }

          // 4. 创建新规则（如果不存在）
          if (!ruleId) {
            const [insertResult] = await sequelize.query(
              `INSERT INTO health_rule 
               (rule_name, indicator_name, category, source_dict_id, threshold_value, threshold_unit, 
                authority_explanation, effect_way, status, created_by, created_at, updated_at)
               VALUES (:ruleName, :indicatorName, :category, :sourceDictId, :thresholdValue, 
                       :thresholdUnit, :authorityExplanation, 1, 1, :createdBy, NOW(), NOW())`,
              {
                replacements: {
                  ruleName: indicatorName,
                  indicatorName,
                  category: category || '其他',
                  sourceDictId,
                  thresholdValue,
                  thresholdUnit,
                  authorityExplanation,
                  createdBy: adminId
                },
                transaction
              }
            );
            ruleId = insertResult.insertId;
          }

          // 5. 创建版本记录
          const versionNumber = await generateVersionNumber(ruleId, transaction);
          await sequelize.query(
            `INSERT INTO rule_version 
             (rule_id, version_number, threshold_value, threshold_unit, authority_explanation, 
              effect_status, effect_time, created_by, created_at, updated_at)
             VALUES (:ruleId, :versionNumber, :thresholdValue, :thresholdUnit, 
                     :authorityExplanation, 1, NOW(), :createdBy, NOW(), NOW())`,
            {
              replacements: {
                ruleId,
                versionNumber,
                thresholdValue,
                thresholdUnit,
                authorityExplanation,
                createdBy: adminId
              },
              transaction
            }
          );

          results.success.push({
            ruleId,
            indicatorName,
            warning
          });

        } catch (err) {
          results.failed.push({
            indicatorName: ruleData.indicatorName || '未知',
            reason: err.message
          });
        }
      }

      await transaction.commit();

      // 在事务提交后记录操作日志
      await recordLog({
        adminId,
        operateType: 'import',
        operateContent: `导入健康规则（模式：${importMode}，成功：${results.success.length}，失败：${results.failed.length}）`,
        changeDetail: {
          importMode,
          versionDesc,
          total: rules.length,
          success: results.success.length,
          failed: results.failed.length,
          warnings: results.warnings.length,
          details: {
            success: results.success,
            failed: results.failed,
            warnings: results.warnings
          }
        },
        operateResult: results.failed.length === 0
      });

      return success(res, {
        importMode,
        total: rules.length,
        success: results.success.length,
        failed: results.failed.length,
        warnings: results.warnings.length,
        details: {
          success: results.success,
          failed: results.failed,
          warnings: results.warnings
        }
      }, `导入完成：成功 ${results.success.length} 条，失败 ${results.failed.length} 条`);

    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (err) {
    console.error('导入健康规则错误：', err);
    return error(res, '导入失败', 500, err.message);
  }
};

/**
 * 校验阈值是否在推荐范围内
 */
const isThresholdInRange = (threshold, range) => {
  // 简单实现：支持 "2000-3000" 格式
  const match = range.match(/(\d+)-(\d+)/);
  if (!match) return true; // 无法解析范围，默认通过

  const min = parseInt(match[1]);
  const max = parseInt(match[2]);
  const value = parseInt(threshold);

  return value >= min && value <= max;
};

/**
 * 生成版本号
 */
const generateVersionNumber = async (ruleId, transaction) => {
  try {
    // 检查表是否存在
    try {
      await sequelize.query('SELECT 1 FROM rule_version LIMIT 1', { transaction });
    } catch (tableErr) {
      if (tableErr.code === 'ER_NO_SUCH_TABLE') {
        return 'V1.0'; // 表不存在时返回默认版本号
      }
      throw tableErr;
    }
    
    const [versions] = await sequelize.query(
      `SELECT version_number FROM rule_version 
       WHERE rule_id = :ruleId 
       ORDER BY created_at DESC LIMIT 1`,
      {
        replacements: { ruleId },
        transaction
      }
    );

    if (versions.length === 0) {
      return 'V1.0';
    }

    const lastVersion = versions[0].version_number;
    const match = lastVersion.match(/V(\d+)\.(\d+)/);
    if (!match) return 'V1.0';

    const major = parseInt(match[1]);
    const minor = parseInt(match[2]);
    return `V${major}.${minor + 1}`;
  } catch (err) {
    // 表不存在时返回默认版本号
    if (err.code === 'ER_NO_SUCH_TABLE') {
      return 'V1.0';
    }
    console.warn('生成版本号失败：', err.message);
    return 'V1.0';
  }
};

/**
 * 修改规则阈值/解释接口（优化版）
 * PUT /api/health-rule/update
 * 
 * 优化点：
 * 1. 新增规则复制功能
 * 2. 强化生效逻辑，支持自定义定时生效时间
 * 3. 自动更新版本状态
 */
const updateHealthRule = async (req, res) => {
  try {
    const {
      ruleId,
      copyFromRuleId, // 复制来源规则ID
      ruleName,
      indicatorName,
      category,
      thresholdValue,
      thresholdUnit,
      authorityExplanation,
      effectWay = 1, // 1-即时生效，2-定时生效
      effectTime = null, // 定时生效时间
      status // 状态：1-启用，0-禁用
    } = req.body;
    const adminId = req.admin?.id;

    // 如果是更新现有规则且只更新状态，不需要验证指标名称和阈值
    // 如果禁用规则（status=0），需要将生效方式改为停止生效（effectWay=3）
    if (ruleId && status !== undefined && indicatorName === undefined && thresholdValue === undefined) {
      // 只更新状态，如果禁用则同时更新生效方式
      if (status === 0 && effectWay === undefined) {
        effectWay = 3; // 停止生效
      } else if (status === 1 && effectWay === undefined) {
        // 如果启用规则，检查当前生效方式，如果是停止生效则恢复为即时生效
        // 这里不自动修改，由前端决定
      }
    } else if (!ruleId && (!indicatorName || !thresholdValue)) {
      // 新增规则时，必须提供指标名称和阈值
      return validationError(res, '指标名称和阈值不能为空');
    }

    const transaction = await sequelize.transaction();

    try {
      let targetRuleId = ruleId;
      const changeDetail = {};

      // 规则复制功能
      if (copyFromRuleId && !ruleId) {
        const [sourceRule] = await sequelize.query(
          `SELECT * FROM health_rule WHERE rule_id = :copyFromRuleId LIMIT 1`,
          {
            replacements: { copyFromRuleId },
            transaction
          }
        );

        if (sourceRule.length === 0) {
          return error(res, '源规则不存在', 404);
        }

        const source = sourceRule[0];
        const [insertResult] = await sequelize.query(
          `INSERT INTO health_rule 
           (rule_name, indicator_name, category, source_dict_id, threshold_value, threshold_unit,
            authority_explanation, effect_way, effect_time, status, created_by, created_at, updated_at)
           VALUES (:ruleName, :indicatorName, :category, :sourceDictId, :thresholdValue, :thresholdUnit,
                   :authorityExplanation, :effectWay, :effectTime, 1, :createdBy, NOW(), NOW())`,
          {
            replacements: {
              ruleName: ruleName || source.rule_name,
              indicatorName: indicatorName || source.indicator_name,
              category: category || source.category,
              sourceDictId: source.source_dict_id,
              thresholdValue: thresholdValue || source.threshold_value,
              thresholdUnit: thresholdUnit || source.threshold_unit,
              authorityExplanation: authorityExplanation || source.authority_explanation,
              effectWay: effectWay || source.effect_way,
              effectTime: effectTime || source.effect_time,
              createdBy: adminId
            },
            transaction
          }
        );
        targetRuleId = insertResult.insertId;
        changeDetail.copiedFrom = copyFromRuleId;
        
        // 复制规则时创建版本记录
        const copiedThresholdValue = thresholdValue || source.threshold_value;
        if (copiedThresholdValue) {
          try {
            const versionNumber = await generateVersionNumber(targetRuleId, transaction);
            const copiedEffectWay = effectWay || source.effect_way;
            const effectStatus = copiedEffectWay === 1 ? 1 : 0;
            
            await sequelize.query(
              `INSERT INTO rule_version 
               (rule_id, version_number, threshold_value, threshold_unit, authority_explanation,
                effect_status, effect_time, created_by, created_at, updated_at)
               VALUES (:ruleId, :versionNumber, :thresholdValue, :thresholdUnit, :authorityExplanation,
                       :effectStatus, :effectTime, :createdBy, NOW(), NOW())`,
              {
                replacements: {
                  ruleId: targetRuleId,
                  versionNumber,
                  thresholdValue: copiedThresholdValue,
                  thresholdUnit: thresholdUnit || source.threshold_unit || null,
                  authorityExplanation: authorityExplanation || source.authority_explanation || null,
                  effectStatus,
                  effectTime: effectTime || source.effect_time || (copiedEffectWay === 1 ? new Date() : null),
                  createdBy: adminId
                },
                transaction
              }
            );
          } catch (versionErr) {
            // 版本表不存在或创建失败时，静默处理，不阻止规则复制
            if (versionErr.code === 'ER_NO_SUCH_TABLE') {
              console.warn('版本表不存在，跳过版本创建');
            } else {
              console.warn('创建版本失败，跳过版本创建：', versionErr.message);
            }
          }
        }
      } else if (ruleId) {
        // 更新现有规则
        const updateFields = [];
        const replacements = { ruleId };

        if (ruleName !== undefined) {
          updateFields.push('rule_name = :ruleName');
          replacements.ruleName = ruleName;
          changeDetail.ruleName = ruleName;
        }
        if (thresholdValue !== undefined) {
          updateFields.push('threshold_value = :thresholdValue');
          replacements.thresholdValue = thresholdValue;
          changeDetail.thresholdValue = thresholdValue;
        }
        if (thresholdUnit !== undefined) {
          updateFields.push('threshold_unit = :thresholdUnit');
          replacements.thresholdUnit = thresholdUnit;
        }
        if (authorityExplanation !== undefined) {
          updateFields.push('authority_explanation = :authorityExplanation');
          replacements.authorityExplanation = authorityExplanation;
        }
        if (effectWay !== undefined) {
          updateFields.push('effect_way = :effectWay');
          replacements.effectWay = effectWay;
          changeDetail.effectWay = effectWay;
        }
        if (effectTime !== undefined) {
          updateFields.push('effect_time = :effectTime');
          replacements.effectTime = effectTime;
          changeDetail.effectTime = effectTime;
        }
        if (status !== undefined) {
          updateFields.push('status = :status');
          replacements.status = status;
          changeDetail.status = status;
        }

        if (updateFields.length > 0) {
          updateFields.push('updated_at = NOW()');
          await sequelize.query(
            `UPDATE health_rule SET ${updateFields.join(', ')} WHERE rule_id = :ruleId`,
            { replacements, transaction }
          );
        } else {
          // 如果没有要更新的字段，至少更新时间戳
          await sequelize.query(
            `UPDATE health_rule SET updated_at = NOW() WHERE rule_id = :ruleId`,
            { replacements: { ruleId }, transaction }
          );
        }
        
        // 如果只是更新状态，不需要创建新版本
        // 只有在更新阈值、单位、解释等字段时才创建新版本
        if (status === undefined && (thresholdValue !== undefined || thresholdUnit !== undefined || authorityExplanation !== undefined)) {
          // 创建新版本（如果表存在）
          // 需要从现有规则获取完整的阈值信息，因为threshold_value不能为null
          try {
            const [currentRule] = await sequelize.query(
              `SELECT threshold_value, threshold_unit, authority_explanation, effect_way 
               FROM health_rule WHERE rule_id = :ruleId LIMIT 1`,
              { replacements: { ruleId }, transaction }
            );
            
            if (currentRule.length > 0) {
              const rule = currentRule[0];
              // 使用更新的值，如果没有更新则使用现有值
              const finalThresholdValue = thresholdValue !== undefined ? thresholdValue : rule.threshold_value;
              const finalThresholdUnit = thresholdUnit !== undefined ? thresholdUnit : rule.threshold_unit;
              const finalAuthorityExplanation = authorityExplanation !== undefined ? authorityExplanation : rule.authority_explanation;
              const finalEffectWay = effectWay !== undefined ? effectWay : rule.effect_way;
              
              // 确保threshold_value不为null
              if (!finalThresholdValue || finalThresholdValue === null || finalThresholdValue === '') {
                console.warn('规则阈值为空，跳过版本创建');
                // 不创建版本，但不阻止规则更新
              } else {
                let versionNumber = await generateVersionNumber(ruleId, transaction);
                let effectStatus = finalEffectWay === 1 ? 1 : 0;
                
                await sequelize.query(
                  `INSERT INTO rule_version 
                   (rule_id, version_number, threshold_value, threshold_unit, authority_explanation,
                    effect_status, effect_time, created_by, created_at, updated_at)
                   VALUES (:ruleId, :versionNumber, :thresholdValue, :thresholdUnit, :authorityExplanation,
                           :effectStatus, :effectTime, :createdBy, NOW(), NOW())`,
                  {
                    replacements: {
                      ruleId,
                      versionNumber,
                      thresholdValue: finalThresholdValue,
                      thresholdUnit: finalThresholdUnit || null,
                      authorityExplanation: finalAuthorityExplanation || null,
                      effectStatus,
                      effectTime: effectTime || (finalEffectWay === 1 ? new Date() : null),
                      createdBy: adminId
                    },
                    transaction
                  }
                );
              }
            }
          } catch (versionErr) {
            // 版本表不存在时，静默处理，不阻止规则更新
            if (versionErr.code === 'ER_NO_SUCH_TABLE') {
              // 版本表不存在，忽略
            } else if (versionErr.message && versionErr.message.includes('阈值不能为空')) {
              // 阈值为空时，不创建版本，但不阻止规则更新
              console.warn('创建版本失败：阈值不能为空，跳过版本创建');
            } else {
              // 其他错误（如threshold_value不能为null）时，不抛出错误，只记录警告
              // 避免因版本创建失败导致整个更新操作失败
              console.warn('创建版本时发生错误，跳过版本创建：', versionErr.message);
              // 不抛出错误，允许规则更新继续
            }
          }
        }
      } else {
        // 新增规则（既没有ruleId也没有copyFromRuleId）
        // 查询标准字典，自动匹配推荐阈值
        let sourceDictId = null;
        try {
          const [dictResult] = await sequelize.query(
            `SELECT dict_id FROM health_standard_dict 
             WHERE indicator_name = :indicatorName AND status = 1 LIMIT 1`,
            {
              replacements: { indicatorName },
              transaction
            }
          );
          if (dictResult.length > 0) {
            sourceDictId = dictResult[0].dict_id;
          }
        } catch (err) {
          // 字典表不存在时忽略
        }

        const [insertResult] = await sequelize.query(
          `INSERT INTO health_rule 
           (rule_name, indicator_name, category, source_dict_id, threshold_value, threshold_unit,
            authority_explanation, effect_way, effect_time, status, created_by, created_at, updated_at)
           VALUES (:ruleName, :indicatorName, :category, :sourceDictId, :thresholdValue, :thresholdUnit,
                   :authorityExplanation, :effectWay, :effectTime, 1, :createdBy, NOW(), NOW())`,
          {
            replacements: {
              ruleName: ruleName || indicatorName,
              indicatorName,
              category: category || '其他',
              sourceDictId,
              thresholdValue,
              thresholdUnit: thresholdUnit || null,
              authorityExplanation: authorityExplanation || null,
              effectWay: effectWay || 1,
              effectTime: effectTime || null,
              createdBy: adminId
            },
            transaction
          }
        );
        targetRuleId = insertResult.insertId;
        changeDetail.created = true;
        
        // 新增规则时创建版本记录
        if (thresholdValue) {
          try {
            const versionNumber = await generateVersionNumber(targetRuleId, transaction);
            const effectStatus = effectWay === 1 ? 1 : 0;
            
            await sequelize.query(
              `INSERT INTO rule_version 
               (rule_id, version_number, threshold_value, threshold_unit, authority_explanation,
                effect_status, effect_time, created_by, created_at, updated_at)
               VALUES (:ruleId, :versionNumber, :thresholdValue, :thresholdUnit, :authorityExplanation,
                       :effectStatus, :effectTime, :createdBy, NOW(), NOW())`,
              {
                replacements: {
                  ruleId: targetRuleId,
                  versionNumber,
                  thresholdValue: thresholdValue,
                  thresholdUnit: thresholdUnit || null,
                  authorityExplanation: authorityExplanation || null,
                  effectStatus,
                  effectTime: effectTime || (effectWay === 1 ? new Date() : null),
                  createdBy: adminId
                },
                transaction
              }
            );
          } catch (versionErr) {
            // 版本表不存在或创建失败时，静默处理，不阻止规则创建
            if (versionErr.code === 'ER_NO_SUCH_TABLE') {
              console.warn('版本表不存在，跳过版本创建');
            } else {
              console.warn('创建版本失败，跳过版本创建：', versionErr.message);
            }
          }
        }
      }

      await transaction.commit();

      // 在事务提交后记录操作日志
      await recordLog({
        adminId,
        operateType: 'update',
        ruleId: targetRuleId,
        operateContent: copyFromRuleId ? `复制规则 ${copyFromRuleId}` : (ruleId ? `更新规则 ${targetRuleId}` : `新增规则 ${targetRuleId}`),
        changeDetail,
        operateResult: true
      });

      // 获取版本号（如果有）
      let versionNumber = null;
      try {
        const [versions] = await sequelize.query(
          `SELECT version_number FROM rule_version 
           WHERE rule_id = :ruleId 
           ORDER BY created_at DESC LIMIT 1`,
          { replacements: { ruleId: targetRuleId } }
        );
        if (versions.length > 0) {
          versionNumber = versions[0].version_number;
        }
      } catch (err) {
        // 版本表不存在时忽略
      }

      return success(res, {
        ruleId: targetRuleId,
        versionNumber: versionNumber || 'V1.0',
        effectStatus: effectWay === 1 ? 1 : 0
      }, copyFromRuleId ? '规则复制成功' : (ruleId ? '规则更新成功' : '规则新增成功'));

    } catch (err) {
      await transaction.rollback();
      console.error('更新健康规则事务错误：', err);
      throw err;
    }
  } catch (err) {
    console.error('更新健康规则错误：', err);
    // 提供更详细的错误信息
    let errorMessage = '更新失败';
    if (err.code === 'ER_NO_SUCH_TABLE') {
      errorMessage = '数据库表不存在，请先执行数据库迁移';
    } else if (err.message) {
      errorMessage = err.message;
    }
    return error(res, errorMessage, 500, err.message);
  }
};

/**
 * 获取健康规则列表接口（新增）
 * GET /api/health-rule/list
 */
const getHealthRuleList = async (req, res) => {
  try {
    const {
      category = null,
      status = null,
      page = 1,
      limit = 10
    } = req.query;

    // 检查表是否存在
    try {
      await sequelize.query('SELECT 1 FROM health_rule LIMIT 1');
    } catch (tableErr) {
      if (tableErr.code === 'ER_NO_SUCH_TABLE') {
        return success(res, {
          list: [],
          total: 0,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: 0
        }, '获取成功（表不存在）');
      }
      throw tableErr;
    }

    let whereClause = '1=1';
    const replacements = {
      offset: (page - 1) * parseInt(limit),
      limit: parseInt(limit)
    };

    if (category) {
      whereClause += ' AND hr.category = :category';
      replacements.category = category;
    }
    
    if (status !== null && status !== undefined) {
      whereClause += ' AND hr.status = :status';
      replacements.status = parseInt(status);
    }

    // 查询规则列表（简化查询，避免子查询问题）
    let query = `
      SELECT 
        hr.rule_id,
        hr.rule_name,
        hr.indicator_name,
        hr.category,
        hr.threshold_value,
        hr.threshold_unit,
        hr.authority_explanation,
        hr.effect_way,
        hr.effect_time,
        hr.status,
        hr.created_at,
        hr.updated_at,
        hsd.source_url,
        hsd.source_desc,
        GROUP_CONCAT(DISTINCT CONCAT(rt.id, ':', rt.template_name) SEPARATOR '|') as templates
       FROM health_rule hr
       LEFT JOIN health_standard_dict hsd ON hr.source_dict_id = hsd.dict_id
       LEFT JOIN rule_template_binding rtb ON hr.rule_id = rtb.rule_id
       LEFT JOIN rule_templates rt ON rtb.template_id = rt.id
       WHERE ${whereClause}
       GROUP BY hr.rule_id, hr.rule_name, hr.indicator_name, hr.category, hr.threshold_value,
                hr.threshold_unit, hr.authority_explanation, hr.effect_way, hr.effect_time,
                hr.status, hr.created_at, hr.updated_at, hsd.source_url, hsd.source_desc
       ORDER BY hr.created_at DESC
       LIMIT :limit OFFSET :offset
    `;

    const [rules] = await sequelize.query(query, { replacements });

    // 查询总数
    const [countResult] = await sequelize.query(
      `SELECT COUNT(*) as total FROM health_rule hr WHERE ${whereClause}`,
      { replacements }
    );
    const total = countResult[0]?.total || 0;

    // 格式化数据
    const result = rules.map(rule => {
      // 解析关联的模板信息
      let templates = []
      if (rule.templates) {
        templates = rule.templates.split('|').map(t => {
          const [id, name] = t.split(':')
          return { id: parseInt(id), name }
        }).filter(t => t.id && t.name)
      }
      
      return {
        ruleId: rule.rule_id,
        ruleName: rule.rule_name,
        indicatorName: rule.indicator_name,
        category: rule.category,
        thresholdValue: rule.threshold_value,
        thresholdUnit: rule.threshold_unit,
        authorityExplanation: rule.authority_explanation,
        effectWay: rule.effect_way,
        effectTime: rule.effect_time,
        effectStatus: 1, // 默认已生效，后续可以通过管理接口控制
        status: rule.status,
        sourceUrl: rule.source_url,
        sourceDesc: rule.source_desc,
        templates: templates, // 关联的模板列表
        createdAt: rule.created_at,
        updatedAt: rule.updated_at
      }
    });

    return success(res, {
      list: result,
      total: parseInt(total),
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / limit)
    }, '获取成功');
  } catch (err) {
    console.error('获取健康规则列表错误：', err);
    return error(res, '获取失败', 500, err.message);
  }
};

/**
 * 版本回滚接口（优化版）
 * POST /api/health-rule/rollback
 * 
 * 优化点：
 * 1. 回滚后生成新版本，保留完整版本链
 * 2. 校验目标版本状态，已过期版本需重新选择生效方式
 */
const rollbackVersion = async (req, res) => {
  try {
    const { ruleId, targetVersionId } = req.body;
    const adminId = req.admin?.id;

    if (!ruleId || !targetVersionId) {
      return validationError(res, '规则ID和目标版本ID不能为空');
    }

    const transaction = await sequelize.transaction();

    try {
      // 1. 查询目标版本
      const [targetVersion] = await sequelize.query(
        `SELECT * FROM rule_version WHERE version_id = :targetVersionId AND rule_id = :ruleId LIMIT 1`,
        {
          replacements: { targetVersionId, ruleId },
          transaction
        }
      );

      if (targetVersion.length === 0) {
        return error(res, '目标版本不存在', 404);
      }

      const version = targetVersion[0];

      // 2. 校验版本状态
      if (version.effect_status === 2) {
        // 已过期版本，需要重新选择生效方式
        return error(res, '目标版本已过期，请重新选择生效方式', 400);
      }

      // 3. 生成新版本（回滚版本）
      const newVersionNumber = await generateVersionNumber(ruleId, transaction);
      
      await sequelize.query(
        `INSERT INTO rule_version 
         (rule_id, version_number, threshold_value, threshold_unit, authority_explanation,
          effect_status, effect_time, created_by, created_at, updated_at)
         VALUES (:ruleId, :versionNumber, :thresholdValue, :thresholdUnit, :authorityExplanation,
                 :effectStatus, :effectTime, :createdBy, NOW(), NOW())`,
        {
          replacements: {
            ruleId,
            versionNumber: newVersionNumber,
            thresholdValue: version.threshold_value,
            thresholdUnit: version.threshold_unit,
            authorityExplanation: version.authority_explanation,
            effectStatus: version.effect_status === 1 ? 1 : 0, // 如果原版本已生效，新版本也立即生效
            effectTime: version.effect_time,
            createdBy: adminId
          },
          transaction
        }
      );

      // 4. 更新规则当前值
      await sequelize.query(
        `UPDATE health_rule 
         SET threshold_value = :thresholdValue,
             threshold_unit = :thresholdUnit,
             authority_explanation = :authorityExplanation,
             updated_at = NOW()
         WHERE rule_id = :ruleId`,
        {
          replacements: {
            thresholdValue: version.threshold_value,
            thresholdUnit: version.threshold_unit,
            authorityExplanation: version.authority_explanation,
            ruleId
          },
          transaction
        }
      );

      await transaction.commit();

      // 在事务提交后记录操作日志
      await recordLog({
        adminId,
        operateType: 'rollback',
        ruleId,
        operateContent: `回滚规则 ${ruleId} 到版本 ${version.version_number}，生成新版本 ${newVersionNumber}`,
        changeDetail: {
          targetVersionId,
          targetVersionNumber: version.version_number,
          newVersionNumber,
          rollbackData: {
            thresholdValue: version.threshold_value,
            thresholdUnit: version.threshold_unit
          }
        },
        operateResult: true
      });

      return success(res, {
        ruleId,
        newVersionNumber,
        rollbackFrom: version.version_number
      }, `回滚成功，已生成新版本 ${newVersionNumber}`);

    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (err) {
    console.error('版本回滚错误：', err);
    return error(res, '回滚失败', 500, err.message);
  }
};

/**
 * 过期规则版本接口
 * POST /api/health-rule/expire-version
 * 请求体：{ ruleId, versionId }
 */
const expireVersion = async (req, res) => {
  try {
    const { ruleId, versionId } = req.body;
    const adminId = req.admin?.id;

    if (!ruleId || !versionId) {
      return validationError(res, '规则ID和版本ID不能为空');
    }

    const transaction = await sequelize.transaction();

    try {
      // 检查版本是否存在
      const [versions] = await sequelize.query(
        `SELECT * FROM rule_version 
         WHERE version_id = :versionId AND rule_id = :ruleId LIMIT 1`,
        {
          replacements: { versionId, ruleId },
          transaction
        }
      );

      if (versions.length === 0) {
        await transaction.rollback();
        return error(res, '版本不存在', 404);
      }

      const version = versions[0];

      // 只有生效状态的版本才能过期
      if (version.effect_status !== 1) {
        await transaction.rollback();
        return error(res, '只能过期生效状态的版本', 400);
      }

      // 更新版本状态为已过期
      await sequelize.query(
        `UPDATE rule_version 
         SET effect_status = 2, 
             expire_time = NOW(),
             updated_at = NOW()
         WHERE version_id = :versionId AND rule_id = :ruleId`,
        {
          replacements: { versionId, ruleId },
          transaction
        }
      );

      await transaction.commit();

      // 记录操作日志
      await recordLog({
        adminId,
        operateType: 'expire',
        ruleId,
        operateContent: `过期规则 ${ruleId} 的版本 ${version.version_number}`,
        changeDetail: {
          versionId,
          versionNumber: version.version_number,
          oldStatus: 1,
          newStatus: 2
        },
        operateResult: true
      });

      return success(res, {
        ruleId,
        versionId,
        versionNumber: version.version_number
      }, '版本已过期');

    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (err) {
    console.error('过期版本错误：', err);
    return error(res, '过期版本失败', 500, err.message);
  }
};

/**
 * 规则关联模板接口（优化版）
 * POST /api/health-rule/bind-template
 * 
 * 优化点：
 * 1. 支持批量关联和批量解除关联
 * 2. 返回详细的关联结果（成功数、失败数、失败原因）
 */
const bindTemplate = async (req, res) => {
  try {
    const {
      operateType = 'bind', // bind-关联，unbind-解除
      ruleIds = [], // 规则ID数组
      templateIds = [] // 模板ID数组
    } = req.body;

    if (!ruleIds.length || !templateIds.length) {
      return validationError(res, '规则ID和模板ID不能为空');
    }

    const transaction = await sequelize.transaction();
    const results = {
      success: [],
      failed: []
    };

    try {
      for (const ruleId of ruleIds) {
        for (const templateId of templateIds) {
          try {
            // 检查规则和模板是否存在且可用
            const [ruleCheck] = await sequelize.query(
              `SELECT rule_id, status FROM health_rule WHERE rule_id = :ruleId LIMIT 1`,
              {
                replacements: { ruleId },
                transaction
              }
            );

            const [templateCheck] = await sequelize.query(
              `SELECT id, status FROM rule_templates WHERE id = :templateId LIMIT 1`,
              {
                replacements: { templateId },
                transaction
              }
            );

            if (ruleCheck.length === 0) {
              results.failed.push({
                ruleId,
                templateId,
                reason: '规则不存在'
              });
              continue;
            }

            if (templateCheck.length === 0) {
              results.failed.push({
                ruleId,
                templateId,
                reason: '模板不存在'
              });
              continue;
            }

            if (ruleCheck[0].status === 0) {
              results.failed.push({
                ruleId,
                templateId,
                reason: '规则已禁用'
              });
              continue;
            }

            if (templateCheck[0].status === 0) {
              results.failed.push({
                ruleId,
                templateId,
                reason: '模板已禁用'
              });
              continue;
            }

            if (operateType === 'bind') {
              // 关联
              await sequelize.query(
                `INSERT INTO rule_template_binding (rule_id, template_id, created_at)
                 VALUES (:ruleId, :templateId, NOW())
                 ON DUPLICATE KEY UPDATE created_at = NOW()`,
                {
                  replacements: { ruleId, templateId },
                  transaction
                }
              );
            } else {
              // 解除关联
              await sequelize.query(
                `DELETE FROM rule_template_binding 
                 WHERE rule_id = :ruleId AND template_id = :templateId`,
                {
                  replacements: { ruleId, templateId },
                  transaction
                }
              );
            }

            results.success.push({ ruleId, templateId });

          } catch (err) {
            results.failed.push({
              ruleId,
              templateId,
              reason: err.message
            });
          }
        }
      }

      await transaction.commit();

      // 在事务提交后记录操作日志
      await recordLog({
        adminId: req.admin?.id,
        operateType: operateType === 'bind' ? 'bind' : 'unbind',
        operateContent: `${operateType === 'bind' ? '关联' : '解除关联'}规则和模板（成功：${results.success.length}，失败：${results.failed.length}）`,
        changeDetail: {
          operateType,
          ruleIds,
          templateIds,
          success: results.success.length,
          failed: results.failed.length
        },
        operateResult: results.failed.length === 0
      });

      return success(res, {
        operateType,
        total: ruleIds.length * templateIds.length,
        success: results.success.length,
        failed: results.failed.length,
        details: {
          success: results.success,
          failed: results.failed
        }
      }, `${operateType === 'bind' ? '关联' : '解除关联'}完成：成功 ${results.success.length} 条，失败 ${results.failed.length} 条`);

    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (err) {
    console.error('关联模板错误：', err);
    return error(res, '关联失败', 500, err.message);
  }
};

/**
 * 指标分类查询接口（新增）
 * GET /api/health-rule/category
 */
const getCategories = async (req, res) => {
  try {
    // 如果表不存在，返回空数组而不是错误
    let categories = [];
    try {
      const [result] = await sequelize.query(
        `SELECT DISTINCT category 
         FROM health_standard_dict 
         WHERE status = 1 AND category IS NOT NULL
         ORDER BY category`
      );
      categories = result || [];
    } catch (tableErr) {
      // 表不存在时，返回默认分类
      console.warn('health_standard_dict表不存在或未初始化，返回默认分类');
      categories = [
        { category: '饮水健康' },
        { category: '饮食健康' },
        { category: '运动健康' },
        { category: '睡眠健康' }
      ];
    }

    const result = categories.map(c => c.category || c);

    return success(res, result, '获取成功');
  } catch (err) {
    console.error('获取分类列表错误：', err);
    // 即使出错也返回默认分类，不阻塞前端
    return success(res, ['饮水健康', '饮食健康', '运动健康', '睡眠健康'], '获取成功（使用默认分类）');
  }
};

/**
 * 操作日志查询接口（新增）
 * GET /api/health-rule/operate-log
 */
const getOperateLogs = async (req, res) => {
  try {
    const {
      operateType,
      startDate,
      endDate,
      page = 1,
      limit = 10
    } = req.query;

    const result = await getLogs({
      operateType,
      startDate,
      endDate,
      page: parseInt(page),
      limit: parseInt(limit)
    });

    return success(res, result, '获取成功');
  } catch (err) {
    console.error('查询操作日志错误：', err);
    return error(res, '查询失败', 500, err.message);
  }
};

/**
 * 删除操作日志接口
 * DELETE /api/health-rule/operate-log/:logId
 */
const deleteOperateLog = async (req, res) => {
  try {
    const { logId } = req.params;
    const adminId = req.admin?.id;
    
    if (!logId) {
      return validationError(res, '日志ID不能为空');
    }

    // 验证logId是否为有效数字
    const parsedLogId = parseInt(logId);
    if (isNaN(parsedLogId) || parsedLogId <= 0) {
      return validationError(res, '日志ID无效');
    }

    // 检查日志是否存在
    try {
      const [logs] = await sequelize.query(
        `SELECT log_id FROM health_rule_operate_log WHERE log_id = :logId LIMIT 1`,
        { replacements: { logId: parsedLogId } }
      );

      if (logs.length === 0) {
        return error(res, '日志不存在', 404);
      }

      // 删除日志
      await sequelize.query(
        `DELETE FROM health_rule_operate_log WHERE log_id = :logId`,
        { replacements: { logId: parsedLogId } }
      );

      return success(res, null, '删除成功');
    } catch (tableErr) {
      if (tableErr.code === 'ER_NO_SUCH_TABLE') {
        return error(res, '日志表不存在', 404);
      }
      throw tableErr;
    }
  } catch (err) {
    console.error('删除操作日志错误：', err);
    return error(res, '删除失败', 500, err.message);
  }
};

/**
 * 批量删除操作日志接口
 * DELETE /api/health-rule/operate-log/batch-delete
 */
const batchDeleteOperateLog = async (req, res) => {
  try {
    const { logIds } = req.body;
    const adminId = req.admin?.id;
    
    if (!logIds || !Array.isArray(logIds) || logIds.length === 0) {
      return validationError(res, '日志ID数组不能为空');
    }

    const results = {
      success: [],
      failed: []
    };

    try {
      // 检查表是否存在
      await sequelize.query('SELECT 1 FROM health_rule_operate_log LIMIT 1');
    } catch (tableErr) {
      if (tableErr.code === 'ER_NO_SUCH_TABLE') {
        return error(res, '日志表不存在', 404);
      }
      throw tableErr;
    }

    for (const logId of logIds) {
      try {
        // 验证logId是否为有效数字
        const parsedLogId = parseInt(logId);
        if (isNaN(parsedLogId) || parsedLogId <= 0) {
          results.failed.push({
            logId: logId,
            reason: '日志ID无效'
          });
          continue;
        }
        
        // 检查日志是否存在
        const [logs] = await sequelize.query(
          `SELECT log_id FROM health_rule_operate_log WHERE log_id = :logId LIMIT 1`,
          { replacements: { logId: parsedLogId } }
        );

        if (logs.length === 0) {
          results.failed.push({
            logId: parsedLogId,
            reason: '日志不存在'
          });
          continue;
        }

        // 删除日志
        await sequelize.query(
          `DELETE FROM health_rule_operate_log WHERE log_id = :logId`,
          { replacements: { logId: parsedLogId } }
        );

        results.success.push({
          logId: parsedLogId
        });
      } catch (err) {
        results.failed.push({
          logId: logId,
          reason: err.message
        });
      }
    }

    return success(res, results, `批量删除完成：成功 ${results.success.length} 条，失败 ${results.failed.length} 条`);
  } catch (err) {
    console.error('批量删除操作日志错误：', err);
    return error(res, '批量删除失败', 500, err.message);
  }
};

/**
 * 标准字典同步接口（新增）
 * POST /api/health-rule/sync-dict
 */
const syncDict = async (req, res) => {
  try {
    const { dictData = [] } = req.body;
    const adminId = req.admin?.id;

    if (!dictData || dictData.length === 0) {
      return validationError(res, '字典数据不能为空');
    }

    const transaction = await sequelize.transaction();
    const results = {
      success: [],
      failed: []
    };

    try {
      for (const dict of dictData) {
        try {
          const {
            indicatorName,
            category,
            recommendThreshold,
            sourceUrl,
            sourceDesc,
            updateTime
          } = dict;

          if (!indicatorName || !recommendThreshold) {
            results.failed.push({
              indicatorName: indicatorName || '未知',
              reason: '指标名称或推荐阈值不能为空'
            });
            continue;
          }

          // 更新或插入
          await sequelize.query(
            `INSERT INTO health_standard_dict 
             (indicator_name, category, recommend_threshold, source_url, source_desc, update_time, status, updated_at)
             VALUES (:indicatorName, :category, :recommendThreshold, :sourceUrl, :sourceDesc, :updateTime, 1, NOW())
             ON DUPLICATE KEY UPDATE
             category = VALUES(category),
             recommend_threshold = VALUES(recommend_threshold),
             source_url = VALUES(source_url),
             source_desc = VALUES(source_desc),
             update_time = VALUES(update_time),
             updated_at = NOW()`,
            {
              replacements: {
                indicatorName,
                category: category || '其他',
                recommendThreshold,
                sourceUrl,
                sourceDesc,
                updateTime: updateTime || new Date()
              },
              transaction
            }
          );

          results.success.push({ indicatorName });

        } catch (err) {
          results.failed.push({
            indicatorName: dict.indicatorName || '未知',
            reason: err.message
          });
        }
      }

      await transaction.commit();

      // 在事务提交后记录操作日志
      await recordLog({
        adminId,
        operateType: 'sync-dict',
        operateContent: `同步标准字典（成功：${results.success.length}，失败：${results.failed.length}）`,
        changeDetail: {
          total: dictData.length,
          success: results.success.length,
          failed: results.failed.length
        },
        operateResult: results.failed.length === 0
      });

      return success(res, {
        total: dictData.length,
        success: results.success.length,
        failed: results.failed.length,
        details: {
          success: results.success,
          failed: results.failed
        }
      }, `同步完成：成功 ${results.success.length} 条，失败 ${results.failed.length} 条`);

    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (err) {
    console.error('同步标准字典错误：', err);
    return error(res, '同步失败', 500, err.message);
  }
};

/**
 * 获取规则详情接口
 * GET /api/health-rule/detail/:ruleId
 */
const getRuleDetail = async (req, res) => {
  try {
    const { ruleId } = req.params;
    
    if (!ruleId) {
      return validationError(res, '规则ID不能为空');
    }

    const [rules] = await sequelize.query(
      `SELECT 
        hr.rule_id,
        hr.rule_name,
        hr.indicator_name,
        hr.category,
        hr.threshold_value,
        hr.threshold_unit,
        hr.authority_explanation,
        hr.effect_way,
        hr.effect_time,
        hr.status,
        hr.source_dict_id,
        hsd.source_url,
        hsd.source_desc,
        hr.created_at,
        hr.updated_at
       FROM health_rule hr
       LEFT JOIN health_standard_dict hsd ON hr.source_dict_id = hsd.dict_id
       WHERE hr.rule_id = :ruleId
       LIMIT 1`,
      { replacements: { ruleId: parseInt(ruleId) } }
    );

    if (rules.length === 0) {
      return error(res, '规则不存在', 404);
    }

    const rule = rules[0];
    const result = {
      ruleId: rule.rule_id,
      ruleName: rule.rule_name,
      indicatorName: rule.indicator_name,
      category: rule.category,
      thresholdValue: rule.threshold_value,
      thresholdUnit: rule.threshold_unit,
      authorityExplanation: rule.authority_explanation,
      effectWay: rule.effect_way,
      effectTime: rule.effect_time,
      status: rule.status,
      sourceUrl: rule.source_url,
      sourceDesc: rule.source_desc,
      createdAt: rule.created_at,
      updatedAt: rule.updated_at
    };

    return success(res, result, '获取成功');
  } catch (err) {
    console.error('获取规则详情错误：', err);
    return error(res, '获取失败', 500, err.message);
  }
};

/**
 * 获取规则版本列表接口
 * GET /api/health-rule/versions/:ruleId
 */
const getRuleVersions = async (req, res) => {
  try {
    const { ruleId } = req.params;
    
    if (!ruleId) {
      return validationError(res, '规则ID不能为空');
    }

    const [versions] = await sequelize.query(
      `SELECT 
        version_id,
        version_number,
        threshold_value,
        threshold_unit,
        authority_explanation,
        effect_status,
        effect_time,
        expire_time,
        created_at,
        updated_at
       FROM rule_version
       WHERE rule_id = :ruleId
       ORDER BY created_at DESC`,
      { replacements: { ruleId: parseInt(ruleId) } }
    );

    const result = versions.map(v => ({
      versionId: v.version_id,
      versionNumber: v.version_number,
      thresholdValue: v.threshold_value,
      thresholdUnit: v.threshold_unit,
      authorityExplanation: v.authority_explanation,
      effectStatus: v.effect_status,
      effectTime: v.effect_time,
      expireTime: v.expire_time,
      createdAt: v.created_at,
      updatedAt: v.updated_at
    }));

    return success(res, result, '获取成功');
  } catch (err) {
    // 表不存在时返回空数组
    if (err.code === 'ER_NO_SUCH_TABLE') {
      return success(res, [], '获取成功');
    }
    console.error('获取规则版本列表错误：', err);
    return error(res, '获取失败', 500, err.message);
  }
};

/**
 * 获取版本关联的模板列表接口
 * GET /api/health-rule/templates/:versionId
 */
const getRuleTemplatesByVersion = async (req, res) => {
  try {
    const { versionId } = req.params;
    
    if (!versionId) {
      return validationError(res, '版本ID不能为空');
    }

    // 查询关联的模板
    const [templates] = await sequelize.query(
      `SELECT 
        rt.template_id,
        rt.template_name,
        rt.status,
        COUNT(DISTINCT utm.user_id) as user_count
       FROM rule_template_binding rtb
       JOIN rule_templates rt ON rtb.template_id = rt.template_id
       LEFT JOIN user_template_mapping utm ON rt.template_id = utm.template_id
       WHERE rtb.version_id = :versionId
       GROUP BY rt.template_id, rt.template_name, rt.status`,
      { replacements: { versionId: parseInt(versionId) } }
    );

    const result = templates.map(t => ({
      templateId: t.template_id,
      templateName: t.template_name,
      status: t.status,
      userCount: parseInt(t.user_count) || 0
    }));

    return success(res, result, '获取成功');
  } catch (err) {
    // 表不存在时返回空数组
    if (err.code === 'ER_NO_SUCH_TABLE') {
      return success(res, [], '获取成功');
    }
    console.error('获取模板列表错误：', err);
    return error(res, '获取失败', 500, err.message);
  }
};

/**
 * 删除健康规则接口
 * DELETE /api/health-rule/:ruleId
 */
const deleteHealthRule = async (req, res) => {
  try {
    const { ruleId } = req.params;
    const adminId = req.admin?.id;
    
    if (!ruleId) {
      return validationError(res, '规则ID不能为空');
    }

    // 验证ruleId是否为有效数字
    const parsedRuleId = parseInt(ruleId);
    if (isNaN(parsedRuleId) || parsedRuleId <= 0) {
      return validationError(res, '规则ID无效');
    }

    const transaction = await sequelize.transaction();

    try {
      // 检查规则是否存在
      const [rules] = await sequelize.query(
        `SELECT rule_id, rule_name, status FROM health_rule WHERE rule_id = :ruleId LIMIT 1`,
        { replacements: { ruleId: parsedRuleId }, transaction }
      );

      if (rules.length === 0) {
        await transaction.rollback();
        return error(res, '规则不存在', 404);
      }

      const rule = rules[0];

      // 检查是否有真正生效的版本（如果有版本表）
      // 生效的版本需要：effect_status = 1 且 (expire_time IS NULL 或 expire_time > NOW())
      try {
        const [activeVersions] = await sequelize.query(
          `SELECT COUNT(*) as count FROM rule_version 
           WHERE rule_id = :ruleId 
             AND effect_status = 1
             AND (expire_time IS NULL OR expire_time > NOW())`,
          { replacements: { ruleId: parsedRuleId }, transaction }
        );

        if (activeVersions.length > 0 && activeVersions[0].count > 0) {
          await transaction.rollback();
          return error(res, '该规则有生效的版本，请先过期版本后再删除', 400);
        }
      } catch (err) {
        // 版本表不存在时忽略
        if (err.code !== 'ER_NO_SUCH_TABLE') {
          throw err;
        }
      }

      // 删除规则（级联删除版本和关联）
      await sequelize.query(
        `DELETE FROM health_rule WHERE rule_id = :ruleId`,
        { replacements: { ruleId: parsedRuleId }, transaction }
      );

      await transaction.commit();

      // 在事务提交后记录操作日志（避免锁冲突）
      try {
        await recordLog({
          adminId,
          operateType: 'delete',
          ruleId: null, // 规则已删除，设为null避免外键约束
          operateContent: `删除规则 ${parsedRuleId}：${rule.rule_name}`,
          changeDetail: {
            ruleId: parsedRuleId,
            ruleName: rule.rule_name
          },
          operateResult: true
        });
      } catch (logErr) {
        // 日志记录失败不影响主流程
        console.warn('记录删除日志失败：', logErr.message);
      }

      return success(res, null, '删除成功');
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (err) {
    console.error('删除健康规则错误：', err);
    return error(res, '删除失败', 500, err.message);
  }
};

/**
 * 批量删除健康规则接口
 * DELETE /api/health-rule/batch-delete
 */
const batchDeleteHealthRule = async (req, res) => {
  try {
    const { ruleIds } = req.body;
    const adminId = req.admin?.id;
    
    if (!ruleIds || !Array.isArray(ruleIds) || ruleIds.length === 0) {
      return validationError(res, '规则ID数组不能为空');
    }

    const transaction = await sequelize.transaction();

    try {
      const results = {
        success: [],
        failed: []
      };

      for (const ruleId of ruleIds) {
        try {
          // 验证ruleId是否为有效数字
          const parsedRuleId = parseInt(ruleId);
          if (isNaN(parsedRuleId) || parsedRuleId <= 0) {
            results.failed.push({
              ruleId: ruleId,
              reason: '规则ID无效'
            });
            continue;
          }
          
          // 检查规则是否存在
          const [rules] = await sequelize.query(
            `SELECT rule_id, rule_name, status FROM health_rule WHERE rule_id = :ruleId LIMIT 1`,
            { replacements: { ruleId: parsedRuleId }, transaction }
          );

          if (rules.length === 0) {
            results.failed.push({
              ruleId: parsedRuleId,
              reason: '规则不存在'
            });
            continue;
          }

          const rule = rules[0];

          // 检查是否有真正生效的版本
          // 生效的版本需要：effect_status = 1 且 (expire_time IS NULL 或 expire_time > NOW())
          try {
            const [activeVersions] = await sequelize.query(
              `SELECT COUNT(*) as count FROM rule_version 
               WHERE rule_id = :ruleId 
                 AND effect_status = 1
                 AND (expire_time IS NULL OR expire_time > NOW())`,
              { replacements: { ruleId: parsedRuleId }, transaction }
            );

            if (activeVersions.length > 0 && activeVersions[0].count > 0) {
              results.failed.push({
                ruleId: parsedRuleId,
                reason: '该规则有生效的版本，请先过期版本后再删除'
              });
              continue;
            }
          } catch (err) {
            // 版本表不存在时忽略
            if (err.code !== 'ER_NO_SUCH_TABLE') {
              throw err;
            }
          }

          // 删除规则
          await sequelize.query(
            `DELETE FROM health_rule WHERE rule_id = :ruleId`,
            { replacements: { ruleId: parsedRuleId }, transaction }
          );

          results.success.push({
            ruleId: parsedRuleId,
            ruleName: rule.rule_name
          });
        } catch (err) {
          results.failed.push({
            ruleId: ruleId,
            reason: err.message
          });
        }
      }

      await transaction.commit();

      // 在事务提交后记录批量删除汇总日志和每个删除的详细日志（避免锁冲突）
      try {
        // 记录每个成功删除的规则日志
        for (const successItem of results.success) {
          try {
            await recordLog({
              adminId,
              operateType: 'delete',
              ruleId: null, // 规则已删除，设为null避免外键约束
              operateContent: `批量删除规则 ${successItem.ruleId}：${successItem.ruleName}`,
              changeDetail: {
                ruleId: successItem.ruleId,
                ruleName: successItem.ruleName
              },
              operateResult: true
            });
          } catch (logErr) {
            console.warn(`记录删除日志失败（规则${successItem.ruleId}）：`, logErr.message);
          }
        }

        // 记录批量删除汇总日志
        await recordLog({
          adminId,
          operateType: 'batch-delete',
          ruleId: null, // 批量操作不关联具体规则
          operateContent: `批量删除规则（成功：${results.success.length}，失败：${results.failed.length}）`,
          changeDetail: {
            total: ruleIds.length,
            success: results.success.length,
            failed: results.failed.length,
            details: {
              success: results.success,
              failed: results.failed
            }
          },
          operateResult: results.failed.length === 0
        });
      } catch (logErr) {
        // 日志记录失败不影响主流程
        console.warn('记录批量删除日志失败：', logErr.message);
      }

      return success(res, results, `批量删除完成：成功 ${results.success.length} 条，失败 ${results.failed.length} 条`);
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (err) {
    console.error('批量删除健康规则错误：', err);
    // 返回更详细的错误信息
    const errorMessage = err.message || '批量删除失败';
    return error(res, errorMessage, 500);
  }
};

module.exports = {
  importHealthRule,
  updateHealthRule,
  getHealthRuleList,
  rollbackVersion,
  bindTemplate,
  getCategories,
  getOperateLogs,
  deleteOperateLog,
  batchDeleteOperateLog,
  syncDict,
  getRuleDetail,
  getRuleVersions,
  expireVersion,
  getRuleTemplatesByVersion,
  deleteHealthRule,
  batchDeleteHealthRule,
};
