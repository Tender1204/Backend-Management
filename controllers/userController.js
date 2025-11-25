/**
 * 用户管理控制器
 * 处理用户列表查询、详情查询、账号状态修改、密码重置等接口
 */

const bcrypt = require('bcryptjs');
const { sequelize } = require('../config/db');
const { success, error, validationError } = require('../utils/response');

/**
 * 用户列表查询
 * GET /api/users/list
 * 查询参数：status, startDate, endDate, major, page, limit
 */
const getUserList = async (req, res) => {
  try {
    const { status, startDate, endDate, major, page = 1, limit = 10 } = req.query;
    
    // 构建查询条件
    let whereConditions = [];
    let replacements = {};
    
    // 账号状态筛选
    if (status !== undefined && status !== '') {
      whereConditions.push('u.status = :status');
      replacements.status = parseInt(status);
    }
    
    // 注册时间区间筛选
    if (startDate) {
      whereConditions.push('u.register_time >= :startDate');
      replacements.startDate = startDate;
    }
    if (endDate) {
      whereConditions.push('u.register_time <= :endDate');
      replacements.endDate = endDate + ' 23:59:59';
    }
    
    // 昵称或手机号模糊查询
    if (major) {
      whereConditions.push('(u.nickname LIKE :major OR u.phone LIKE :major)');
      replacements.major = `%${major}%`;
    }
    
    const whereClause = whereConditions.length > 0 
      ? 'WHERE ' + whereConditions.join(' AND ')
      : '';
    
    // 计算总数
    const [countResult] = await sequelize.query(
      `SELECT COUNT(*) as total 
       FROM users u 
       ${whereClause}`,
      { replacements }
    );
    const total = countResult[0].total;
    
    // 分页查询
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const [users] = await sequelize.query(
      `SELECT 
        u.id,
        u.openid,
        u.nickname,
        u.avatar,
        u.gender,
        u.birthday,
        u.height,
        u.weight,
        u.phone,
        u.email,
        u.status,
        u.register_time,
        u.last_active_time,
        u.created_at,
        GROUP_CONCAT(DISTINCT ut.tag_name) as tags
       FROM users u
       LEFT JOIN user_tag_mapping utm ON u.id = utm.user_id
       LEFT JOIN user_tags ut ON utm.tag_id = ut.id
       ${whereClause}
       GROUP BY u.id
       ORDER BY u.register_time ASC
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
    const formattedUsers = users.map(user => ({
      ...user,
      tags: user.tags ? user.tags.split(',') : []
    }));
    
    return success(res, {
      list: formattedUsers,
      total: total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit))
    }, '获取成功');
    
  } catch (err) {
    console.error('获取用户列表错误：', err);
    return error(res, '获取用户列表失败', 500, err.message);
  }
};

/**
 * 用户详情查询
 * GET /api/users/:id
 * 返回基础信息+健康档案核心数据+近30天活跃趋势
 */
const getUserDetail = async (req, res) => {
  try {
    const { id } = req.params;
    
    // 查询用户基础信息
    const [userResult] = await sequelize.query(
      `SELECT 
        u.id,
        u.openid,
        u.nickname,
        u.avatar,
        u.gender,
        u.birthday,
        u.height,
        u.weight,
        u.phone,
        u.email,
        u.status,
        u.register_time,
        u.last_active_time,
        u.created_at,
        u.updated_at
       FROM users u
       WHERE u.id = :id
       LIMIT 1`,
      { replacements: { id } }
    );
    
    if (!userResult || userResult.length === 0) {
      return error(res, '用户不存在', 404);
    }
    
    const user = userResult[0];
    
    // 查询用户标签
    const [tags] = await sequelize.query(
      `SELECT ut.id, ut.tag_name, ut.tag_desc, ut.color
       FROM user_tag_mapping utm
       JOIN user_tags ut ON utm.tag_id = ut.id
       WHERE utm.user_id = :id`,
      { replacements: { id } }
    );
    
    // 查询健康档案核心数据（假设有健康记录表，这里用示例数据）
    const [healthRecords] = await sequelize.query(
      `SELECT 
        COUNT(*) as total_records,
        MAX(created_at) as last_record_time
       FROM user_rule_records
       WHERE user_id = :id`,
      { replacements: { id } }
    );
    
    // 查询近30天活跃趋势
    const [activityData] = await sequelize.query(
      `SELECT 
        DATE(created_at) as date,
        COUNT(*) as count
       FROM user_behavior_logs
       WHERE user_id = :id
         AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
       GROUP BY DATE(created_at)
       ORDER BY date ASC`,
      { replacements: { id } }
    );
    
    // 格式化活跃趋势数据
    const trendData = {
      dates: activityData.map(item => item.date),
      counts: activityData.map(item => item.count)
    };
    
    return success(res, {
      ...user,
      tags: tags,
      healthRecords: healthRecords[0] || { total_records: 0, last_record_time: null },
      activityTrend: trendData
    }, '获取成功');
    
  } catch (err) {
    console.error('获取用户详情错误：', err);
    return error(res, '获取用户详情失败', 500, err.message);
  }
};

/**
 * 账号状态修改
 * PUT /api/users/:id/status
 * 请求体：{ status: 0|1 }
 */
const updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    // 参数验证
    if (status === undefined || (status !== 0 && status !== 1)) {
      return validationError(res, '状态值必须为0（禁用）或1（启用）');
    }
    
    // 检查用户是否存在
    const [userResult] = await sequelize.query(
      `SELECT id, status FROM users WHERE id = :id LIMIT 1`,
      { replacements: { id } }
    );
    
    if (!userResult || userResult.length === 0) {
      return error(res, '用户不存在', 404);
    }
    
    // 更新状态
    await sequelize.query(
      `UPDATE users 
       SET status = :status, updated_at = NOW() 
       WHERE id = :id`,
      { replacements: { status: parseInt(status), id } }
    );
    
    return success(res, {
      id: id,
      status: parseInt(status)
    }, status === 1 ? '账号已启用' : '账号已冻结');
    
  } catch (err) {
    console.error('修改账号状态错误：', err);
    return error(res, '修改账号状态失败', 500, err.message);
  }
};

/**
 * 密码重置
 * POST /api/users/:id/reset-password
 * 返回临时密码
 */
const resetPassword = async (req, res) => {
  try {
    const { id } = req.params;
    
    // 检查用户是否存在
    const [userResult] = await sequelize.query(
      `SELECT id FROM users WHERE id = :id LIMIT 1`,
      { replacements: { id } }
    );
    
    if (!userResult || userResult.length === 0) {
      return error(res, '用户不存在', 404);
    }
    
    // 生成6位临时密码
    const tempPassword = Math.random().toString().slice(2, 8);
    
    // 加密密码（注意：实际应用中，用户密码应该存储在users表中，这里假设有password字段）
    // 如果users表没有password字段，这里需要先添加
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(tempPassword, saltRounds);
    
    // 更新密码（如果users表没有password字段，需要先添加）
    // 这里假设users表有password字段，如果没有，需要先ALTER TABLE添加
    try {
      await sequelize.query(
        `UPDATE users 
         SET password = :password, updated_at = NOW() 
         WHERE id = :id`,
        { replacements: { password: hashedPassword, id } }
      );
    } catch (updateError) {
      // 如果users表没有password字段，返回错误提示
      if (updateError.message.includes('Unknown column')) {
        return error(res, '用户表缺少password字段，请先执行数据库迁移', 500);
      }
      throw updateError;
    }
    
    return success(res, {
      userId: id,
      tempPassword: tempPassword
    }, '密码重置成功');
    
  } catch (err) {
    console.error('重置密码错误：', err);
    return error(res, '重置密码失败', 500, err.message);
  }
};

/**
 * 创建用户
 * POST /api/users
 * 请求体：{ nickname, phone, email, gender, birthday, height, weight }
 */
const createUser = async (req, res) => {
  try {
    const { nickname, phone, email, gender, birthday, height, weight } = req.body;
    
    // 参数验证
    if (!nickname) {
      return validationError(res, '昵称不能为空');
    }
    
    // 检查手机号是否已存在
    if (phone) {
      const [existing] = await sequelize.query(
        `SELECT id FROM users WHERE phone = :phone LIMIT 1`,
        { replacements: { phone } }
      );
      
      if (existing && existing.length > 0) {
        return error(res, '手机号已存在', 400);
      }
    }
    
    // 生成一个临时的openid（实际应用中应该从微信获取）
    const tempOpenid = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 创建用户
    const [result] = await sequelize.query(
      `INSERT INTO users 
       (openid, nickname, phone, email, gender, birthday, height, weight, status, register_time, created_at)
       VALUES 
       (:openid, :nickname, :phone, :email, :gender, :birthday, :height, :weight, 1, NOW(), NOW())`,
      {
        replacements: {
          openid: tempOpenid,
          nickname,
          phone: phone || null,
          email: email || null,
          gender: gender || 0,
          birthday: birthday || null,
          height: height || null,
          weight: weight || null
        }
      }
    );
    
    const userId = result.insertId;
    
    // 如果传入了标签ID，创建标签关联
    if (req.body.tagIds && Array.isArray(req.body.tagIds) && req.body.tagIds.length > 0) {
      const tagValues = req.body.tagIds.map(tagId => `(${userId}, ${tagId}, NOW())`).join(',');
      await sequelize.query(
        `INSERT INTO user_tag_mapping (user_id, tag_id, created_at) VALUES ${tagValues}`
      );
    }
    
    // 查询创建的用户信息（包含标签）
    const [newUser] = await sequelize.query(
      `SELECT u.*, GROUP_CONCAT(DISTINCT ut.tag_name) as tags
       FROM users u
       LEFT JOIN user_tag_mapping utm ON u.id = utm.user_id
       LEFT JOIN user_tags ut ON utm.tag_id = ut.id
       WHERE u.id = :id
       GROUP BY u.id
       LIMIT 1`,
      { replacements: { id: userId } }
    );
    
    const userData = newUser[0];
    if (userData.tags) {
      userData.tags = userData.tags.split(',');
    } else {
      userData.tags = [];
    }
    
    return success(res, userData, '创建用户成功');
    
  } catch (err) {
    console.error('创建用户错误：', err);
    return error(res, '创建用户失败', 500, err.message);
  }
};

/**
 * 删除用户
 * DELETE /api/users/:id
 */
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    
    // 检查用户是否存在
    const [user] = await sequelize.query(
      `SELECT id, nickname FROM users WHERE id = :id LIMIT 1`,
      { replacements: { id } }
    );
    
    if (!user || user.length === 0) {
      return error(res, '用户不存在', 404);
    }
    
    // 删除用户（关联数据会自动删除，因为有外键约束）
    await sequelize.query(
      `DELETE FROM users WHERE id = :id`,
      { replacements: { id } }
    );
    
    return success(res, null, '删除用户成功');
    
  } catch (err) {
    console.error('删除用户错误：', err);
    return error(res, '删除用户失败', 500, err.message);
  }
};

module.exports = {
  getUserList,
  getUserDetail,
  updateUserStatus,
  resetPassword,
  createUser,
  deleteUser
};

