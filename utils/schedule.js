/**
 * 定时任务工具类
 * 用于自动更新规则版本的生效状态
 * 
 * 业务价值：自动管理版本状态流转，减少人工维护成本，确保规则及时生效/过期
 */

const schedule = require('node-schedule');
const { sequelize } = require('../config/db');

/**
 * 更新版本生效状态
 * 基于effectTime和当前时间，自动更新版本状态：
 * - 未生效 → 已生效（当effectTime <= 当前时间）
 * - 已生效 → 已过期（当expireTime <= 当前时间）
 */
const updateVersionStatus = async () => {
  try {
    // 先检查表是否存在（禁用日志输出，避免频繁打印）
    let tableExists = false;
    try {
      await sequelize.query('SELECT 1 FROM rule_version LIMIT 1', {
        logging: false // 禁用此查询的日志输出
      });
      tableExists = true;
    } catch (tableErr) {
      // 表不存在时，静默返回，不执行更新
      if (tableErr.code === 'ER_NO_SUCH_TABLE') {
        // 表不存在，这是正常的（可能还未执行数据库迁移），静默处理
        return;
      }
      throw tableErr; // 其他错误继续抛出
    }
    
    // 如果表不存在，直接返回
    if (!tableExists) {
      return;
    }
    
    // 先检查是否有需要更新的记录，避免不必要的UPDATE操作（禁用日志输出）
    const now = new Date();
    const nowStr = now.toISOString().slice(0, 19).replace('T', ' ');
    
    // 检查是否有需要更新的记录
    const [checkResult] = await sequelize.query(
      `SELECT COUNT(*) as count FROM rule_version 
       WHERE (effect_status = 0 AND effect_time IS NOT NULL AND effect_time <= :now)
          OR (effect_status = 1 AND expire_time IS NOT NULL AND expire_time <= :now)`,
      {
        replacements: { now: nowStr },
        logging: false // 禁用此查询的日志输出
      }
    );
    
    // 如果没有需要更新的记录，直接返回，避免执行UPDATE
    if (checkResult[0].count === 0) {
      return;
    }
    
    // 1. 将到期的"未生效"版本更新为"已生效"（禁用日志输出）
    await sequelize.query(
      `UPDATE rule_version 
       SET effect_status = 1, updated_at = NOW()
       WHERE effect_status = 0 
         AND effect_time IS NOT NULL 
         AND effect_time <= :now`,
      {
        replacements: { now: nowStr },
        logging: false // 禁用此查询的日志输出
      }
    );
    
    // 2. 将到期的"已生效"版本更新为"已过期"（禁用日志输出）
    await sequelize.query(
      `UPDATE rule_version 
       SET effect_status = 2, updated_at = NOW()
       WHERE effect_status = 1 
         AND expire_time IS NOT NULL 
         AND expire_time <= :now`,
      {
        replacements: { now: nowStr },
        logging: false // 禁用此查询的日志输出
      }
    );
    
    // 静默执行，不输出日志（避免日志过多）
  } catch (err) {
    // 表不存在错误不记录，其他错误才记录
    if (err.code !== 'ER_NO_SUCH_TABLE') {
      // 只在开发环境输出错误日志
      if (process.env.NODE_ENV === 'development') {
        console.error('[定时任务] 版本状态更新失败：', err.message);
      }
    }
  }
};

/**
 * 启动定时任务
 * 每5分钟执行一次，检查并更新版本状态
 * 优化：减少执行频率，避免频繁查询数据库
 */
const startSchedule = () => {
  // 每5分钟的第0秒执行（减少执行频率）
  schedule.scheduleJob('0 */5 * * * *', updateVersionStatus);
  // 静默启动，不输出日志（避免启动时日志过多）
  // console.log('[定时任务] 版本状态自动更新任务已启动（每5分钟执行一次）');
  
  // 延迟执行一次（给数据库连接时间）
  setTimeout(() => {
    updateVersionStatus();
  }, 2000);
};

/**
 * 停止定时任务
 */
const stopSchedule = () => {
  schedule.gracefulShutdown();
  console.log('[定时任务] 已停止');
};

module.exports = {
  startSchedule,
  stopSchedule,
  updateVersionStatus
};

