/**
 * 控制台相关API
 */

import request from './request'

/**
 * 获取核心指标数据
 * @param {String} period - 统计周期：today/week/month
 * @returns {Promise}
 */
export const getIndicators = (period = 'today') => {
  return request({
    url: '/dashboard/indicators',
    method: 'get',
    params: { period }
  })
}

/**
 * 获取活跃度趋势数据
 * @param {String} period - 统计周期：today/week/month
 * @returns {Promise}
 */
export const getTrend = (period = 'today') => {
  return request({
    url: '/dashboard/trend',
    method: 'get',
    params: { period }
  })
}

/**
 * 获取功能使用率数据
 * @param {String} period - 统计周期：today/week/month
 * @returns {Promise}
 */
export const getUsage = (period = 'today') => {
  return request({
    url: '/dashboard/usage',
    method: 'get',
    params: { period }
  })
}

/**
 * 获取内容推送完成率
 * @param {String} period - 统计周期：today/week/month
 * @returns {Promise}
 */
export const getPushRate = (period = 'today') => {
  return request({
    url: '/dashboard/push-rate',
    method: 'get',
    params: { period }
  })
}

/**
 * 获取健康数据记录率
 * @param {String} period - 统计周期：today/week/month
 * @returns {Promise}
 */
export const getHealthRecordRate = (period = 'today') => {
  return request({
    url: '/dashboard/health-record-rate',
    method: 'get',
    params: { period }
  })
}

/**
 * 获取核心指标周期对比
 * @returns {Promise}
 */
export const getCompare = () => {
  return request({
    url: '/dashboard/compare',
    method: 'get'
  })
}

