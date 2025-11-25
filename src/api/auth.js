/**
 * 认证相关API
 */

import request from './request'

/**
 * 管理员登录
 * @param {Object} data - 登录数据 { username, password }
 * @returns {Promise}
 */
export const login = (data) => {
  return request({
    url: '/auth/login',
    method: 'post',
    data
  })
}

/**
 * 获取当前登录管理员信息
 * @returns {Promise}
 */
export const getAdminInfo = () => {
  return request({
    url: '/auth/info',
    method: 'get'
  })
}

/**
 * 修改密码
 * @param {Object} data - 密码数据 { oldPassword, newPassword }
 * @returns {Promise}
 */
export const changePassword = (data) => {
  return request({
    url: '/auth/change-password',
    method: 'post',
    data
  })
}

/**
 * 更新管理员信息
 * @param {Object} data - 管理员信息 { nickname, avatar }
 * @returns {Promise}
 */
export const updateAdminInfo = (data) => {
  return request({
    url: '/auth/update-info',
    method: 'post',
    data
  })
}

/**
 * 忘记密码 - 发送重置密码请求
 * @param {Object} data - 用户名 { username }
 * @returns {Promise}
 */
export const forgotPassword = (data) => {
  return request({
    url: '/auth/forgot-password',
    method: 'post',
    data
  })
}

/**
 * 重置密码
 * @param {Object} data - 重置密码数据 { username, resetToken, newPassword }
 * @returns {Promise}
 */
export const resetPassword = (data) => {
  return request({
    url: '/auth/reset-password',
    method: 'post',
    data
  })
}

