/**
 * 统一返回结果工具类
 * 所有接口统一使用此工具类返回数据，格式：{ code, message, data/error }
 */

/**
 * 成功响应
 * @param {Object} res - Express响应对象
 * @param {*} data - 返回的数据
 * @param {String} message - 提示信息
 * @param {Number} code - 状态码，默认200
 */
const success = (res, data = null, message = '操作成功', code = 200) => {
  res.status(200).json({
    code,
    message,
    data
  });
};

/**
 * 失败响应
 * @param {Object} res - Express响应对象
 * @param {String} message - 错误信息
 * @param {Number} code - 状态码，默认500
 * @param {*} error - 错误详情（可选，开发环境可返回）
 */
const error = (res, message = '操作失败', code = 500, error = null) => {
  const response = {
    code,
    message
  };
  
  // 开发环境返回详细错误信息
  if (process.env.NODE_ENV === 'development' && error) {
    response.error = error;
  }
  
  res.status(200).json(response);
};

/**
 * 参数验证失败响应
 * @param {Object} res - Express响应对象
 * @param {String} message - 错误信息
 */
const validationError = (res, message = '参数验证失败') => {
  return error(res, message, 400);
};

/**
 * 未授权响应
 * @param {Object} res - Express响应对象
 * @param {String} message - 错误信息
 */
const unauthorized = (res, message = '未授权，请先登录') => {
  return error(res, message, 401);
};

/**
 * 禁止访问响应
 * @param {Object} res - Express响应对象
 * @param {String} message - 错误信息
 */
const forbidden = (res, message = '禁止访问') => {
  return error(res, message, 403);
};

/**
 * 资源未找到响应
 * @param {Object} res - Express响应对象
 * @param {String} message - 错误信息
 */
const notFound = (res, message = '资源未找到') => {
  return error(res, message, 404);
};

module.exports = {
  success,
  error,
  validationError,
  unauthorized,
  forbidden,
  notFound
};

