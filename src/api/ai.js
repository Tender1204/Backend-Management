/**
 * AI模块辅助管理相关API
 */

import request from './request'

/**
 * 知识库同步接口
 * @param {Object} data - 同步数据 { modelName }
 * @returns {Promise}
 */
export const syncKnowledge = (data = {}) => {
  return request({
    url: '/ai/sync-knowledge',
    method: 'post',
    data,
    timeout: 120000 // 同步操作可能需要更长时间，设置为120秒
  })
}

/**
 * AI问答接口
 * @param {Object} data - 问答数据 { userId, userQuestion }
 * @returns {Promise}
 */
export const aiQa = (data) => {
  return request({
    url: '/ai/qa',
    method: 'post',
    data
  })
}

/**
 * 获取报告模板列表
 * @param {Object} params - 查询参数 { reportType }
 * @returns {Promise}
 */
export const getReportTemplate = (params) => {
  return request({
    url: '/ai/report-template',
    method: 'get',
    params
  })
}

/**
 * 更新报告模板
 * @param {Object} data - 模板数据 { templateId, dataDimensions, analysisDimensions, suggestionRules }
 * @returns {Promise}
 */
export const updateReportTemplate = (data) => {
  return request({
    url: '/ai/report-template',
    method: 'put',
    data
  })
}

/**
 * 生成AI报告
 * @param {Object} data - 报告数据 { userId, tagId, reportType, reportPeriod }
 * @returns {Promise}
 */
export const generateReport = (data) => {
  return request({
    url: '/ai/generate-report',
    method: 'post',
    data
  })
}

/**
 * 查询问答日志
 * @param {Object} params - 查询参数 { pageNum, pageSize, startTime, endTime, keyword, userId, indicator }
 * @returns {Promise}
 */
export const getQaLog = (params) => {
  return request({
    url: '/ai/qa-log',
    method: 'get',
    params
  })
}

/**
 * 查询同步日志
 * @param {Object} params - 查询参数 { pageNum, pageSize }
 * @returns {Promise}
 */
export const getSyncLogs = (params) => {
  return request({
    url: '/ai/sync-logs',
    method: 'get',
    params
  })
}

/**
 * 获取可用模型列表
 * @returns {Promise}
 */
export const getModels = () => {
  return request({
    url: '/ai/models',
    method: 'get'
  })
}

/**
 * 获取API配置
 * @returns {Promise}
 */
export const getApiConfig = () => {
  return request({
    url: '/ai/api-config',
    method: 'get'
  })
}

/**
 * 保存API配置
 * @param {Object} data - 配置数据 { baseUrl, apiKey, modelName }
 * @returns {Promise}
 */
export const saveApiConfig = (data) => {
  return request({
    url: '/ai/api-config',
    method: 'post',
    data
  })
}

/**
 * 获取知识库列表
 * @param {Object} params - 查询参数 { pageNum, pageSize, title, category, keyword }
 * @returns {Promise}
 */
export const getKnowledgeList = (params) => {
  return request({
    url: '/ai/knowledge-list',
    method: 'get',
    params
  })
}

