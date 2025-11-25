/**
 * 健康规则管理相关API
 */

import request from './request'

/**
 * 获取基础规则配置
 */
export const getRuleConfig = () => {
  return request({
    url: '/rules/config',
    method: 'get'
  })
}

/**
 * 更新基础规则配置
 * @param {Object} data - 配置数据
 * @param {Object} data.water - 饮水配置 { dailyTarget, reminderInterval }
 * @param {Object} data.diet - 饮食配置 { calorieTarget }
 * @param {Object} data.exercise - 运动配置 { stepTarget, sedentaryDuration }
 * @param {Object} data.sleep - 睡眠配置 { recommendedDuration }
 * @param {string} data.effectiveType - 生效类型：'immediate'|'scheduled'
 */
export const updateRuleConfig = (data) => {
  return request({
    url: '/rules/config',
    method: 'put',
    data
  })
}

/**
 * 获取规则模板列表
 * @param {Object} params - 查询参数
 * @param {number} params.ruleTypeId - 规则类型ID（可选）
 */
export const getTemplateList = (params) => {
  return request({
    url: '/rules/templates',
    method: 'get',
    params
  })
}

/**
 * 创建规则模板
 * @param {Object} data - 模板数据
 * @param {string} data.templateName - 模板名称
 * @param {number} data.ruleTypeId - 规则类型ID
 * @param {Object} data.ruleConfig - 规则配置（JSON对象）
 * @param {string} data.description - 模板描述
 * @param {Array} data.tagIds - 标签ID数组
 */
export const createTemplate = (data) => {
  return request({
    url: '/rules/templates',
    method: 'post',
    data
  })
}

/**
 * 更新规则模板
 * @param {number} id - 模板ID
 * @param {Object} data - 模板数据
 */
export const updateTemplate = (id, data) => {
  return request({
    url: `/rules/templates/${id}`,
    method: 'put',
    data
  })
}

/**
 * 删除规则模板
 * @param {number} id - 模板ID
 */
export const deleteTemplate = (id) => {
  return request({
    url: `/rules/templates/${id}`,
    method: 'delete'
  })
}

/**
 * 按标签分配模板给用户
 * @param {number} id - 模板ID
 * @param {Object} data - 分配数据
 * @param {Array} data.tagIds - 标签ID数组
 */
export const assignTemplateToUsers = (id, data) => {
  return request({
    url: `/rules/templates/${id}/assign`,
    method: 'post',
    data
  })
}

/**
 * 获取规则类型列表
 */
export const getRuleTypes = () => {
  return request({
    url: '/rules/types',
    method: 'get'
  })
}

/**
 * 获取规则效果统计
 * @param {Object} params - 查询参数
 * @param {number} params.ruleTypeId - 规则类型ID（可选）
 * @param {string} params.period - 统计周期：'day'|'week'|'month'
 */
export const getRuleStatistics = (params) => {
  return request({
    url: '/rules/statistics',
    method: 'get',
    params
  })
}

