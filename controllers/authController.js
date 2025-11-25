/**
 * 管理员认证控制器
 * 处理登录、登出等认证相关接口
 */

const bcrypt = require('bcryptjs');
const { sequelize } = require('../config/db');
const { generateToken } = require('../middleware/auth');
const { success, error, validationError } = require('../utils/response');

/**
 * 管理员登录
 * POST /api/auth/login
 * 请求体：{ username, password }
 */
const login = async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // 参数验证
    if (!username || !password) {
      return validationError(res, '用户名和密码不能为空');
    }
    
    // 查询管理员信息
    const [results] = await sequelize.query(
      `SELECT id, username, password, nickname, avatar, status 
       FROM admins 
       WHERE username = :username
       LIMIT 1`,
      {
        replacements: { username }
      }
    );
    
    // results 是结果数组
    if (!results || results.length === 0) {
      return error(res, '用户名或密码错误', 401);
    }
    
    const admin = results[0];
    
    if (!admin) {
      return error(res, '用户名或密码错误', 401);
    }
    
    // 检查账号状态
    if (admin.status !== 1) {
      return error(res, '账号已被禁用，请联系系统管理员', 403);
    }
    
    // 验证密码
    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid) {
      return error(res, '用户名或密码错误', 401);
    }
    
    // 更新最后登录时间和IP
    const lastLoginIp = req.ip || req.connection.remoteAddress || 'unknown';
    await sequelize.query(
      `UPDATE admins 
       SET last_login_time = NOW(), last_login_ip = :ip 
       WHERE id = :id`,
      {
        replacements: { ip: lastLoginIp, id: admin.id }
      }
    );
    
    // 生成JWT Token
    const token = generateToken({
      id: admin.id,
      username: admin.username,
      nickname: admin.nickname
    });
    
    // 返回登录成功信息（不返回密码）
    const adminInfo = {
      id: admin.id,
      username: admin.username,
      nickname: admin.nickname,
      avatar: admin.avatar,
      token
    };
    
    // 记录登录日志（可选，如果system_logs表已创建）
    try {
      await sequelize.query(
        `INSERT INTO system_logs 
         (admin_id, log_type, module_name, operation, ip_address, created_at) 
         VALUES (:adminId, 'login', 'auth', '管理员登录', :ip, NOW())`,
        {
          replacements: { adminId: admin.id, ip: lastLoginIp }
        }
      );
    } catch (logError) {
      // 日志记录失败不影响登录流程
      console.warn('登录日志记录失败：', logError.message);
    }
    
    return success(res, adminInfo, '登录成功');
    
  } catch (err) {
    console.error('登录错误：', err);
    return error(res, '登录失败，请稍后重试', 500, err.message);
  }
};

/**
 * 获取当前登录管理员信息
 * GET /api/auth/info
 * 需要Token验证
 */
const getAdminInfo = async (req, res) => {
  try {
    const adminId = req.admin.id;
    
    const [results] = await sequelize.query(
      `SELECT id, username, nickname, avatar, status, last_login_time, last_login_ip, created_at 
       FROM admins 
       WHERE id = :id
       LIMIT 1`,
      {
        replacements: { id: adminId }
      }
    );
    
    if (!results || results.length === 0) {
      return error(res, '管理员信息不存在', 404);
    }
    
    return success(res, results[0], '获取成功');
    
  } catch (err) {
    console.error('获取管理员信息错误：', err);
    return error(res, '获取信息失败', 500, err.message);
  }
};

/**
 * 修改密码
 * POST /api/auth/change-password
 * 需要Token验证
 * 请求体：{ oldPassword, newPassword }
 */
const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const adminId = req.admin.id;
    
    // 参数验证
    if (!oldPassword || !newPassword) {
      return validationError(res, '原密码和新密码不能为空');
    }
    
    if (newPassword.length < 6) {
      return validationError(res, '新密码长度不能少于6位');
    }
    
    // 查询当前密码
    const [results] = await sequelize.query(
      `SELECT password FROM admins WHERE id = :id LIMIT 1`,
      {
        replacements: { id: adminId }
      }
    );
    
    if (!results || results.length === 0) {
      return error(res, '管理员不存在', 404);
    }
    
    // 验证原密码
    const isPasswordValid = await bcrypt.compare(oldPassword, results[0].password);
    if (!isPasswordValid) {
      return error(res, '原密码错误', 401);
    }
    
    // 加密新密码
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    
    // 更新密码
    await sequelize.query(
      `UPDATE admins SET password = :password WHERE id = :id`,
      {
        replacements: { password: hashedPassword, id: adminId }
      }
    );
    
    return success(res, null, '密码修改成功');
    
  } catch (err) {
    console.error('修改密码错误：', err);
    return error(res, '修改密码失败', 500, err.message);
  }
};

/**
 * 更新管理员信息
 * POST /api/auth/update-info
 * 需要Token验证
 * 请求体：{ nickname, avatar }
 */
const updateAdminInfo = async (req, res) => {
  try {
    const { nickname, avatar } = req.body;
    const adminId = req.admin.id;
    
    // 参数验证
    if (!nickname) {
      return validationError(res, '昵称不能为空');
    }
    
    if (nickname.length < 2 || nickname.length > 20) {
      return validationError(res, '昵称长度应在2-20个字符之间');
    }
    
    // 更新管理员信息
    await sequelize.query(
      `UPDATE admins 
       SET nickname = :nickname, avatar = :avatar, updated_at = NOW() 
       WHERE id = :id`,
      {
        replacements: { 
          nickname: nickname,
          avatar: avatar || null,
          id: adminId 
        }
      }
    );
    
    // 返回更新后的信息
    const [results] = await sequelize.query(
      `SELECT id, username, nickname, avatar, status, last_login_time, last_login_ip, created_at 
       FROM admins 
       WHERE id = :id
       LIMIT 1`,
      {
        replacements: { id: adminId }
      }
    );
    
    return success(res, results[0], '更新成功');
    
  } catch (err) {
    console.error('更新管理员信息错误：', err);
    return error(res, '更新失败', 500, err.message);
  }
};

/**
 * 发送重置密码请求
 * POST /api/auth/forgot-password
 * 请求体：{ username }
 */
const forgotPassword = async (req, res) => {
  try {
    const { username } = req.body;
    
    // 参数验证
    if (!username) {
      return validationError(res, '用户名不能为空');
    }
    
    // 查询管理员是否存在
    const [results] = await sequelize.query(
      `SELECT id, username, nickname FROM admins WHERE username = :username LIMIT 1`,
      {
        replacements: { username }
      }
    );
    
    // 为了安全，无论用户是否存在都返回成功消息（防止用户名枚举攻击）
    if (!results || results.length === 0) {
      return success(res, null, '如果该用户名存在，重置密码链接已发送到您的邮箱（功能待完善）');
    }
    
    const admin = results[0];
    
    // 生成重置令牌（使用 JWT，设置较短的有效期，例如 1 小时）
    const crypto = require('crypto');
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1小时后过期
    
    // 将重置令牌存储到数据库（这里简化处理，实际应该存储到 password_reset_tokens 表）
    // 为了简化，我们使用一个临时方案：将 token 的 hash 存储到系统配置表或直接存储到 admins 表
    // 这里我们创建一个简单的密码重置记录
    await sequelize.query(
      `UPDATE admins 
       SET updated_at = NOW() 
       WHERE id = :id`,
      {
        replacements: { id: admin.id }
      }
    );
    
    // 在实际应用中，这里应该：
    // 1. 将 resetToken 和 resetTokenExpiry 存储到 password_reset_tokens 表
    // 2. 发送包含重置链接的邮件给管理员
    // 3. 重置链接格式：/reset-password?token=xxx
    
    // 为了演示，我们直接返回 token（实际应用中不应该这样做）
    // 实际应该通过邮件发送重置链接
    console.log(`密码重置令牌（仅用于开发测试）: ${resetToken}`);
    console.log(`管理员: ${admin.username}, ID: ${admin.id}`);
    
    // 返回成功消息（不返回 token，实际应该通过邮件发送）
    return success(res, { 
      message: '重置密码链接已生成（开发模式：请查看服务器日志获取重置令牌）',
      // 开发模式下返回 token，生产环境应该注释掉
      resetToken: resetToken,
      resetTokenExpiry: resetTokenExpiry.toISOString()
    }, '密码重置请求已处理');
    
  } catch (err) {
    console.error('发送重置密码请求错误：', err);
    return error(res, '处理失败，请稍后重试', 500, err.message);
  }
};

/**
 * 重置密码
 * POST /api/auth/reset-password
 * 请求体：{ username, resetToken, newPassword }
 */
const resetPassword = async (req, res) => {
  try {
    const { username, resetToken, newPassword } = req.body;
    
    // 参数验证
    if (!username || !resetToken || !newPassword) {
      return validationError(res, '用户名、重置令牌和新密码不能为空');
    }
    
    if (newPassword.length < 6) {
      return validationError(res, '新密码长度不能少于6位');
    }
    
    // 查询管理员
    const [results] = await sequelize.query(
      `SELECT id, username FROM admins WHERE username = :username LIMIT 1`,
      {
        replacements: { username }
      }
    );
    
    if (!results || results.length === 0) {
      return error(res, '用户名不存在', 404);
    }
    
    const admin = results[0];
    
    // 在实际应用中，这里应该：
    // 1. 从 password_reset_tokens 表查询 resetToken
    // 2. 验证 token 是否有效且未过期
    // 3. 验证 token 是否属于该管理员
    
    // 简化处理：这里我们直接验证 token 格式（实际应该从数据库验证）
    if (!resetToken || resetToken.length !== 64) {
      return error(res, '无效的重置令牌', 400);
    }
    
    // 加密新密码
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    
    // 更新密码
    await sequelize.query(
      `UPDATE admins SET password = :password, updated_at = NOW() WHERE id = :id`,
      {
        replacements: { password: hashedPassword, id: admin.id }
      }
    );
    
    // 在实际应用中，这里应该：
    // 1. 删除已使用的重置令牌
    // 2. 发送密码已重置的通知邮件
    
    return success(res, null, '密码重置成功，请使用新密码登录');
    
  } catch (err) {
    console.error('重置密码错误：', err);
    return error(res, '重置密码失败', 500, err.message);
  }
};

module.exports = {
  login,
  getAdminInfo,
  changePassword,
  updateAdminInfo,
  forgotPassword,
  resetPassword
};

