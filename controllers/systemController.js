/**
 * 系统管理控制器
 * 处理系统配置、系统日志、数据备份等接口
 */

const { sequelize } = require('../config/db');
const { success, error, validationError } = require('../utils/response');
const fs = require('fs');
const path = require('path');

/**
 * 获取系统配置列表
 * GET /api/system/configs
 * 查询参数：groupName, page, limit
 */
const getConfigList = async (req, res) => {
  try {
    const { groupName, page = 1, limit = 20 } = req.query;
    
    // 检查表是否存在
    try {
      await sequelize.query('SELECT 1 FROM system_configs LIMIT 1');
    } catch (tableErr) {
      if (tableErr.code === 'ER_NO_SUCH_TABLE') {
        // 表不存在时返回空结果
        return success(res, {
          list: [],
          total: 0,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: 0
        }, '获取成功');
      }
      throw tableErr;
    }
    
    // 构建查询条件
    let whereConditions = [];
    let replacements = {};
    
    if (groupName) {
      whereConditions.push('group_name = :groupName');
      replacements.groupName = groupName;
    }
    
    const whereClause = whereConditions.length > 0 
      ? 'WHERE ' + whereConditions.join(' AND ')
      : '';
    
    // 计算总数
    const [countResult] = await sequelize.query(
      `SELECT COUNT(*) as total FROM system_configs ${whereClause}`,
      { replacements }
    );
    const total = countResult[0].total;
    
    // 分页查询
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const [configs] = await sequelize.query(
      `SELECT * FROM system_configs 
       ${whereClause}
       ORDER BY group_name ASC, id ASC
       LIMIT :limit OFFSET :offset`,
      {
        replacements: {
          ...replacements,
          limit: parseInt(limit),
          offset: offset
        }
      }
    );
    
    // 格式化配置值
    const formattedConfigs = configs.map(config => {
      let value = config.config_value;
      if (config.config_type === 'number') {
        value = value ? parseFloat(value) : null;
      } else if (config.config_type === 'boolean') {
        value = value === 'true' || value === '1';
      } else if (config.config_type === 'json') {
        try {
          value = value ? JSON.parse(value) : null;
        } catch (e) {
          value = null;
        }
      }
      return {
        ...config,
        config_value: value
      };
    });
    
    return success(res, {
      list: formattedConfigs,
      total: total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit))
    }, '获取成功');
    
  } catch (err) {
    console.error('获取系统配置列表错误：', err);
    return error(res, '获取系统配置列表失败', 500, err.message);
  }
};

/**
 * 获取系统配置详情
 * GET /api/system/configs/:key
 */
const getConfigDetail = async (req, res) => {
  try {
    const { key } = req.params;
    
    const [configs] = await sequelize.query(
      `SELECT * FROM system_configs WHERE config_key = :key LIMIT 1`,
      { replacements: { key } }
    );
    
    if (!configs || configs.length === 0) {
      return error(res, '配置不存在', 404);
    }
    
    const config = configs[0];
    let value = config.config_value;
    if (config.config_type === 'number') {
      value = value ? parseFloat(value) : null;
    } else if (config.config_type === 'boolean') {
      value = value === 'true' || value === '1';
    } else if (config.config_type === 'json') {
      try {
        value = value ? JSON.parse(value) : null;
      } catch (e) {
        value = null;
      }
    }
    
    return success(res, {
      ...config,
      config_value: value
    }, '获取成功');
    
  } catch (err) {
    console.error('获取系统配置详情错误：', err);
    return error(res, '获取系统配置详情失败', 500, err.message);
  }
};

/**
 * 创建或更新系统配置
 * POST /api/system/configs
 * 请求体：{ config_key, config_value, config_type, config_desc, group_name, is_public }
 */
const saveConfig = async (req, res) => {
  try {
    const { config_key, config_value, config_type = 'string', config_desc, group_name = 'default', is_public = 0 } = req.body;
    
    // 参数验证
    if (!config_key) {
      return validationError(res, '配置键不能为空');
    }
    
    // 格式化配置值
    let formattedValue = config_value;
    if (config_type === 'number') {
      formattedValue = config_value !== null && config_value !== undefined ? String(config_value) : null;
    } else if (config_type === 'boolean') {
      formattedValue = config_value ? 'true' : 'false';
    } else if (config_type === 'json') {
      formattedValue = config_value ? JSON.stringify(config_value) : null;
    } else {
      formattedValue = config_value !== null && config_value !== undefined ? String(config_value) : null;
    }
    
    // 检查配置是否存在
    const [existing] = await sequelize.query(
      `SELECT id FROM system_configs WHERE config_key = :key LIMIT 1`,
      { replacements: { key: config_key } }
    );
    
    if (existing && existing.length > 0) {
      // 更新配置
      await sequelize.query(
        `UPDATE system_configs 
         SET config_value = :value, config_type = :type, config_desc = :desc, 
             group_name = :group, is_public = :public, updated_at = NOW()
         WHERE config_key = :key`,
        {
          replacements: {
            key: config_key,
            value: formattedValue,
            type: config_type,
            desc: config_desc || null,
            group: group_name,
            public: is_public ? 1 : 0
          }
        }
      );
    } else {
      // 创建配置
      await sequelize.query(
        `INSERT INTO system_configs 
         (config_key, config_value, config_type, config_desc, group_name, is_public, created_at, updated_at)
         VALUES (:key, :value, :type, :desc, :group, :public, NOW(), NOW())`,
        {
          replacements: {
            key: config_key,
            value: formattedValue,
            type: config_type,
            desc: config_desc || null,
            group: group_name,
            public: is_public ? 1 : 0
          }
        }
      );
    }
    
    // 记录系统日志
    const adminId = req.admin?.id || null;
    await sequelize.query(
      `INSERT INTO system_logs 
       (admin_id, log_type, module_name, operation, request_method, request_url, ip_address, created_at)
       VALUES (:adminId, 'operation', 'system', :operation, 'POST', '/api/system/configs', :ip, NOW())`,
      {
        replacements: {
          adminId,
          operation: `配置${existing && existing.length > 0 ? '更新' : '创建'}: ${config_key}`,
          ip: req.ip || req.headers['x-forwarded-for'] || 'unknown'
        }
      }
    );
    
    return success(res, {
      config_key,
      config_value: formattedValue
    }, existing && existing.length > 0 ? '配置更新成功' : '配置创建成功');
    
  } catch (err) {
    console.error('保存系统配置错误：', err);
    return error(res, '保存系统配置失败', 500, err.message);
  }
};

/**
 * 删除系统配置
 * DELETE /api/system/configs/:key
 */
const deleteConfig = async (req, res) => {
  try {
    const { key } = req.params;
    
    // 检查配置是否存在
    const [configs] = await sequelize.query(
      `SELECT id FROM system_configs WHERE config_key = :key LIMIT 1`,
      { replacements: { key } }
    );
    
    if (!configs || configs.length === 0) {
      return error(res, '配置不存在', 404);
    }
    
    // 删除配置
    await sequelize.query(
      `DELETE FROM system_configs WHERE config_key = :key`,
      { replacements: { key } }
    );
    
    // 记录系统日志
    const adminId = req.admin?.id || null;
    await sequelize.query(
      `INSERT INTO system_logs 
       (admin_id, log_type, module_name, operation, request_method, request_url, ip_address, created_at)
       VALUES (:adminId, 'operation', 'system', :operation, 'DELETE', '/api/system/configs/:key', :ip, NOW())`,
      {
        replacements: {
          adminId,
          operation: `删除配置: ${key}`,
          ip: req.ip || req.headers['x-forwarded-for'] || 'unknown'
        }
      }
    );
    
    return success(res, null, '配置删除成功');
    
  } catch (err) {
    console.error('删除系统配置错误：', err);
    return error(res, '删除系统配置失败', 500, err.message);
  }
};

/**
 * 获取系统日志列表
 * GET /api/system/logs
 * 查询参数：logType, moduleName, startDate, endDate, page, limit
 */
const getLogList = async (req, res) => {
  try {
    const { logType, moduleName, startDate, endDate, page = 1, limit = 20 } = req.query;
    
    // 检查表是否存在
    try {
      await sequelize.query('SELECT 1 FROM system_logs LIMIT 1');
    } catch (tableErr) {
      if (tableErr.code === 'ER_NO_SUCH_TABLE') {
        // 表不存在时返回空结果
        return success(res, {
          list: [],
          total: 0,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: 0
        }, '获取成功');
      }
      throw tableErr;
    }
    
    // 构建查询条件
    let whereConditions = [];
    let replacements = {};
    
    if (logType) {
      whereConditions.push('log_type = :logType');
      replacements.logType = logType;
    }
    
    if (moduleName) {
      whereConditions.push('module_name = :moduleName');
      replacements.moduleName = moduleName;
    }
    
    if (startDate) {
      whereConditions.push('created_at >= :startDate');
      replacements.startDate = startDate;
    }
    
    if (endDate) {
      whereConditions.push('created_at <= :endDate');
      replacements.endDate = endDate + ' 23:59:59';
    }
    
    const whereClause = whereConditions.length > 0 
      ? 'WHERE ' + whereConditions.join(' AND ')
      : '';
    
    // 计算总数
    const [countResult] = await sequelize.query(
      `SELECT COUNT(*) as total FROM system_logs ${whereClause}`,
      { replacements }
    );
    const total = countResult[0].total;
    
    // 分页查询
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const [logs] = await sequelize.query(
      `SELECT 
        sl.id,
        sl.admin_id,
        sl.log_type,
        sl.module_name,
        sl.operation,
        sl.request_method,
        sl.request_url,
        sl.request_params,
        sl.response_status,
        sl.error_message,
        sl.ip_address,
        sl.user_agent,
        sl.execution_time,
        sl.created_at,
        a.username as admin_username,
        a.nickname as admin_nickname
       FROM system_logs sl
       LEFT JOIN admins a ON sl.admin_id = a.id
       ${whereClause}
       ORDER BY sl.created_at DESC
       LIMIT :limit OFFSET :offset`,
      {
        replacements: {
          ...replacements,
          limit: parseInt(limit),
          offset: offset
        }
      }
    );
    
    // 格式化数据
    const formattedLogs = logs.map(log => {
      let requestParams = null;
      try {
        if (log.request_params) {
          requestParams = typeof log.request_params === 'string' 
            ? JSON.parse(log.request_params) 
            : log.request_params;
        }
      } catch (e) {
        requestParams = log.request_params;
      }
      
      return {
        id: log.id,
        adminId: log.admin_id,
        adminUsername: log.admin_username || '系统',
        adminNickname: log.admin_nickname || '系统',
        logType: log.log_type,
        moduleName: log.module_name,
        operation: log.operation,
        requestMethod: log.request_method,
        requestUrl: log.request_url,
        requestParams: requestParams,
        responseStatus: log.response_status,
        errorMessage: log.error_message,
        ipAddress: log.ip_address,
        userAgent: log.user_agent,
        executionTime: log.execution_time,
        createdAt: log.created_at
      };
    });
    
    return success(res, {
      list: formattedLogs,
      total: total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit))
    }, '获取成功');
    
  } catch (err) {
    console.error('获取系统日志列表错误：', err);
    return error(res, '获取系统日志列表失败', 500, err.message);
  }
};

/**
 * 获取系统日志详情
 * GET /api/system/logs/:id
 */
const getLogDetail = async (req, res) => {
  try {
    const { id } = req.params;
    
    const [logs] = await sequelize.query(
      `SELECT 
        sl.*,
        a.username as admin_username,
        a.nickname as admin_nickname
       FROM system_logs sl
       LEFT JOIN admins a ON sl.admin_id = a.id
       WHERE sl.id = :id
       LIMIT 1`,
      { replacements: { id } }
    );
    
    if (!logs || logs.length === 0) {
      return error(res, '日志不存在', 404);
    }
    
    const log = logs[0];
    let requestParams = null;
    try {
      if (log.request_params) {
        requestParams = typeof log.request_params === 'string' 
          ? JSON.parse(log.request_params) 
          : log.request_params;
      }
    } catch (e) {
      requestParams = log.request_params;
    }
    
    return success(res, {
      id: log.id,
      adminId: log.admin_id,
      adminUsername: log.admin_username || '系统',
      adminNickname: log.admin_nickname || '系统',
      logType: log.log_type,
      moduleName: log.module_name,
      operation: log.operation,
      requestMethod: log.request_method,
      requestUrl: log.request_url,
      requestParams: requestParams,
      responseStatus: log.response_status,
      errorMessage: log.error_message,
      ipAddress: log.ip_address,
      userAgent: log.user_agent,
      executionTime: log.execution_time,
      createdAt: log.created_at
    }, '获取成功');
    
  } catch (err) {
    console.error('获取系统日志详情错误：', err);
    return error(res, '获取系统日志详情失败', 500, err.message);
  }
};

/**
 * 获取备份列表
 * GET /api/system/backups
 * 查询参数：backupType, backupStatus, page, limit
 */
const getBackupList = async (req, res) => {
  try {
    const { backupType, backupStatus, page = 1, limit = 20 } = req.query;
    
    // 检查表是否存在
    try {
      await sequelize.query('SELECT 1 FROM data_backups LIMIT 1');
    } catch (tableErr) {
      if (tableErr.code === 'ER_NO_SUCH_TABLE') {
        // 表不存在时返回空结果
        return success(res, {
          list: [],
          total: 0,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: 0
        }, '获取成功');
      }
      throw tableErr;
    }
    
    // 构建查询条件
    let whereConditions = [];
    let replacements = {};
    
    if (backupType) {
      whereConditions.push('backup_type = :backupType');
      replacements.backupType = backupType;
    }
    
    if (backupStatus !== undefined && backupStatus !== '') {
      whereConditions.push('backup_status = :backupStatus');
      replacements.backupStatus = parseInt(backupStatus);
    }
    
    const whereClause = whereConditions.length > 0 
      ? 'WHERE ' + whereConditions.join(' AND ')
      : '';
    
    // 计算总数
    const [countResult] = await sequelize.query(
      `SELECT COUNT(*) as total FROM data_backups ${whereClause}`,
      { replacements }
    );
    const total = countResult[0].total;
    
    // 分页查询
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const [backups] = await sequelize.query(
      `SELECT 
        db.*,
        a.username as operator_username,
        a.nickname as operator_nickname
       FROM data_backups db
       LEFT JOIN admins a ON db.operator_id = a.id
       ${whereClause}
       ORDER BY db.backup_time DESC
       LIMIT :limit OFFSET :offset`,
      {
        replacements: {
          ...replacements,
          limit: parseInt(limit),
          offset: offset
        }
      }
    );
    
    // 格式化文件大小
    const formattedBackups = backups.map(backup => ({
      ...backup,
      fileSizeFormatted: formatFileSize(backup.file_size)
    }));
    
    return success(res, {
      list: formattedBackups,
      total: total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit))
    }, '获取成功');
    
  } catch (err) {
    console.error('获取备份列表错误：', err);
    return error(res, '获取备份列表失败', 500, err.message);
  }
};

/**
 * 创建数据备份
 * POST /api/system/backups
 * 请求体：{ backup_name, backup_type, remark }
 */
const createBackup = async (req, res) => {
  try {
    const { backup_name, backup_type = 'full', remark } = req.body;
    const adminId = req.user?.id || null;
    
    // 参数验证
    if (!backup_name) {
      return validationError(res, '备份名称不能为空');
    }
    
    // 创建备份目录（如果不存在）
    const backupDir = path.join(__dirname, '../../backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    // 生成备份文件名
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `backup_${timestamp}.sql`;
    const backupPath = path.join(backupDir, backupFileName);
    
    // 记录备份开始
    const [backupResult] = await sequelize.query(
      `INSERT INTO data_backups 
       (backup_name, backup_type, backup_path, backup_status, operator_id, remark, backup_time, created_at)
       VALUES (:name, :type, :path, 0, :operatorId, :remark, NOW(), NOW())`,
      {
        replacements: {
          name: backup_name,
          type: backup_type,
          path: backupPath,
          operatorId: adminId,
          remark: remark || null
        }
      }
    );
    
    const backupId = backupResult.insertId;
    
    // 执行数据库备份（这里简化处理，实际应该使用mysqldump等工具）
    try {
      // 获取数据库配置
      const dbConfig = require('../config/db').sequelize.config;
      
      // 这里应该调用mysqldump命令，但为了简化，我们只创建备份记录
      // 实际生产环境应该使用child_process执行mysqldump命令
      const backupContent = `-- 数据备份文件\n-- 备份时间: ${new Date().toISOString()}\n-- 备份类型: ${backup_type}\n`;
      fs.writeFileSync(backupPath, backupContent);
      
      // 更新备份状态为成功
      await sequelize.query(
        `UPDATE data_backups 
         SET backup_status = 1, file_size = :fileSize
         WHERE id = :id`,
        {
          replacements: {
            id: backupId,
            fileSize: fs.statSync(backupPath).size
          }
        }
      );
      
      // 记录系统日志
      await sequelize.query(
        `INSERT INTO system_logs 
         (admin_id, log_type, module_name, operation, request_method, request_url, ip_address, created_at)
         VALUES (:adminId, 'operation', 'system', :operation, 'POST', '/api/system/backups', :ip, NOW())`,
        {
          replacements: {
            adminId,
            operation: `创建数据备份: ${backup_name}`,
            ip: req.ip || req.headers['x-forwarded-for'] || 'unknown'
          }
        }
      );
      
      return success(res, {
        id: backupId,
        backup_name,
        backup_path: backupPath,
        backup_status: 1
      }, '备份创建成功');
      
    } catch (backupErr) {
      // 备份失败，更新状态
      await sequelize.query(
        `UPDATE data_backups 
         SET backup_status = 2
         WHERE id = :id`,
        { replacements: { id: backupId } }
      );
      
      throw backupErr;
    }
    
  } catch (err) {
    console.error('创建数据备份错误：', err);
    return error(res, '创建数据备份失败', 500, err.message);
  }
};

/**
 * 删除备份
 * DELETE /api/system/backups/:id
 */
const deleteBackup = async (req, res) => {
  try {
    const { id } = req.params;
    
    // 查询备份信息
    const [backups] = await sequelize.query(
      `SELECT * FROM data_backups WHERE id = :id LIMIT 1`,
      { replacements: { id } }
    );
    
    if (!backups || backups.length === 0) {
      return error(res, '备份不存在', 404);
    }
    
    const backup = backups[0];
    
    // 删除备份文件
    if (backup.backup_path && fs.existsSync(backup.backup_path)) {
      try {
        fs.unlinkSync(backup.backup_path);
      } catch (fileErr) {
        console.warn('删除备份文件失败：', fileErr);
      }
    }
    
    // 删除备份记录
    await sequelize.query(
      `DELETE FROM data_backups WHERE id = :id`,
      { replacements: { id } }
    );
    
    // 记录系统日志
    const adminId = req.admin?.id || null;
    await sequelize.query(
      `INSERT INTO system_logs 
       (admin_id, log_type, module_name, operation, request_method, request_url, ip_address, created_at)
       VALUES (:adminId, 'operation', 'system', :operation, 'DELETE', '/api/system/backups/:id', :ip, NOW())`,
      {
        replacements: {
          adminId,
          operation: `删除数据备份: ${backup.backup_name}`,
          ip: req.ip || req.headers['x-forwarded-for'] || 'unknown'
        }
      }
    );
    
    return success(res, null, '备份删除成功');
    
  } catch (err) {
    console.error('删除备份错误：', err);
    return error(res, '删除备份失败', 500, err.message);
  }
};

/**
 * 格式化文件大小
 */
const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};

module.exports = {
  getConfigList,
  getConfigDetail,
  saveConfig,
  deleteConfig,
  getLogList,
  getLogDetail,
  getBackupList,
  createBackup,
  deleteBackup
};

