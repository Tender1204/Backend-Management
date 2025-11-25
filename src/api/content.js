/**
 * 内容管理相关API
 */

import request from './request'

/**
 * 获取内容列表
 * @param {Object} params - 查询参数
 * @param {string} params.title - 标题关键词
 * @param {number} params.categoryId - 分类ID
 * @param {number} params.publishStatus - 发布状态：0-草稿，1-已发布，2-已下架
 * @param {number} params.page - 页码
 * @param {number} params.limit - 每页条数
 */
export const getContentList = (params) => {
  return request({
    url: '/content/list',
    method: 'get',
    params
  })
}

/**
 * 获取内容详情
 * @param {number} id - 内容ID
 */
export const getContentDetail = (id) => {
  return request({
    url: `/content/${id}`,
    method: 'get'
  })
}

/**
 * 创建内容
 * @param {Object} data - 内容数据
 * @param {string} data.title - 标题
 * @param {number} data.categoryId - 分类ID
 * @param {string} data.coverImage - 封面图片
 * @param {string} data.summary - 摘要
 * @param {string} data.content - 正文内容
 * @param {Array} data.tagIds - 标签ID数组
 * @param {number} data.publishStatus - 发布状态：0-草稿，1-已发布，2-已下架
 */
export const createContent = (data) => {
  return request({
    url: '/content',
    method: 'post',
    data
  })
}

/**
 * 更新内容
 * @param {number} id - 内容ID
 * @param {Object} data - 内容数据
 */
export const updateContent = (id, data) => {
  return request({
    url: `/content/${id}`,
    method: 'put',
    data
  })
}

/**
 * 删除内容
 * @param {number} id - 内容ID
 */
export const deleteContent = (id) => {
  return request({
    url: `/content/${id}`,
    method: 'delete'
  })
}

/**
 * 修改内容上架状态
 * @param {number} id - 内容ID
 * @param {number} publishStatus - 发布状态：0-草稿，1-已发布，2-已下架
 */
export const updateContentStatus = (id, publishStatus) => {
  return request({
    url: `/content/${id}/status`,
    method: 'put',
    data: { publishStatus }
  })
}

/**
 * 获取内容分类列表
 */
export const getCategories = () => {
  return request({
    url: '/content/categories',
    method: 'get'
  })
}

/**
 * 创建推送任务
 * @param {Object} data - 推送任务数据
 * @param {number} data.contentId - 内容ID
 * @param {number} data.pushType - 推送类型：1-立即推送，2-定时推送
 * @param {string} data.pushTime - 推送时间（定时推送时使用）
 * @param {number} data.targetType - 推送目标：1-全部用户，2-指定标签
 * @param {Array} data.targetTags - 目标标签ID数组（指定标签时使用）
 */
export const createPushTask = (data) => {
  return request({
    url: '/content/push',
    method: 'post',
    data
  })
}

/**
 * 获取推送任务列表
 * @param {Object} params - 查询参数
 * @param {number} params.page - 页码
 * @param {number} params.limit - 每页条数
 */
export const getPushTaskList = (params) => {
  return request({
    url: '/content/push/list',
    method: 'get',
    params
  })
}

/**
 * 获取推送任务详情
 * @param {number} id - 推送任务ID
 */
export const getPushTaskDetail = (id) => {
  return request({
    url: `/content/push/${id}`,
    method: 'get'
  })
}

/**
 * 取消推送任务
 * @param {number} id - 推送任务ID
 */
export const cancelPushTask = (id) => {
  return request({
    url: `/content/push/${id}/cancel`,
    method: 'put'
  })
}

/**
 * 删除推送任务
 * @param {number} id - 推送任务ID
 */
export const deletePushTask = (id) => {
  return request({
    url: `/content/push/${id}`,
    method: 'delete'
  })
}

/**
 * 获取内容数据统计
 */
export const getContentStatistics = () => {
  return request({
    url: '/content/statistics/data',
    method: 'get'
  })
}

