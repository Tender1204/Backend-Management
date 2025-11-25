/**
 * JWT身份验证中间件
 * 用于验证管理员登录状态，保护需要认证的接口
 */

const jwt = require('jsonwebtoken');
const { unauthorized } = require('../utils/response');

// JWT密钥（实际生产环境应从环境变量读取）
const JWT_SECRET = process.env.JWT_SECRET || 'health_admin_secret_key_2024';
// Token过期时间（默认7天）
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * 生成JWT Token
 * @param {Object} payload - Token载荷（包含管理员信息）
 * @returns {String} JWT Token
 */
const generateToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN
  });
};

/**
 * 验证JWT Token中间件
 * 从请求头中获取token并验证，验证通过后将管理员信息挂载到req.admin
 */
const verifyToken = (req, res, next) => {
  // 从请求头获取token（格式：Authorization: Bearer <token>）
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return unauthorized(res, '未提供Token，请先登录');
  }
  
  // 提取token
  const token = authHeader.substring(7);
  
  try {
    // 验证token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // 将管理员信息挂载到请求对象上，供后续路由使用
    req.admin = decoded;
    
    // 继续执行下一个中间件或路由处理函数
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return unauthorized(res, 'Token已过期，请重新登录');
    } else if (err.name === 'JsonWebTokenError') {
      return unauthorized(res, 'Token无效，请重新登录');
    } else {
      return unauthorized(res, 'Token验证失败');
    }
  }
};

/**
 * 可选验证中间件（token存在则验证，不存在也不报错）
 * 用于某些接口可以匿名访问，但登录后可以获取更多信息
 */
const optionalVerifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.admin = decoded;
    } catch (err) {
      // 可选验证失败不报错，只是不设置req.admin
      req.admin = null;
    }
  }
  
  next();
};

module.exports = {
  generateToken,
  verifyToken,
  optionalVerifyToken,
  JWT_SECRET,
  JWT_EXPIRES_IN
};

