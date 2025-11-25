/**
 * 数据统计分析相关API
 */

import request from './request'

/**
 * 获取全局指标分析数据
 * @param {String} period - 统计周期：day/week/month
 * @param {String} indicators - 指标列表，逗号分隔：totalUsers,activeUsers,aiQaCount,newUsers
 * @returns {Promise}
 */
export const getGlobalIndicators = (period = 'day', indicators = 'totalUsers,activeUsers,aiQaCount') => {
  return request({
    url: '/statistics/global-indicators',
    method: 'get',
    params: { period, indicators }
  })
}

/**
 * 获取用户维度分析数据
 * @param {String} dimension - 维度：gender/age/healthStatus
 * @param {String} period - 统计周期：day/week/month
 * @returns {Promise}
 */
export const getUserDimension = (dimension = 'gender', period = 'month') => {
  return request({
    url: '/statistics/user-dimension',
    method: 'get',
    params: { dimension, period }
  })
}

/**
 * 获取功能使用分析数据
 * @param {String} period - 统计周期：day/week/month
 * @param {String} function - 功能名称：reminder/aiQa/dataRecord/all
 * @returns {Promise}
 */
export const getFunctionUsage = (period = 'month', functionName = 'all') => {
  return request({
    url: '/statistics/function-usage',
    method: 'get',
    params: { period, function: functionName }
  })
}

