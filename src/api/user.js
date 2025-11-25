/**
 * 用户管理相关API
 */

import request from './request'

/**
 * 获取用户列表
 * @param {Object} params - 查询参数
 * @param {number} params.status - 账号状态：1-启用，0-禁用
 * @param {string} params.startDate - 注册开始时间
 * @param {string} params.endDate - 注册结束时间
 * @param {string} params.major - 专业关键词（模糊查询）
 * @param {number} params.page - 页码
 * @param {number} params.limit - 每页条数
 */
export const getUserList = (params) => {
  return request({
    url: '/users/list',
    method: 'get',
    params
  })
}

/**
 * 获取用户详情
 * @param {number} id - 用户ID
 */
export const getUserDetail = (id) => {
  return request({
    url: `/users/${id}`,
    method: 'get'
  })
}

/**
 * 修改账号状态
 * @param {number} id - 用户ID
 * @param {number} status - 状态：1-启用，0-禁用
 */
export const updateUserStatus = (id, status) => {
  return request({
    url: `/users/${id}/status`,
    method: 'put',
    data: { status }
  })
}

/**
 * 重置密码
 * @param {number} id - 用户ID
 */
export const resetPassword = (id) => {
  return request({
    url: `/users/${id}/reset-password`,
    method: 'post'
  })
}

/**
 * 创建用户
 * @param {Object} data - 用户数据
 */
export const createUser = (data) => {
  return request({
    url: '/users',
    method: 'post',
    data
  })
}

/**
 * 删除用户
 * @param {number} id - 用户ID
 */
export const deleteUser = (id) => {
  return request({
    url: `/users/${id}`,
    method: 'delete'
  })
}

/**
 * 获取标签列表
 */
export const getTagList = () => {
  return request({
    url: '/users/tags',
    method: 'get'
  })
}

/**
 * 创建标签
 * @param {Object} data - 标签数据
 */
export const createTag = (data) => {
  return request({
    url: '/users/tags',
    method: 'post',
    data
  })
}

/**
 * 删除标签
 * @param {number} id - 标签ID
 */
export const deleteTag = (id) => {
  return request({
    url: `/users/tags/${id}`,
    method: 'delete'
  })
}

/**
 * 获取标签关联的用户列表
 * @param {number} tagId - 标签ID
 */
export const getTagUsers = (tagId) => {
  return request({
    url: `/users/tags/${tagId}/users`,
    method: 'get'
  })
}

/**
 * 批量添加用户到标签
 * @param {number} tagId - 标签ID
 * @param {Array} userIds - 用户ID数组
 */
export const addUsersToTag = (tagId, userIds) => {
  return request({
    url: `/users/tags/${tagId}/users`,
    method: 'post',
    data: { userIds }
  })
}

/**
 * 从标签移除用户
 * @param {number} tagId - 标签ID
 * @param {number} userId - 用户ID
 */
export const removeUserFromTag = (tagId, userId) => {
  return request({
    url: `/users/tags/${tagId}/users/${userId}`,
    method: 'delete'
  })
}

