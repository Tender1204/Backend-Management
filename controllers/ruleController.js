/**
 * 健康规则管理控制器
 * 提供基础规则配置、规则模板管理、规则效果统计接口
 */

const { sequelize } = require('../config/db');
const { success, error, validationError } = require('../utils/response');

/**
 * 获取基础规则配置
 * GET /api/rules/config
 */
const getRuleConfig = async (req, res) => {
  try {
    // 从 system_configs 表读取基础规则配置
    const [configs] = await sequelize.query(
      `SELECT config_key, config_value, config_type 
       FROM system_configs 
       WHERE group_name = 'rule_config' 
       ORDER BY config_key`
    );

    // 初始化默认配置结构
    const defaultConfig = {
      water: {
        dailyTarget: 2000, // 每日推荐量（ml）
        reminderInterval: 120 // 提醒间隔（分钟）
      },
      diet: {
        calorieTarget: 2000 // 热量目标（kcal）
      },
      exercise: {
        stepTarget: 10000, // 步数目标
        sedentaryDuration: 60 // 久坐时长（分钟）
      },
      sleep: {
        recommendedDuration: 480 // 推荐时长（分钟，8小时）
      }
    };

    // 将数据库配置转换为对象
    const configObj = {};
    configs.forEach(item => {
      const key = item.config_key;
      let value = item.config_value;
      
      // 根据类型解析值
      if (item.config_type === 'number') {
        value = parseFloat(value);
      } else if (item.config_type === 'json') {
        try {
          value = JSON.parse(value);
        } catch (e) {
          value = {};
        }
      }
      
      // 解析配置键（格式：rule_water_dailyTarget）
      const parts = key.split('_');
      if (parts.length >= 3 && parts[0] === 'rule') {
        const category = parts[1]; // water, diet, exercise, sleep
        const field = parts.slice(2).join('_'); // dailyTarget, reminderInterval等
        
        if (!configObj[category]) {
          configObj[category] = {};
        }
        configObj[category][field] = value;
      }
    });

    // 合并默认配置和数据库配置
    const result = {
      water: { ...defaultConfig.water, ...(configObj.water || {}) },
      diet: { ...defaultConfig.diet, ...(configObj.diet || {}) },
      exercise: { ...defaultConfig.exercise, ...(configObj.exercise || {}) },
      sleep: { ...defaultConfig.sleep, ...(configObj.sleep || {}) }
    };

    return success(res, result, '获取成功');
  } catch (err) {
    console.error('获取规则配置错误：', err);
    return error(res, '获取配置失败', 500, err.message);
  }
};

/**
 * 更新基础规则配置
 * PUT /api/rules/config
 * 请求体：{ water: {...}, diet: {...}, exercise: {...}, sleep: {...}, effectiveType: 'immediate'|'scheduled' }
 */
const updateRuleConfig = async (req, res) => {
  try {
    const { water, diet, exercise, sleep, effectiveType = 'immediate' } = req.body;

    if (!water && !diet && !exercise && !sleep) {
      return validationError(res, '至少需要更新一个规则类型的配置');
    }

    // 开始事务
    const transaction = await sequelize.transaction();

    try {
      // 构建配置更新数组
      const updates = [];

      // 处理饮水配置
      if (water) {
        if (water.dailyTarget !== undefined) {
          updates.push({
            key: 'rule_water_dailyTarget',
            value: water.dailyTarget.toString(),
            type: 'number',
            desc: '饮水每日推荐量（ml）'
          });
        }
        if (water.reminderInterval !== undefined) {
          updates.push({
            key: 'rule_water_reminderInterval',
            value: water.reminderInterval.toString(),
            type: 'number',
            desc: '饮水提醒间隔（分钟）'
          });
        }
      }

      // 处理饮食配置
      if (diet) {
        if (diet.calorieTarget !== undefined) {
          updates.push({
            key: 'rule_diet_calorieTarget',
            value: diet.calorieTarget.toString(),
            type: 'number',
            desc: '饮食热量目标（kcal）'
          });
        }
      }

      // 处理运动配置
      if (exercise) {
        if (exercise.stepTarget !== undefined) {
          updates.push({
            key: 'rule_exercise_stepTarget',
            value: exercise.stepTarget.toString(),
            type: 'number',
            desc: '运动步数目标'
          });
        }
        if (exercise.sedentaryDuration !== undefined) {
          updates.push({
            key: 'rule_exercise_sedentaryDuration',
            value: exercise.sedentaryDuration.toString(),
            type: 'number',
            desc: '久坐时长（分钟）'
          });
        }
      }

      // 处理睡眠配置
      if (sleep) {
        if (sleep.recommendedDuration !== undefined) {
          updates.push({
            key: 'rule_sleep_recommendedDuration',
            value: sleep.recommendedDuration.toString(),
            type: 'number',
            desc: '睡眠推荐时长（分钟）'
          });
        }
      }

      // 批量更新配置（使用 INSERT ... ON DUPLICATE KEY UPDATE）
      for (const update of updates) {
        await sequelize.query(
          `INSERT INTO system_configs (config_key, config_value, config_type, config_desc, group_name, updated_at)
           VALUES (:key, :value, :type, :desc, 'rule_config', NOW())
           ON DUPLICATE KEY UPDATE 
           config_value = VALUES(config_value),
           updated_at = NOW()`,
          {
            replacements: {
              key: update.key,
              value: update.value,
              type: update.type,
              desc: update.desc
            },
            transaction
          }
        );
      }

      // 如果选择定时生效，记录生效时间（次日0点）
      if (effectiveType === 'scheduled') {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        
        await sequelize.query(
          `INSERT INTO system_configs (config_key, config_value, config_type, config_desc, group_name, updated_at)
           VALUES ('rule_config_effective_time', :time, 'string', '规则配置生效时间', 'rule_config', NOW())
           ON DUPLICATE KEY UPDATE 
           config_value = VALUES(config_value),
           updated_at = NOW()`,
          {
            replacements: {
              time: tomorrow.toISOString().slice(0, 19).replace('T', ' ')
            },
            transaction
          }
        );
      }

      await transaction.commit();

      return success(res, {
        effectiveType,
        effectiveTime: effectiveType === 'scheduled' 
          ? new Date(new Date().setDate(new Date().getDate() + 1)).setHours(0, 0, 0, 0)
          : new Date().toISOString()
      }, effectiveType === 'immediate' ? '配置已立即生效' : '配置将在次日0点生效');
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (err) {
    console.error('更新规则配置错误：', err);
    return error(res, '更新配置失败', 500, err.message);
  }
};

/**
 * 获取规则模板列表
 * GET /api/rules/templates
 * 查询参数：ruleTypeId（可选，按规则类型筛选）
 */
const getTemplateList = async (req, res) => {
  try {
    const { ruleTypeId } = req.query;

    let query = `
      SELECT 
        rt.id,
        rt.template_name,
        rt.rule_type_id,
        rt.rule_config,
        rt.description,
        rt.is_default,
        rt.status,
        rt.created_at,
        rt.updated_at,
        rty.type_code,
        rty.type_name,
        GROUP_CONCAT(DISTINCT ut.tag_name ORDER BY ut.tag_name SEPARATOR ', ') as tag_names,
        GROUP_CONCAT(DISTINCT rtm.tag_id ORDER BY rtm.tag_id SEPARATOR ',') as tag_ids,
        (
          SELECT COUNT(DISTINCT utm2.user_id)
          FROM rule_tag_mapping rtm2
          LEFT JOIN user_tag_mapping utm2 ON rtm2.tag_id = utm2.tag_id
          WHERE rtm2.template_id = rt.id
        ) as user_count
      FROM rule_templates rt
      LEFT JOIN rule_types rty ON rt.rule_type_id = rty.id
      LEFT JOIN rule_tag_mapping rtm ON rt.id = rtm.template_id
      LEFT JOIN user_tags ut ON rtm.tag_id = ut.id
    `;

    const replacements = {};
    if (ruleTypeId) {
      query += ' WHERE rt.rule_type_id = :ruleTypeId';
      replacements.ruleTypeId = ruleTypeId;
    }

    query += ' GROUP BY rt.id ORDER BY rt.created_at ASC';

    const [templates] = await sequelize.query(query, { replacements });

    // 格式化数据
    const result = templates.map(template => {
      let ruleConfig = {};
      if (template.rule_config) {
        try {
          // 如果rule_config是字符串，尝试解析JSON
          if (typeof template.rule_config === 'string') {
            ruleConfig = JSON.parse(template.rule_config);
          } else {
            // 如果已经是对象，直接使用
            ruleConfig = template.rule_config;
          }
        } catch (e) {
          console.error('解析规则配置JSON失败：', e, template.rule_config);
          ruleConfig = {};
        }
      }
      
      return {
        id: template.id,
        templateName: template.template_name,
        ruleTypeId: template.rule_type_id,
        ruleTypeCode: template.type_code,
        ruleTypeName: template.type_name,
        ruleConfig: ruleConfig,
        description: template.description,
        isDefault: template.is_default === 1,
        status: template.status,
        tagNames: template.tag_names || '',
        tagIds: template.tag_ids ? template.tag_ids.split(',').filter(id => id).map(id => parseInt(id)) : [],
        userCount: parseInt(template.user_count) || 0,
        createdAt: template.created_at,
        updatedAt: template.updated_at
      };
    });

    return success(res, result, '获取成功');
  } catch (err) {
    console.error('获取模板列表错误：', err);
    return error(res, '获取模板列表失败', 500, err.message);
  }
};

/**
 * 创建规则模板
 * POST /api/rules/templates
 * 请求体：{ templateName, ruleTypeId, ruleConfig, description, tagIds }
 */
const createTemplate = async (req, res) => {
  try {
    const { templateName, ruleTypeId, ruleConfig, description, tagIds = [] } = req.body;

    if (!templateName || !ruleTypeId) {
      return validationError(res, '模板名称和规则类型不能为空');
    }

    const transaction = await sequelize.transaction();

    try {
      // 创建模板
      const [result] = await sequelize.query(
        `INSERT INTO rule_templates (template_name, rule_type_id, rule_config, description, created_at, updated_at)
         VALUES (:templateName, :ruleTypeId, :ruleConfig, :description, NOW(), NOW())`,
        {
          replacements: {
            templateName,
            ruleTypeId,
            ruleConfig: JSON.stringify(ruleConfig || {}),
            description: description || null
          },
          transaction
        }
      );

      const templateId = result.insertId;

      // 关联标签
      if (tagIds && tagIds.length > 0) {
        for (const tagId of tagIds) {
          await sequelize.query(
            `INSERT INTO rule_tag_mapping (template_id, tag_id, created_at)
             VALUES (:templateId, :tagId, NOW())`,
            {
              replacements: { templateId, tagId },
              transaction
            }
          );
        }
      }

      await transaction.commit();

      return success(res, { id: templateId }, '创建模板成功');
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (err) {
    console.error('创建模板错误：', err);
    return error(res, '创建模板失败', 500, err.message);
  }
};

/**
 * 更新规则模板
 * PUT /api/rules/templates/:id
 * 请求体：{ templateName, ruleConfig, description, tagIds }
 */
const updateTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const { templateName, ruleConfig, description, tagIds } = req.body;

    const transaction = await sequelize.transaction();

    try {
      // 更新模板基本信息
      const updateFields = [];
      const replacements = { id };

      if (templateName !== undefined) {
        updateFields.push('template_name = :templateName');
        replacements.templateName = templateName;
      }
      if (ruleConfig !== undefined) {
        updateFields.push('rule_config = :ruleConfig');
        replacements.ruleConfig = JSON.stringify(ruleConfig);
      }
      if (description !== undefined) {
        updateFields.push('description = :description');
        replacements.description = description;
      }

      if (updateFields.length > 0) {
        updateFields.push('updated_at = NOW()');
        await sequelize.query(
          `UPDATE rule_templates SET ${updateFields.join(', ')} WHERE id = :id`,
          { replacements, transaction }
        );
      }

      // 更新标签关联
      if (tagIds !== undefined) {
        // 删除旧关联
        await sequelize.query(
          `DELETE FROM rule_tag_mapping WHERE template_id = :id`,
          { replacements: { id }, transaction }
        );

        // 添加新关联
        if (tagIds && tagIds.length > 0) {
          for (const tagId of tagIds) {
            await sequelize.query(
              `INSERT INTO rule_tag_mapping (template_id, tag_id, created_at)
               VALUES (:id, :tagId, NOW())`,
              { replacements: { id, tagId }, transaction }
            );
          }
        }
      }

      await transaction.commit();

      return success(res, null, '更新模板成功');
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (err) {
    console.error('更新模板错误：', err);
    return error(res, '更新模板失败', 500, err.message);
  }
};

/**
 * 删除规则模板
 * DELETE /api/rules/templates/:id
 */
const deleteTemplate = async (req, res) => {
  try {
    const { id } = req.params;

    // 检查是否有用户使用此模板
    const [records] = await sequelize.query(
      `SELECT COUNT(*) as count FROM user_rule_records WHERE template_id = :id`,
      { replacements: { id } }
    );

    if (records[0].count > 0) {
      return error(res, '该模板已被用户使用，无法删除', 400);
    }

    // 删除模板（级联删除会同时删除 rule_tag_mapping 中的关联）
    await sequelize.query(
      `DELETE FROM rule_templates WHERE id = :id`,
      { replacements: { id } }
    );

    return success(res, null, '删除模板成功');
  } catch (err) {
    console.error('删除模板错误：', err);
    return error(res, '删除模板失败', 500, err.message);
  }
};

/**
 * 按标签分配模板给用户
 * POST /api/rules/templates/:id/assign
 * 请求体：{ tagIds: [1, 2, 3] }
 */
const assignTemplateToUsers = async (req, res) => {
  try {
    const { id } = req.params;
    const { tagIds } = req.body;

    if (!tagIds || !Array.isArray(tagIds) || tagIds.length === 0) {
      return validationError(res, '标签ID列表不能为空');
    }

    // 检查模板是否存在
    const [templates] = await sequelize.query(
      `SELECT id FROM rule_templates WHERE id = :id`,
      { replacements: { id } }
    );

    if (templates.length === 0) {
      return error(res, '模板不存在', 404);
    }

    // 查询这些标签下的所有用户
    const [users] = await sequelize.query(
      `SELECT DISTINCT user_id 
       FROM user_tag_mapping 
       WHERE tag_id IN (${tagIds.map(() => '?').join(',')})`,
      { replacements: tagIds }
    );

    const userIds = users.map(u => u.user_id);
    const userCount = userIds.length;

    // 更新模板的标签关联（将模板分配给这些标签）
    const transaction = await sequelize.transaction();
    
    try {
      // 删除旧的标签关联
      await sequelize.query(
        `DELETE FROM rule_tag_mapping WHERE template_id = :id`,
        { replacements: { id }, transaction }
      );

      // 添加新的标签关联
      for (const tagId of tagIds) {
        await sequelize.query(
          `INSERT INTO rule_tag_mapping (template_id, tag_id, created_at)
           VALUES (:id, :tagId, NOW())
           ON DUPLICATE KEY UPDATE created_at = NOW()`,
          { replacements: { id, tagId }, transaction }
        );
      }

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }

    return success(res, {
      templateId: parseInt(id),
      tagIds,
      userCount,
      userIds
    }, `模板已分配给 ${userCount} 个用户`);
  } catch (err) {
    console.error('分配模板错误：', err);
    return error(res, '分配模板失败', 500, err.message);
  }
};

/**
 * 获取规则类型列表
 * GET /api/rules/types
 */
const getRuleTypes = async (req, res) => {
  try {
    const [types] = await sequelize.query(
      `SELECT id, type_code, type_name, icon, sort_order, status 
       FROM rule_types 
       WHERE status = 1 
       ORDER BY sort_order ASC`
    );

    const result = types.map(type => ({
      id: type.id,
      typeCode: type.type_code,
      typeName: type.type_name,
      icon: type.icon,
      sortOrder: type.sort_order,
      status: type.status
    }));

    return success(res, result, '获取成功');
  } catch (err) {
    console.error('获取规则类型错误：', err);
    return error(res, '获取规则类型失败', 500, err.message);
  }
};

/**
 * 获取规则效果统计
 * GET /api/rules/statistics
 * 查询参数：ruleTypeId（可选），period（day/week/month）
 */
const getRuleStatistics = async (req, res) => {
  try {
    const { ruleTypeId, period = 'day' } = req.query;

    // 计算时间范围
    let startDate, endDate, groupBy;
    const now = new Date();

    switch (period) {
      case 'day':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6); // 最近7天
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        groupBy = 'DATE(urr.record_date)';
        break;
      case 'week':
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay() - 6 * 7); // 最近7周
        weekStart.setHours(0, 0, 0, 0);
        startDate = weekStart;
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        groupBy = 'YEARWEEK(urr.record_date)';
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth() - 5, 1); // 最近6个月
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        groupBy = 'DATE_FORMAT(urr.record_date, "%Y-%m")';
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        groupBy = 'DATE(urr.record_date)';
    }

    // 构建查询条件
    let whereClause = `urr.record_date >= DATE(:startDate) AND urr.record_date < DATE(:endDate)`;
    const replacements = {
      startDate: startDate.toISOString().slice(0, 10),
      endDate: endDate.toISOString().slice(0, 10)
    };

    if (ruleTypeId) {
      whereClause += ' AND urr.rule_type_id = :ruleTypeId';
      replacements.ruleTypeId = ruleTypeId;
    }

    // 查询触发次数和执行率统计
    const query = `
      SELECT 
        ${groupBy} as time_period,
        rty.id as rule_type_id,
        rty.type_code,
        rty.type_name,
        COUNT(urr.id) as trigger_count,
        COUNT(DISTINCT urr.user_id) as user_count,
        AVG(urr.completion_rate) as avg_completion_rate,
        SUM(CASE WHEN urr.completion_rate >= 80 THEN 1 ELSE 0 END) as completed_count,
        COUNT(urr.id) as total_count
      FROM user_rule_records urr
      JOIN rule_types rty ON urr.rule_type_id = rty.id
      WHERE ${whereClause}
      GROUP BY ${groupBy}, rty.id, rty.type_code, rty.type_name
      ORDER BY time_period DESC, rty.id
    `;

    const [statistics] = await sequelize.query(query, { replacements });

    // 格式化数据
    const result = statistics.map(stat => ({
      timePeriod: stat.time_period,
      ruleTypeId: stat.rule_type_id,
      ruleTypeCode: stat.type_code,
      ruleTypeName: stat.type_name,
      triggerCount: parseInt(stat.trigger_count) || 0,
      userCount: parseInt(stat.user_count) || 0,
      avgCompletionRate: parseFloat(stat.avg_completion_rate) || 0,
      completedCount: parseInt(stat.completed_count) || 0,
      totalCount: parseInt(stat.total_count) || 0,
      executionRate: stat.total_count > 0 
        ? ((parseInt(stat.completed_count) / parseInt(stat.total_count)) * 100).toFixed(2)
        : 0
    }));

    // 按规则类型分组
    const groupedByType = {};
    result.forEach(stat => {
      if (!groupedByType[stat.ruleTypeCode]) {
        groupedByType[stat.ruleTypeCode] = {
          ruleTypeId: stat.ruleTypeId,
          ruleTypeCode: stat.ruleTypeCode,
          ruleTypeName: stat.ruleTypeName,
          data: []
        };
      }
      groupedByType[stat.ruleTypeCode].data.push(stat);
    });

    return success(res, {
      period,
      statistics: result,
      groupedByType: Object.values(groupedByType)
    }, '获取成功');
  } catch (err) {
    console.error('获取规则统计错误：', err);
    return error(res, '获取统计失败', 500, err.message);
  }
};

module.exports = {
  getRuleConfig,
  updateRuleConfig,
  getRuleTypes,
  getTemplateList,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  assignTemplateToUsers,
  getRuleStatistics
};

