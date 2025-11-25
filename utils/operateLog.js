/**
 * 操作日志工具类
 * 用于记录健康规则相关的操作日志
 * 
 * 业务价值：完整记录操作历史，便于审计和问题追溯，支持操作回放和数据分析
 */

const { sequelize } = require('../config/db');

/**
 * 记录操作日志
 * @param {Object} logData - 日志数据
 * @param {number} logData.adminId - 操作人ID
 * @param {string} logData.operateType - 操作类型：import/update/rollback/bind/unbind
 * @param {number} logData.ruleId - 规则ID（可选）
 * @param {number} logData.templateId - 模板ID（可选）
 * @param {string} logData.operateContent - 操作内容
 * @param {Object} logData.changeDetail - 变更详情（JSON对象）
 * @param {boolean} logData.operateResult - 操作结果：true-成功，false-失败
 * @param {string} logData.errorMessage - 错误信息（可选）
 */
const recordLog = async (logData) => {
  try {
    const {
      adminId,
      operateType,
      ruleId = null,
      templateId = null,
      operateContent,
      changeDetail = null,
      operateResult = true,
      errorMessage = null
    } = logData;

    // 检查表是否存在
    try {
      await sequelize.query('SELECT 1 FROM health_rule_operate_log LIMIT 1');
    } catch (tableErr) {
      if (tableErr.code === 'ER_NO_SUCH_TABLE') {
        // 表不存在时静默返回，不输出警告
        return;
      }
      throw tableErr; // 其他错误继续抛出
    }

    // 如果ruleId不为null，检查规则是否存在（避免外键约束错误）
    if (ruleId !== null && ruleId !== undefined) {
      try {
        const [checkRule] = await sequelize.query(
          `SELECT rule_id FROM health_rule WHERE rule_id = :ruleId LIMIT 1`,
          { replacements: { ruleId } }
        );
        // 如果规则不存在，将ruleId设为null（避免外键约束错误）
        if (checkRule.length === 0) {
          ruleId = null;
        }
      } catch (checkErr) {
        // 检查失败时，将ruleId设为null（避免外键约束错误）
        ruleId = null;
      }
    }

    await sequelize.query(
      `INSERT INTO health_rule_operate_log 
       (admin_id, operate_type, rule_id, template_id, operate_content, change_detail, operate_result, error_message, created_at)
       VALUES (:adminId, :operateType, :ruleId, :templateId, :operateContent, :changeDetail, :operateResult, :errorMessage, NOW())`,
      {
        replacements: {
          adminId,
          operateType,
          ruleId: ruleId || null,
          templateId: templateId || null,
          operateContent,
          changeDetail: changeDetail ? JSON.stringify(changeDetail) : null,
          operateResult: operateResult ? 1 : 0,
          errorMessage
        }
      }
    );
  } catch (err) {
    console.error('记录操作日志失败：', err);
    // 日志记录失败不应影响主业务流程
  }
};

/**
 * 查询操作日志
 * @param {Object} params - 查询参数
 * @param {string} params.operateType - 操作类型（可选）
 * @param {string} params.startDate - 开始时间（可选）
 * @param {string} params.endDate - 结束时间（可选）
 * @param {number} params.page - 页码
 * @param {number} params.limit - 每页条数
 */
const getLogs = async (params) => {
  try {
    const {
      operateType = null,
      startDate = null,
      endDate = null,
      page = 1,
      limit = 10
    } = params;

    // 检查表是否存在
    try {
      await sequelize.query('SELECT 1 FROM health_rule_operate_log LIMIT 1');
    } catch (tableErr) {
      // 表不存在时，返回空结果（静默处理，不输出警告）
      if (tableErr.code === 'ER_NO_SUCH_TABLE') {
        return {
          list: [],
          total: 0,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: 0
        };
      }
      throw tableErr;
    }

    let whereClause = '1=1';
    const replacements = {
      offset: (page - 1) * limit,
      limit: parseInt(limit)
    };

    if (operateType) {
      whereClause += ' AND operate_type = :operateType';
      replacements.operateType = operateType;
    }

    if (startDate) {
      whereClause += ' AND created_at >= :startDate';
      replacements.startDate = startDate;
    }

    if (endDate) {
      whereClause += ' AND created_at <= :endDate';
      replacements.endDate = endDate;
    }

    // 查询总数
    const [countResult] = await sequelize.query(
      `SELECT COUNT(*) as total FROM health_rule_operate_log WHERE ${whereClause}`,
      { replacements }
    );
    const total = countResult[0]?.total || 0;

    // 查询列表（指定表别名避免字段歧义）
    const [logs] = await sequelize.query(
      `SELECT 
        log.log_id,
        log.admin_id,
        log.operate_type,
        log.rule_id,
        log.template_id,
        log.operate_content,
        log.change_detail,
        log.operate_result,
        log.error_message,
        log.created_at,
        a.nickname as admin_name
       FROM health_rule_operate_log log
       LEFT JOIN admins a ON log.admin_id = a.id
       WHERE ${whereClause}
       ORDER BY log.created_at DESC
       LIMIT :limit OFFSET :offset`,
      { replacements }
    );

    // 格式化数据
    const result = logs.map(log => {
      let changeDetail = null;
      try {
        if (log.change_detail) {
          changeDetail = typeof log.change_detail === 'string' 
            ? JSON.parse(log.change_detail) 
            : log.change_detail;
        }
      } catch (e) {
        console.warn('解析changeDetail失败：', e);
        changeDetail = null;
      }
      
      return {
        logId: log.log_id,
        adminId: log.admin_id,
        adminName: log.admin_name || '系统',
        operateType: log.operate_type,
        ruleId: log.rule_id,
        templateId: log.template_id,
        operateContent: log.operate_content,
        changeDetail: changeDetail,
        operateResult: log.operate_result === 1,
        errorMessage: log.error_message,
        createdAt: log.created_at
      };
    });

    return {
      list: result,
      total: parseInt(total),
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / limit)
    };
  } catch (err) {
    console.error('查询操作日志失败：', err);
    // 即使出错也返回空结果，不阻塞前端
    return {
      list: [],
      total: 0,
      page: parseInt(params.page || 1),
      limit: parseInt(params.limit || 10),
      totalPages: 0
    };
  }
};

module.exports = {
  recordLog,
  getLogs
};

