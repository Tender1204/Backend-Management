/**
 * 控制台控制器
 * 提供数据看板相关的统计接口
 */

const { sequelize } = require('../config/db');
const { success, error } = require('../utils/response');

/**
 * 获取核心指标数据
 * GET /api/dashboard/indicators
 * 查询参数：period (today/week/month)
 */
const getIndicators = async (req, res) => {
  try {
    const { period = 'today' } = req.query;
    
    // 根据周期计算时间范围
    let startDate, endDate, dateLabel;
    const now = new Date();
    
    switch (period) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        dateLabel = '今日';
        break;
      case 'week':
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay()); // 本周一
        weekStart.setHours(0, 0, 0, 0);
        startDate = weekStart;
        endDate = new Date(weekStart);
        endDate.setDate(weekStart.getDate() + 7);
        dateLabel = '本周';
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        dateLabel = '本月';
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        dateLabel = '今日';
    }
    
    // 1. 总用户数 + 今日新增
    let totalUsers = 0;
    let newUsers = 0;
    try {
      const [totalUsersResult] = await sequelize.query(
        `SELECT COUNT(*) as total FROM users WHERE status = 1`
      );
      totalUsers = totalUsersResult[0]?.total || 0;
      
      const [newUsersResult] = await sequelize.query(
        `SELECT COUNT(*) as count FROM users 
         WHERE register_time >= :startDate AND register_time < :endDate`,
        {
          replacements: { 
            startDate: startDate.toISOString().slice(0, 19).replace('T', ' '),
            endDate: endDate.toISOString().slice(0, 19).replace('T', ' ')
          }
        }
      );
      newUsers = newUsersResult[0]?.count || 0;
    } catch (err) {
      console.error('获取用户数据失败：', err);
      // 如果users表不存在，使用默认值0
      if (err.name === 'SequelizeDatabaseError' && err.parent?.code === 'ER_NO_SUCH_TABLE') {
        console.warn('users 表不存在，使用默认值0');
        totalUsers = 0;
        newUsers = 0;
      } else {
        throw err; // 其他错误继续抛出
      }
    }
    
    // 2. 活跃用户数（有行为记录的用户，如果表不存在，返回0）
    let activeUsers = 0;
    try {
      const [activeUsersResult] = await sequelize.query(
        `SELECT COUNT(DISTINCT user_id) as count FROM user_behavior_logs 
         WHERE created_at >= :startDate AND created_at < :endDate AND user_id IS NOT NULL`,
        {
          replacements: { 
            startDate: startDate.toISOString().slice(0, 19).replace('T', ' '),
            endDate: endDate.toISOString().slice(0, 19).replace('T', ' ')
          }
        }
      );
      activeUsers = activeUsersResult[0]?.count || 0;
    } catch (err) {
      // 如果表不存在，返回默认值0
      if (err.name === 'SequelizeDatabaseError' && err.parent?.code === 'ER_NO_SUCH_TABLE') {
        console.warn('user_behavior_logs 表不存在，使用默认值0');
        activeUsers = 0;
      } else {
        throw err; // 其他错误继续抛出
      }
    }
    
    // 3. 提醒触发率（规则执行记录完成率，如果表不存在，返回0）
    let reminderRate = 0;
    try {
      const [reminderResult] = await sequelize.query(
        `SELECT 
           COUNT(*) as total,
           SUM(CASE WHEN completion_rate >= 80 THEN 1 ELSE 0 END) as completed
         FROM user_rule_records 
         WHERE record_date >= DATE(:startDate) AND record_date < DATE(:endDate)`,
        {
          replacements: { 
            startDate: startDate.toISOString().slice(0, 10),
            endDate: endDate.toISOString().slice(0, 10)
          }
        }
      );
      const reminderTotal = reminderResult[0]?.total || 0;
      const reminderCompleted = reminderResult[0]?.completed || 0;
      reminderRate = reminderTotal > 0 ? ((reminderCompleted / reminderTotal) * 100).toFixed(1) : 0;
    } catch (err) {
      // 如果表不存在，返回默认值0
      if (err.name === 'SequelizeDatabaseError' && err.parent?.code === 'ER_NO_SUCH_TABLE') {
        console.warn('user_rule_records 表不存在，使用默认值0');
        reminderRate = 0;
      } else {
        throw err; // 其他错误继续抛出
      }
    }
    
    // 4. AI问答次数（如果表不存在，返回0）
    let aiQaCount = 0;
    try {
      const [aiQaResult] = await sequelize.query(
        `SELECT COUNT(*) as count FROM ai_qa_log 
         WHERE createTime >= :startDate AND createTime < :endDate`,
        {
          replacements: { 
            startDate: startDate.toISOString().slice(0, 19).replace('T', ' '),
            endDate: endDate.toISOString().slice(0, 19).replace('T', ' ')
          }
        }
      );
      aiQaCount = aiQaResult[0]?.count || 0;
    } catch (err) {
      // 如果表不存在，返回默认值0
      if (err.name === 'SequelizeDatabaseError' && err.parent?.code === 'ER_NO_SUCH_TABLE') {
        console.warn('ai_qa_log 表不存在，使用默认值0');
        aiQaCount = 0;
      } else {
        throw err; // 其他错误继续抛出
      }
    }
    
    // 5. 知识库内容数（如果表不存在，返回0）
    let knowledgeCount = 0;
    try {
      const [knowledgeResult] = await sequelize.query(
        `SELECT COUNT(*) as count FROM ai_knowledge_base WHERE status = 1`
      );
      knowledgeCount = knowledgeResult[0]?.count || 0;
    } catch (err) {
      // 如果表不存在，返回默认值0
      if (err.name === 'SequelizeDatabaseError' && err.parent?.code === 'ER_NO_SUCH_TABLE') {
        console.warn('ai_knowledge_base 表不存在，使用默认值0');
        knowledgeCount = 0;
      } else {
        throw err; // 其他错误继续抛出
      }
    }
    
    // 6. 系统运行状态（检查最近1小时是否有错误日志，如果表不存在，返回正常）
    let errorCount = 0;
    try {
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const [systemStatusResult] = await sequelize.query(
        `SELECT COUNT(*) as errorCount FROM system_logs 
         WHERE log_type = 'error' AND created_at >= :oneHourAgo`,
        {
          replacements: { 
            oneHourAgo: oneHourAgo.toISOString().slice(0, 19).replace('T', ' ')
          }
        }
      );
      errorCount = systemStatusResult[0]?.errorCount || 0;
    } catch (err) {
      // 如果表不存在，返回默认值0（系统正常）
      if (err.name === 'SequelizeDatabaseError' && err.parent?.code === 'ER_NO_SUCH_TABLE') {
        console.warn('system_logs 表不存在，使用默认值0（系统正常）');
        errorCount = 0;
      } else {
        throw err; // 其他错误继续抛出
      }
    }
    const systemStatus = errorCount === 0 ? '正常' : '异常';
    
    // 返回指标数据
    const indicators = {
      period: dateLabel,
      totalUsers: {
        value: totalUsers,
        new: newUsers,
        label: '总用户数',
        unit: '人',
        link: '/users/list'
      },
      activeUsers: {
        value: activeUsers,
        label: '活跃用户数',
        unit: '人',
        link: '/users/list?filter=active'
      },
      reminderRate: {
        value: parseFloat(reminderRate),
        label: '提醒触发率',
        unit: '%',
        link: '/rules/statistics'
      },
      aiQaCount: {
        value: aiQaCount,
        label: 'AI问答次数',
        unit: '次',
        link: '/ai/qa-log-config'
      },
      knowledgeCount: {
        value: knowledgeCount,
        label: '知识库内容数',
        unit: '条',
        link: '/ai/sync-knowledge'
      },
      systemStatus: {
        value: systemStatus,
        label: '系统运行状态',
        unit: '',
        link: '/system/logs',
        status: errorCount === 0 ? 'success' : 'danger'
      }
    };
    
    return success(res, indicators, '获取成功');
    
  } catch (err) {
    console.error('获取指标数据错误：', err);
    return error(res, '获取数据失败', 500, err.message);
  }
};

/**
 * 获取活跃度趋势数据
 * GET /api/dashboard/trend
 * 查询参数：period (today/week/month)
 */
const getTrend = async (req, res) => {
  try {
    const { period = 'today' } = req.query;
    
    // 根据周期计算时间范围和分组方式
    let startDate, endDate, groupBy;
    const now = new Date();
    
    switch (period) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        groupBy = 'HOUR'; // 按小时分组
        break;
      case 'week':
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        weekStart.setHours(0, 0, 0, 0);
        startDate = weekStart;
        endDate = new Date(weekStart);
        endDate.setDate(weekStart.getDate() + 7);
        groupBy = 'DAY'; // 按天分组
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        groupBy = 'DAY'; // 按天分组
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        groupBy = 'HOUR';
    }
    
    // 查询活跃度趋势（每日/每小时活跃用户数，如果表不存在，返回空数据）
    let times = [];
    let counts = [];
    
    try {
      let trendQuery;
      if (groupBy === 'HOUR') {
        trendQuery = `
          SELECT 
            DATE_FORMAT(created_at, '%Y-%m-%d %H:00') as time,
            COUNT(DISTINCT user_id) as count
          FROM user_behavior_logs
          WHERE created_at >= :startDate AND created_at < :endDate AND user_id IS NOT NULL
          GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d %H:00')
          ORDER BY time
        `;
      } else {
        trendQuery = `
          SELECT 
            DATE(created_at) as time,
            COUNT(DISTINCT user_id) as count
          FROM user_behavior_logs
          WHERE created_at >= :startDate AND created_at < :endDate AND user_id IS NOT NULL
          GROUP BY DATE(created_at)
          ORDER BY time
        `;
      }
      
      const [trendData] = await sequelize.query(trendQuery, {
        replacements: { 
          startDate: startDate.toISOString().slice(0, 19).replace('T', ' '),
          endDate: endDate.toISOString().slice(0, 19).replace('T', ' ')
        }
      });
      
      // 格式化数据供ECharts使用
      times = trendData.map(item => item.time);
      counts = trendData.map(item => parseInt(item.count) || 0);
    } catch (err) {
      // 如果表不存在，返回空数据
      if (err.name === 'SequelizeDatabaseError' && err.parent?.code === 'ER_NO_SUCH_TABLE') {
        console.warn('user_behavior_logs 表不存在，返回空趋势数据');
        times = [];
        counts = [];
      } else {
        throw err; // 其他错误继续抛出
      }
    }
    
    return success(res, {
      times,
      counts,
      period: period
    }, '获取成功');
    
  } catch (err) {
    console.error('获取趋势数据错误：', err);
    return error(res, '获取数据失败', 500, err.message);
  }
};

/**
 * 获取功能使用率数据（饼图）
 * GET /api/dashboard/usage
 * 查询参数：period (today/week/month)
 */
const getUsage = async (req, res) => {
  try {
    const { period = 'today' } = req.query;
    
    // 根据周期计算时间范围
    let startDate, endDate;
    const now = new Date();
    
    switch (period) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        break;
      case 'week':
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        weekStart.setHours(0, 0, 0, 0);
        startDate = weekStart;
        endDate = new Date(weekStart);
        endDate.setDate(weekStart.getDate() + 7);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    }
    
    // 查询各功能模块的使用次数（如果表不存在，返回默认数据）
    let data = [];
    
    try {
      const [usageData] = await sequelize.query(
        `SELECT 
           module_name,
           COUNT(*) as count
         FROM user_behavior_logs
         WHERE created_at >= :startDate AND created_at < :endDate 
           AND module_name IS NOT NULL
         GROUP BY module_name
         ORDER BY count DESC
         LIMIT 10`,
        {
          replacements: { 
            startDate: startDate.toISOString().slice(0, 19).replace('T', ' '),
            endDate: endDate.toISOString().slice(0, 19).replace('T', ' ')
          }
        }
      );
      
      // 格式化数据供ECharts使用
      data = usageData.map(item => ({
        name: item.module_name || '其他',
        value: parseInt(item.count) || 0
      }));
    } catch (err) {
      // 如果表不存在，返回默认数据
      if (err.name === 'SequelizeDatabaseError' && err.parent?.code === 'ER_NO_SUCH_TABLE') {
        console.warn('user_behavior_logs 表不存在，返回默认使用率数据');
      } else {
        throw err; // 其他错误继续抛出
      }
    }
    
    // 如果没有数据，返回默认数据
    if (data.length === 0) {
      data = [
        { name: '用户管理', value: 0 },
        { name: '健康规则', value: 0 },
        { name: '内容管理', value: 0 },
        { name: 'AI问答', value: 0 }
      ];
    }
    
    return success(res, {
      data,
      period: period
    }, '获取成功');
    
  } catch (err) {
    console.error('获取使用率数据错误：', err);
    return error(res, '获取数据失败', 500, err.message);
  }
};

/**
 * 获取内容推送完成率数据
 * GET /api/dashboard/push-rate
 * 查询参数：period (today/week/month)
 */
const getPushRate = async (req, res) => {
  try {
    const { period = 'today' } = req.query;
    
    // 根据周期计算时间范围
    let startDate, endDate;
    const now = new Date();
    
    switch (period) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        break;
      case 'week':
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        weekStart.setHours(0, 0, 0, 0);
        startDate = weekStart;
        endDate = new Date(weekStart);
        endDate.setDate(weekStart.getDate() + 7);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    }
    
    // 查询内容推送完成率（按日期统计）
    const [pushData] = await sequelize.query(
      `SELECT 
         DATE(created_at) as date,
         COUNT(*) as total,
         SUM(CASE WHEN push_status = 1 THEN 1 ELSE 0 END) as completed
       FROM content_push_configs
       WHERE created_at >= :startDate AND created_at < :endDate
       GROUP BY DATE(created_at)
       ORDER BY date`,
      {
        replacements: { 
          startDate: startDate.toISOString().slice(0, 19).replace('T', ' '),
          endDate: endDate.toISOString().slice(0, 19).replace('T', ' ')
        }
      }
    );
    
    // 格式化数据
    const dates = pushData.map(item => item.date);
    const rates = pushData.map(item => {
      const total = parseInt(item.total) || 0;
      const completed = parseInt(item.completed) || 0;
      return total > 0 ? ((completed / total) * 100).toFixed(1) : 0;
    });
    
    // 计算平均完成率
    const avgRate = pushData.length > 0 
      ? (pushData.reduce((sum, item) => {
          const total = parseInt(item.total) || 0;
          const completed = parseInt(item.completed) || 0;
          return sum + (total > 0 ? (completed / total) * 100 : 0);
        }, 0) / pushData.length).toFixed(1)
      : 0;
    
    return success(res, {
      dates,
      rates: rates.map(r => parseFloat(r)),
      avgRate: parseFloat(avgRate),
      period: period
    }, '获取成功');
    
  } catch (err) {
    console.error('获取推送完成率错误：', err);
    return error(res, '获取数据失败', 500, err.message);
  }
};

/**
 * 获取健康数据记录率
 * GET /api/dashboard/health-record-rate
 * 查询参数：period (today/week/month)
 */
const getHealthRecordRate = async (req, res) => {
  try {
    const { period = 'today' } = req.query;
    
    // 根据周期计算时间范围
    let startDate, endDate;
    const now = new Date();
    
    switch (period) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        break;
      case 'week':
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        weekStart.setHours(0, 0, 0, 0);
        startDate = weekStart;
        endDate = new Date(weekStart);
        endDate.setDate(weekStart.getDate() + 7);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    }
    
    // 查询健康数据记录率（按规则类型统计）
    const [recordData] = await sequelize.query(
      `SELECT 
         rt.type_name,
         COUNT(DISTINCT urr.user_id) as userCount,
         COUNT(urr.id) as recordCount,
         AVG(urr.completion_rate) as avgRate
       FROM user_rule_records urr
       JOIN rule_types rt ON urr.rule_type_id = rt.id
       WHERE urr.record_date >= DATE(:startDate) AND urr.record_date < DATE(:endDate)
       GROUP BY rt.id, rt.type_name
       ORDER BY recordCount DESC`,
      {
        replacements: { 
          startDate: startDate.toISOString().slice(0, 10),
          endDate: endDate.toISOString().slice(0, 10)
        }
      }
    );
    
    // 格式化数据
    const categories = recordData.map(item => item.type_name);
    const rates = recordData.map(item => parseFloat(item.avgRate) || 0);
    const recordCounts = recordData.map(item => parseInt(item.recordCount) || 0);
    
    return success(res, {
      categories,
      rates,
      recordCounts,
      period: period
    }, '获取成功');
    
  } catch (err) {
    console.error('获取健康数据记录率错误：', err);
    return error(res, '获取数据失败', 500, err.message);
  }
};

/**
 * 获取核心指标周期对比
 * GET /api/dashboard/compare
 */
const getCompare = async (req, res) => {
  try {
    const now = new Date();
    
    // 计算三个周期的时间范围
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);
    
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    
    // 获取三个周期的数据
    const periods = [
      { name: '今日', start: todayStart, end: todayEnd },
      { name: '本周', start: weekStart, end: weekEnd },
      { name: '本月', start: monthStart, end: monthEnd }
    ];
    
    const compareData = [];
    
    for (const period of periods) {
      // 活跃用户数
      const [activeResult] = await sequelize.query(
        `SELECT COUNT(DISTINCT user_id) as count FROM user_behavior_logs 
         WHERE created_at >= :start AND created_at < :end AND user_id IS NOT NULL`,
        {
          replacements: { 
            start: period.start.toISOString().slice(0, 19).replace('T', ' '),
            end: period.end.toISOString().slice(0, 19).replace('T', ' ')
          }
        }
      );
      
      // AI问答次数（如果表不存在，返回0）
      let aiQaCount = 0;
      try {
        const [aiResult] = await sequelize.query(
          `SELECT COUNT(*) as count FROM ai_qa_log 
           WHERE createTime >= :start AND createTime < :end`,
          {
            replacements: { 
              start: period.start.toISOString().slice(0, 19).replace('T', ' '),
              end: period.end.toISOString().slice(0, 19).replace('T', ' ')
            }
          }
        );
        aiQaCount = parseInt(aiResult[0]?.count) || 0;
      } catch (err) {
        // 如果表不存在，返回默认值0
        if (err.name === 'SequelizeDatabaseError' && err.parent?.code === 'ER_NO_SUCH_TABLE') {
          console.warn('ai_qa_log 表不存在，使用默认值0');
          aiQaCount = 0;
        } else {
          throw err; // 其他错误继续抛出
        }
      }
      
      // 提醒触发率
      const [reminderResult] = await sequelize.query(
        `SELECT 
           COUNT(*) as total,
           SUM(CASE WHEN completion_rate >= 80 THEN 1 ELSE 0 END) as completed
         FROM user_rule_records 
         WHERE record_date >= DATE(:start) AND record_date < DATE(:end)`,
        {
          replacements: { 
            start: period.start.toISOString().slice(0, 10),
            end: period.end.toISOString().slice(0, 10)
          }
        }
      );
      
      const reminderTotal = reminderResult[0]?.total || 0;
      const reminderCompleted = reminderResult[0]?.completed || 0;
      const reminderRate = reminderTotal > 0 ? ((reminderCompleted / reminderTotal) * 100).toFixed(1) : 0;
      
      compareData.push({
        period: period.name,
        activeUsers: parseInt(activeResult[0]?.count) || 0,
        aiQaCount: aiQaCount,
        reminderRate: parseFloat(reminderRate)
      });
    }
    
    return success(res, {
      periods: compareData.map(d => d.period),
      activeUsers: compareData.map(d => d.activeUsers),
      aiQaCount: compareData.map(d => d.aiQaCount),
      reminderRate: compareData.map(d => d.reminderRate)
    }, '获取成功');
    
  } catch (err) {
    console.error('获取周期对比数据错误：', err);
    return error(res, '获取数据失败', 500, err.message);
  }
};

module.exports = {
  getIndicators,
  getTrend,
  getUsage,
  getPushRate,
  getHealthRecordRate,
  getCompare
};

