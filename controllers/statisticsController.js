/**
 * 数据统计分析控制器
 * 提供数据统计分析相关的接口
 */

const { sequelize } = require('../config/db');
const { success, error } = require('../utils/response');

/**
 * 全局指标分析
 * GET /api/statistics/global-indicators
 * 查询参数：period (day/week/month), indicators (逗号分隔的指标列表，如：totalUsers,activeUsers,aiQaCount)
 * 返回：总用户数、活跃用户数、AI问答次数等指标的趋势数据
 */
const getGlobalIndicators = async (req, res) => {
  try {
    const { period = 'day', indicators = 'totalUsers,activeUsers,aiQaCount' } = req.query;
    
    // 解析指标列表
    const indicatorList = indicators.split(',').map(i => i.trim());
    
    // 根据周期计算时间范围和分组方式
    let startDate, endDate, groupBy, dateFormat;
    const now = new Date();
    
    switch (period) {
      case 'day':
        // 最近30天
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 30);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
        groupBy = 'DAY';
        dateFormat = '%Y-%m-%d';
        break;
      case 'week':
        // 最近12周
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 84); // 12周
        startDate.setDate(startDate.getDate() - startDate.getDay()); // 本周一
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
        groupBy = 'WEEK';
        dateFormat = '%Y-%u'; // 年-周数
        break;
      case 'month':
        // 最近12个月
        startDate = new Date(now.getFullYear(), now.getMonth() - 11, 1);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
        groupBy = 'MONTH';
        dateFormat = '%Y-%m';
        break;
      default:
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 30);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
        groupBy = 'DAY';
        dateFormat = '%Y-%m-%d';
    }
    
    const result = {
      period,
      dates: [],
      indicators: {}
    };
    
    // 用于存储每个指标的日期-值映射
    const indicatorDateValueMap = {};
    
    // 1. 总用户数趋势（累计）
    if (indicatorList.includes('totalUsers')) {
      let totalUsersQuery;
      if (groupBy === 'DAY') {
        totalUsersQuery = `
          SELECT 
            DATE(register_time) as date,
            COUNT(*) as count
          FROM users
          WHERE register_time <= :endDate AND status = 1
          GROUP BY DATE(register_time)
          ORDER BY date
        `;
      } else if (groupBy === 'WEEK') {
        totalUsersQuery = `
          SELECT 
            DATE_FORMAT(register_time, '%Y-%u') as date,
            COUNT(*) as count
          FROM users
          WHERE register_time <= :endDate AND status = 1
          GROUP BY DATE_FORMAT(register_time, '%Y-%u')
          ORDER BY date
        `;
      } else {
        totalUsersQuery = `
          SELECT 
            DATE_FORMAT(register_time, '%Y-%m') as date,
            COUNT(*) as count
          FROM users
          WHERE register_time <= :endDate AND status = 1
          GROUP BY DATE_FORMAT(register_time, '%Y-%m')
          ORDER BY date
        `;
      }
      
      const [totalUsersData] = await sequelize.query(totalUsersQuery, {
        replacements: {
          endDate: endDate.toISOString().slice(0, 19).replace('T', ' ')
        }
      });
      
      // 转换为累计值并建立日期到累计值的映射
      let cumulative = 0;
      const dates = [];
      const totalUsersMap = {};
      
      // 确保totalUsersData是数组
      const totalUsersDataArray = Array.isArray(totalUsersData) ? totalUsersData : [];
      
      totalUsersDataArray.forEach(item => {
        cumulative += parseInt(item.count) || 0;
        totalUsersMap[item.date] = cumulative;
        if (!dates.includes(item.date)) {
          dates.push(item.date);
        }
      });
      
      indicatorDateValueMap.totalUsers = { dates, map: totalUsersMap };
      result.indicators.totalUsers = {
        label: '总用户数',
        unit: '人',
        values: [] // 将在日期对齐时填充
      };
    }
    
    // 2. 活跃用户数趋势
    if (indicatorList.includes('activeUsers')) {
      let activeUsersQuery;
      if (groupBy === 'DAY') {
        activeUsersQuery = `
          SELECT 
            DATE(created_at) as date,
            COUNT(DISTINCT user_id) as count
          FROM user_behavior_logs
          WHERE created_at >= :startDate AND created_at <= :endDate AND user_id IS NOT NULL
          GROUP BY DATE(created_at)
          ORDER BY date
        `;
      } else if (groupBy === 'WEEK') {
        activeUsersQuery = `
          SELECT 
            DATE_FORMAT(created_at, '%Y-%u') as date,
            COUNT(DISTINCT user_id) as count
          FROM user_behavior_logs
          WHERE created_at >= :startDate AND created_at <= :endDate AND user_id IS NOT NULL
          GROUP BY DATE_FORMAT(created_at, '%Y-%u')
          ORDER BY date
        `;
      } else {
        activeUsersQuery = `
          SELECT 
            DATE_FORMAT(created_at, '%Y-%m') as date,
            COUNT(DISTINCT user_id) as count
          FROM user_behavior_logs
          WHERE created_at >= :startDate AND created_at <= :endDate AND user_id IS NOT NULL
          GROUP BY DATE_FORMAT(created_at, '%Y-%m')
          ORDER BY date
        `;
      }
      
      const [activeUsersData] = await sequelize.query(activeUsersQuery, {
        replacements: {
          startDate: startDate.toISOString().slice(0, 19).replace('T', ' '),
          endDate: endDate.toISOString().slice(0, 19).replace('T', ' ')
        }
      });
      
      // 确保activeUsersData是数组
      const activeUsersDataArray = Array.isArray(activeUsersData) ? activeUsersData : [];
      
      const activeUsersMap = {};
      activeUsersDataArray.forEach(item => {
        activeUsersMap[item.date] = parseInt(item.count) || 0;
      });
      const activeUsersDates = activeUsersDataArray.map(item => item.date);
      
      indicatorDateValueMap.activeUsers = { dates: activeUsersDates, map: activeUsersMap };
      result.indicators.activeUsers = {
        label: '活跃用户数',
        unit: '人',
        values: activeUsersDataArray.map(item => parseInt(item.count) || 0)
      };
    }
    
    // 3. AI问答次数趋势
    if (indicatorList.includes('aiQaCount')) {
      try {
        let aiQaQuery;
        if (groupBy === 'DAY') {
          aiQaQuery = `
            SELECT 
              DATE(createTime) as date,
              COUNT(*) as count
            FROM ai_qa_log
            WHERE createTime >= :startDate AND createTime <= :endDate
            GROUP BY DATE(createTime)
            ORDER BY date
          `;
        } else if (groupBy === 'WEEK') {
          aiQaQuery = `
            SELECT 
              DATE_FORMAT(createTime, '%Y-%u') as date,
              COUNT(*) as count
            FROM ai_qa_log
            WHERE createTime >= :startDate AND createTime <= :endDate
            GROUP BY DATE_FORMAT(createTime, '%Y-%u')
            ORDER BY date
          `;
        } else {
          aiQaQuery = `
            SELECT 
              DATE_FORMAT(createTime, '%Y-%m') as date,
              COUNT(*) as count
            FROM ai_qa_log
            WHERE createTime >= :startDate AND createTime <= :endDate
            GROUP BY DATE_FORMAT(createTime, '%Y-%m')
            ORDER BY date
          `;
        }
        
        const [aiQaData] = await sequelize.query(aiQaQuery, {
          replacements: {
            startDate: startDate.toISOString().slice(0, 19).replace('T', ' '),
            endDate: endDate.toISOString().slice(0, 19).replace('T', ' ')
          }
        });
        
        // 确保aiQaData是数组
        const aiQaDataArray = Array.isArray(aiQaData) ? aiQaData : [];
        
        const aiQaMap = {};
        aiQaDataArray.forEach(item => {
          aiQaMap[item.date] = parseInt(item.count) || 0;
        });
        const aiQaDates = aiQaDataArray.map(item => item.date);
        
        indicatorDateValueMap.aiQaCount = { dates: aiQaDates, map: aiQaMap };
        result.indicators.aiQaCount = {
          label: 'AI问答次数',
          unit: '次',
          values: aiQaDataArray.map(item => parseInt(item.count) || 0)
        };
      } catch (err) {
        // 如果表不存在或其他错误，返回空数据
        if (err.name === 'SequelizeDatabaseError' && err.parent && err.parent.code === 'ER_NO_SUCH_TABLE') {
          console.warn('警告：ai_qa_log 表不存在，跳过AI问答次数统计');
          indicatorDateValueMap.aiQaCount = { dates: [], map: {} };
          result.indicators.aiQaCount = {
            label: 'AI问答次数',
            unit: '次',
            values: []
          };
        } else {
          // 其他错误继续抛出
          throw err;
        }
      }
    }
    
    // 4. 新增用户数趋势
    if (indicatorList.includes('newUsers')) {
      let newUsersQuery;
      if (groupBy === 'DAY') {
        newUsersQuery = `
          SELECT 
            DATE(register_time) as date,
            COUNT(*) as count
          FROM users
          WHERE register_time >= :startDate AND register_time <= :endDate AND status = 1
          GROUP BY DATE(register_time)
          ORDER BY date
        `;
      } else if (groupBy === 'WEEK') {
        newUsersQuery = `
          SELECT 
            DATE_FORMAT(register_time, '%Y-%u') as date,
            COUNT(*) as count
          FROM users
          WHERE register_time >= :startDate AND register_time <= :endDate AND status = 1
          GROUP BY DATE_FORMAT(register_time, '%Y-%u')
          ORDER BY date
        `;
      } else {
        newUsersQuery = `
          SELECT 
            DATE_FORMAT(register_time, '%Y-%m') as date,
            COUNT(*) as count
          FROM users
          WHERE register_time >= :startDate AND register_time <= :endDate AND status = 1
          GROUP BY DATE_FORMAT(register_time, '%Y-%m')
          ORDER BY date
        `;
      }
      
      const [newUsersData] = await sequelize.query(newUsersQuery, {
        replacements: {
          startDate: startDate.toISOString().slice(0, 19).replace('T', ' '),
          endDate: endDate.toISOString().slice(0, 19).replace('T', ' ')
        }
      });
      
      // 确保newUsersData是数组
      const newUsersDataArray = Array.isArray(newUsersData) ? newUsersData : [];
      
      const newUsersMap = {};
      newUsersDataArray.forEach(item => {
        newUsersMap[item.date] = parseInt(item.count) || 0;
      });
      const newUsersDates = newUsersDataArray.map(item => item.date);
      
      indicatorDateValueMap.newUsers = { dates: newUsersDates, map: newUsersMap };
      result.indicators.newUsers = {
        label: '新增用户数',
        unit: '人',
        values: newUsersDataArray.map(item => parseInt(item.count) || 0)
      };
    }
    
    // 如果没有任何数据，返回空结构
    if (Object.keys(result.indicators).length === 0) {
      return success(res, {
        period,
        dates: [],
        indicators: {}
      }, '暂无数据');
    }
    
    // 合并所有指标的日期
    const allDatesSet = new Set();
    Object.keys(indicatorDateValueMap).forEach(key => {
      const { dates } = indicatorDateValueMap[key];
      dates.forEach(date => allDatesSet.add(date));
    });
    
    // 排序日期列表
    const allDates = Array.from(allDatesSet).sort();
    
    // 如果合并后的日期列表为空，但指标有数据，说明日期处理有问题
    if (allDates.length === 0) {
      console.warn('警告：指标有数据但日期列表为空');
      return success(res, {
        period,
        dates: [],
        indicators: {}
      }, '暂无数据');
    }
    
    // 更新result.dates为合并后的完整日期列表
    result.dates = allDates;
    
    // 对齐所有指标的数据：按照合并后的日期列表，为每个指标补齐值
    Object.keys(result.indicators).forEach(key => {
      const indicator = result.indicators[key];
      const { map } = indicatorDateValueMap[key] || {};
      
      if (!map) {
        // 如果没有映射数据，说明这个指标没有数据，填充0
        indicator.values = new Array(allDates.length).fill(0);
        return;
      }
      
      // 按照合并后的日期列表，从映射中获取值
      const alignedValues = [];
      let lastValue = null; // 用于累计值（如总用户数），初始为null
      
      allDates.forEach(date => {
        if (map.hasOwnProperty(date)) {
          const value = map[date];
          alignedValues.push(value);
          // 对于总用户数，更新最后一个值（累计值）
          if (key === 'totalUsers') {
            lastValue = value;
          }
        } else {
          // 如果该日期没有数据，根据指标类型填充
          if (key === 'totalUsers') {
            // 总用户数是累计值，使用上一个值（如果还没有值，使用0）
            alignedValues.push(lastValue !== null ? lastValue : 0);
          } else {
            // 其他指标填充0
            alignedValues.push(0);
          }
        }
      });
      
      indicator.values = alignedValues;
    });
    
    return success(res, result, '获取成功');
    
  } catch (err) {
    console.error('获取全局指标数据错误：', err);
    return error(res, '获取数据失败', 500, err.message);
  }
};

/**
 * 用户维度分析
 * GET /api/statistics/user-dimension
 * 查询参数：dimension (gender/age/healthStatus), period (day/week/month)
 * 返回：按标签拆分的健康数据（平均步数/睡眠时长等）
 */
const getUserDimension = async (req, res) => {
  try {
    const { dimension = 'gender', period = 'month' } = req.query;
    
    // 根据周期计算时间范围
    let startDate, endDate;
    const now = new Date();
    
    switch (period) {
      case 'day':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7); // 最近7天
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'week':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 28); // 最近4周
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'month':
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 3); // 最近3个月
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
        break;
      default:
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 3);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
    }
    
    const result = {
      dimension,
      period,
      categories: [],
      data: {}
    };
    
    if (dimension === 'gender') {
      // 按性别分析
      const [genderData] = await sequelize.query(`
        SELECT 
          CASE 
            WHEN u.gender = 1 THEN '男'
            WHEN u.gender = 2 THEN '女'
            ELSE '未知'
          END as category,
          COUNT(DISTINCT u.id) as userCount,
          AVG(CASE WHEN rt.type_code = 'exercise' THEN urr.execution_count ELSE NULL END) as avgSteps,
          AVG(CASE WHEN rt.type_code = 'sleep' THEN urr.execution_count ELSE NULL END) as avgSleepHours,
          AVG(CASE WHEN rt.type_code = 'water' THEN urr.execution_count ELSE NULL END) as avgWaterCount,
          AVG(urr.completion_rate) as avgCompletionRate
        FROM users u
        LEFT JOIN user_rule_records urr ON u.id = urr.user_id 
          AND urr.record_date >= DATE(:startDate) AND urr.record_date <= DATE(:endDate)
        LEFT JOIN rule_types rt ON urr.rule_type_id = rt.id
        WHERE u.status = 1
        GROUP BY u.gender
        ORDER BY u.gender
      `, {
        replacements: {
          startDate: startDate.toISOString().slice(0, 10),
          endDate: endDate.toISOString().slice(0, 10)
        }
      });
      
      result.categories = genderData.map(item => item.category);
      result.data = {
        userCount: genderData.map(item => parseInt(item.userCount) || 0),
        avgSteps: genderData.map(item => Math.round(parseFloat(item.avgSteps) || 0)),
        avgSleepHours: genderData.map(item => parseFloat(item.avgSleepHours) || 0).map(h => (h / 60).toFixed(1)), // 转换为小时
        avgWaterCount: genderData.map(item => Math.round(parseFloat(item.avgWaterCount) || 0)),
        avgCompletionRate: genderData.map(item => parseFloat(item.avgCompletionRate) || 0)
      };
      
    } else if (dimension === 'age') {
      // 按年龄分组分析（18-25, 26-35, 36-45, 46-55, 56+）
      const [ageData] = await sequelize.query(`
        SELECT 
          CASE 
            WHEN TIMESTAMPDIFF(YEAR, u.birthday, CURDATE()) BETWEEN 18 AND 25 THEN '18-25岁'
            WHEN TIMESTAMPDIFF(YEAR, u.birthday, CURDATE()) BETWEEN 26 AND 35 THEN '26-35岁'
            WHEN TIMESTAMPDIFF(YEAR, u.birthday, CURDATE()) BETWEEN 36 AND 45 THEN '36-45岁'
            WHEN TIMESTAMPDIFF(YEAR, u.birthday, CURDATE()) BETWEEN 46 AND 55 THEN '46-55岁'
            WHEN TIMESTAMPDIFF(YEAR, u.birthday, CURDATE()) >= 56 THEN '56岁以上'
            ELSE '未知'
          END as category,
          COUNT(DISTINCT u.id) as userCount,
          AVG(CASE WHEN rt.type_code = 'exercise' THEN urr.execution_count ELSE NULL END) as avgSteps,
          AVG(CASE WHEN rt.type_code = 'sleep' THEN urr.execution_count ELSE NULL END) as avgSleepHours,
          AVG(CASE WHEN rt.type_code = 'water' THEN urr.execution_count ELSE NULL END) as avgWaterCount,
          AVG(urr.completion_rate) as avgCompletionRate
        FROM users u
        LEFT JOIN user_rule_records urr ON u.id = urr.user_id 
          AND urr.record_date >= DATE(:startDate) AND urr.record_date <= DATE(:endDate)
        LEFT JOIN rule_types rt ON urr.rule_type_id = rt.id
        WHERE u.status = 1 AND u.birthday IS NOT NULL
        GROUP BY category
        ORDER BY 
          CASE category
            WHEN '18-25岁' THEN 1
            WHEN '26-35岁' THEN 2
            WHEN '36-45岁' THEN 3
            WHEN '46-55岁' THEN 4
            WHEN '56岁以上' THEN 5
            ELSE 6
          END
      `, {
        replacements: {
          startDate: startDate.toISOString().slice(0, 10),
          endDate: endDate.toISOString().slice(0, 10)
        }
      });
      
      result.categories = ageData.map(item => item.category);
      result.data = {
        userCount: ageData.map(item => parseInt(item.userCount) || 0),
        avgSteps: ageData.map(item => Math.round(parseFloat(item.avgSteps) || 0)),
        avgSleepHours: ageData.map(item => parseFloat(item.avgSleepHours) || 0).map(h => (h / 60).toFixed(1)),
        avgWaterCount: ageData.map(item => Math.round(parseFloat(item.avgWaterCount) || 0)),
        avgCompletionRate: ageData.map(item => parseFloat(item.avgCompletionRate) || 0)
      };
      
    } else if (dimension === 'healthStatus') {
      // 按健康状态标签分析（基于用户标签）
      const [healthData] = await sequelize.query(`
        SELECT 
          COALESCE(ut.tag_name, '未分类') as category,
          COUNT(DISTINCT u.id) as userCount,
          AVG(CASE WHEN rt.type_code = 'exercise' THEN urr.execution_count ELSE NULL END) as avgSteps,
          AVG(CASE WHEN rt.type_code = 'sleep' THEN urr.execution_count ELSE NULL END) as avgSleepHours,
          AVG(CASE WHEN rt.type_code = 'water' THEN urr.execution_count ELSE NULL END) as avgWaterCount,
          AVG(urr.completion_rate) as avgCompletionRate
        FROM users u
        LEFT JOIN user_tag_mapping utm ON u.id = utm.user_id
        LEFT JOIN user_tags ut ON utm.tag_id = ut.id
        LEFT JOIN user_rule_records urr ON u.id = urr.user_id 
          AND urr.record_date >= DATE(:startDate) AND urr.record_date <= DATE(:endDate)
        LEFT JOIN rule_types rt ON urr.rule_type_id = rt.id
        WHERE u.status = 1
        GROUP BY ut.id, ut.tag_name
        ORDER BY userCount DESC
        LIMIT 10
      `, {
        replacements: {
          startDate: startDate.toISOString().slice(0, 10),
          endDate: endDate.toISOString().slice(0, 10)
        }
      });
      
      result.categories = healthData.map(item => item.category);
      result.data = {
        userCount: healthData.map(item => parseInt(item.userCount) || 0),
        avgSteps: healthData.map(item => Math.round(parseFloat(item.avgSteps) || 0)),
        avgSleepHours: healthData.map(item => parseFloat(item.avgSleepHours) || 0).map(h => (h / 60).toFixed(1)),
        avgWaterCount: healthData.map(item => Math.round(parseFloat(item.avgWaterCount) || 0)),
        avgCompletionRate: healthData.map(item => parseFloat(item.avgCompletionRate) || 0)
      };
    }
    
    return success(res, result, '获取成功');
    
  } catch (err) {
    console.error('获取用户维度数据错误：', err);
    return error(res, '获取数据失败', 500, err.message);
  }
};

/**
 * 功能使用分析
 * GET /api/statistics/function-usage
 * 查询参数：period (day/week/month), function (reminder/aiQa/dataRecord)
 * 返回：各功能的使用率、留存率
 */
const getFunctionUsage = async (req, res) => {
  try {
    const { period = 'month', function: functionName = 'all' } = req.query;
    
    // 根据周期计算时间范围
    let startDate, endDate;
    const now = new Date();
    
    switch (period) {
      case 'day':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 30); // 最近30天
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'week':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 84); // 最近12周
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'month':
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 12); // 最近12个月
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
        break;
      default:
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 12);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
    }
    
    const result = {
      period,
      usageRate: [], // 使用率数据（饼图）
      retentionRate: [] // 留存率趋势（折线图）
    };
    
    // 1. 使用率统计（饼图数据）
    if (functionName === 'all' || functionName === 'reminder') {
      // 提醒功能使用率
      const [reminderUsage] = await sequelize.query(`
        SELECT 
          COUNT(DISTINCT user_id) as activeUsers
        FROM user_rule_records
        WHERE record_date >= DATE(:startDate) AND record_date <= DATE(:endDate)
      `, {
        replacements: {
          startDate: startDate.toISOString().slice(0, 10),
          endDate: endDate.toISOString().slice(0, 10)
        }
      });
      
      const [totalUsers] = await sequelize.query(`
        SELECT COUNT(*) as total FROM users WHERE status = 1
      `);
      
      const reminderActive = parseInt(reminderUsage[0]?.activeUsers) || 0;
      const total = parseInt(totalUsers[0]?.total) || 1;
      const reminderRate = ((reminderActive / total) * 100).toFixed(1);
      
      result.usageRate.push({
        name: '提醒功能',
        value: parseFloat(reminderRate)
      });
    }
    
    if (functionName === 'all' || functionName === 'aiQa') {
      // AI问答功能使用率
      try {
        const [aiUsage] = await sequelize.query(`
          SELECT 
            COUNT(DISTINCT userId) as activeUsers
          FROM ai_qa_log
          WHERE createTime >= :startDate AND createTime <= :endDate
        `, {
          replacements: {
            startDate: startDate.toISOString().slice(0, 19).replace('T', ' '),
            endDate: endDate.toISOString().slice(0, 19).replace('T', ' ')
          }
        });
        
        const [totalUsers] = await sequelize.query(`
          SELECT COUNT(*) as total FROM users WHERE status = 1
        `);
        
        const aiActive = parseInt(aiUsage[0]?.activeUsers) || 0;
        const total = parseInt(totalUsers[0]?.total) || 1;
        const aiRate = ((aiActive / total) * 100).toFixed(1);
        
        result.usageRate.push({
          name: 'AI问答',
          value: parseFloat(aiRate)
        });
      } catch (err) {
        // 如果表不存在，返回0使用率
        if (err.name === 'SequelizeDatabaseError' && err.parent && err.parent.code === 'ER_NO_SUCH_TABLE') {
          console.warn('警告：ai_qa_log 表不存在，AI问答使用率设为0');
          result.usageRate.push({
            name: 'AI问答',
            value: 0
          });
        } else {
          // 其他错误继续抛出
          throw err;
        }
      }
    }
    
    if (functionName === 'all' || functionName === 'dataRecord') {
      // 数据记录功能使用率
      const [recordUsage] = await sequelize.query(`
        SELECT 
          COUNT(DISTINCT user_id) as activeUsers
        FROM user_rule_records
        WHERE record_date >= DATE(:startDate) AND record_date <= DATE(:endDate)
          AND completion_rate > 0
      `, {
        replacements: {
          startDate: startDate.toISOString().slice(0, 10),
          endDate: endDate.toISOString().slice(0, 10)
        }
      });
      
      const [totalUsers] = await sequelize.query(`
        SELECT COUNT(*) as total FROM users WHERE status = 1
      `);
      
      const recordActive = parseInt(recordUsage[0]?.activeUsers) || 0;
      const total = parseInt(totalUsers[0]?.total) || 1;
      const recordRate = ((recordActive / total) * 100).toFixed(1);
      
      result.usageRate.push({
        name: '数据记录',
        value: parseFloat(recordRate)
      });
    }
    
    // 2. 留存率趋势（按周/月统计）
    let retentionQuery;
    if (period === 'day') {
      // 按日统计
      retentionQuery = `
        SELECT 
          DATE(created_at) as date,
          COUNT(DISTINCT user_id) as activeUsers
        FROM user_behavior_logs
        WHERE created_at >= :startDate AND created_at <= :endDate
          AND user_id IS NOT NULL
        GROUP BY DATE(created_at)
        ORDER BY date
      `;
    } else if (period === 'week') {
      // 按周统计
      retentionQuery = `
        SELECT 
          DATE_FORMAT(created_at, '%Y-%u') as date,
          COUNT(DISTINCT user_id) as activeUsers
        FROM user_behavior_logs
        WHERE created_at >= :startDate AND created_at <= :endDate
          AND user_id IS NOT NULL
        GROUP BY DATE_FORMAT(created_at, '%Y-%u')
        ORDER BY date
      `;
    } else {
      // 按月统计
      retentionQuery = `
        SELECT 
          DATE_FORMAT(created_at, '%Y-%m') as date,
          COUNT(DISTINCT user_id) as activeUsers
        FROM user_behavior_logs
        WHERE created_at >= :startDate AND created_at <= :endDate
          AND user_id IS NOT NULL
        GROUP BY DATE_FORMAT(created_at, '%Y-%m')
        ORDER BY date
      `;
    }
    
    const [retentionData] = await sequelize.query(retentionQuery, {
      replacements: {
        startDate: startDate.toISOString().slice(0, 19).replace('T', ' '),
        endDate: endDate.toISOString().slice(0, 19).replace('T', ' ')
      }
    });
    
    const [totalUsers] = await sequelize.query(`
      SELECT COUNT(*) as total FROM users WHERE status = 1
    `);
    const total = parseInt(totalUsers[0]?.total) || 1;
    
    // 确保retentionData是数组
    const retentionDataArray = Array.isArray(retentionData) ? retentionData : [];
    
    result.retentionRate = {
      dates: retentionDataArray.map(item => item.date),
      rates: retentionDataArray.map(item => {
        const active = parseInt(item.activeUsers) || 0;
        return parseFloat(((active / total) * 100).toFixed(1));
      })
    };
    
    return success(res, result, '获取成功');
    
  } catch (err) {
    console.error('获取功能使用数据错误：', err);
    return error(res, '获取数据失败', 500, err.message);
  }
};

module.exports = {
  getGlobalIndicators,
  getUserDimension,
  getFunctionUsage
};

