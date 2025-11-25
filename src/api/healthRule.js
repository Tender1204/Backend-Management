/**
 * 健康规则管理相关API（迭代优化版）
 */

import request from './request'

/**
 * 获取健康规则列表
 * @param {Object} params - 查询参数
 * @param {string} params.category - 指标分类
 * @param {string} params.effectStatus - 生效状态
 * @param {number} params.page - 页码
 * @param {number} params.limit - 每页条数
 */
export const getHealthRuleList = (params) => {
  return request({
    url: '/health-rule/list',
    method: 'get',
    params
  })
}

/**
 * 导入卫健委指标
 * @param {Object} data - 导入数据
 * @param {string} data.importMode - 导入模式：'full'|'increment'
 * @param {Array} data.rules - 规则数组
 * @param {string} data.versionDesc - 版本说明
 */
export const importHealthRule = (data) => {
  return request({
    url: '/health-rule/import',
    method: 'post',
    data,
    headers: {
      'Content-Type': 'application/json'
    }
  })
}

/**
 * Excel文件上传导入
 * @param {FormData} formData - 包含file字段的FormData
 * @param {string} importMode - 导入模式
 * @param {string} versionDesc - 版本说明
 */
export const importHealthRuleByExcel = (formData, importMode, versionDesc) => {
  return request({
    url: '/health-rule/import',
    method: 'post',
    data: formData,
    headers: {
      'Content-Type': 'multipart/form-data'
    },
    params: {
      importMode,
      versionDesc
    }
  })
}

/**
 * 解析Excel文件（预览）
 * @param {FormData} formData - 包含file字段的FormData
 */
export const parseExcel = (formData) => {
  return request({
    url: '/health-rule/import/excel',
    method: 'post',
    data: formData,
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  })
}

/**
 * 下载Excel模板
 */
export const downloadTemplate = () => {
  return request({
    url: '/health-rule/template',
    method: 'get',
    responseType: 'blob'
  })
}

/**
 * 更新健康规则
 * @param {Object} data - 规则数据
 * @param {number} data.ruleId - 规则ID（更新时必填）
 * @param {number} data.copyFromRuleId - 复制来源规则ID（复制时必填）
 * @param {string} data.ruleName - 规则名称
 * @param {string} data.indicatorName - 指标名称
 * @param {string} data.category - 指标分类
 * @param {string} data.thresholdValue - 阈值
 * @param {string} data.thresholdUnit - 阈值单位
 * @param {string} data.authorityExplanation - 权威解释
 * @param {number} data.effectWay - 生效方式：1-即时生效，2-定时生效
 * @param {string} data.effectTime - 定时生效时间
 */
export const updateHealthRule = (data) => {
  return request({
    url: '/health-rule/update',
    method: 'put',
    data
  })
}

/**
 * 版本回滚
 * @param {Object} data - 回滚数据
 * @param {number} data.ruleId - 规则ID
 * @param {number} data.targetVersionId - 目标版本ID
 */
export const rollbackVersion = (data) => {
  return request({
    url: '/health-rule/rollback',
    method: 'post',
    data
  })
}

/**
 * 规则关联模板（批量）
 * @param {Object} data - 关联数据
 * @param {string} data.operateType - 操作类型：'bind'|'unbind'
 * @param {Array} data.ruleIds - 规则ID数组
 * @param {Array} data.templateIds - 模板ID数组
 */
export const bindTemplate = (data) => {
  return request({
    url: '/health-rule/bind-template',
    method: 'post',
    data
  })
}

/**
 * 获取指标分类列表
 */
export const getCategories = () => {
  return request({
    url: '/health-rule/category',
    method: 'get'
  })
}

/**
 * 查询操作日志
 * @param {Object} params - 查询参数
 * @param {string} params.operateType - 操作类型
 * @param {string} params.startDate - 开始时间
 * @param {string} params.endDate - 结束时间
 * @param {number} params.page - 页码
 * @param {number} params.limit - 每页条数
 */
export const getOperateLogs = (params) => {
  return request({
    url: '/health-rule/operate-log',
    method: 'get',
    params
  })
}

/**
 * 同步标准字典
 * @param {Object} data - 字典数据
 * @param {Array} data.dictData - 字典数据数组
 */
export const syncDict = (data) => {
  return request({
    url: '/health-rule/sync-dict',
    method: 'post',
    data
  })
}

/**
 * 获取规则详情
 * @param {number} ruleId - 规则ID
 */
export const getRuleDetail = (ruleId) => {
  return request({
    url: `/health-rule/detail/${ruleId}`,
    method: 'get'
  })
}

/**
 * 获取规则版本列表
 * @param {number} ruleId - 规则ID
 */
export const getRuleVersions = (ruleId) => {
  return request({
    url: `/health-rule/versions/${ruleId}`,
    method: 'get'
  })
}

/**
 * 获取版本关联的模板列表
 * @param {number} versionId - 版本ID
 */
export const getRuleTemplatesByVersion = (versionId) => {
  return request({
    url: `/health-rule/templates/${versionId}`,
    method: 'get'
  })
}

/**
 * 过期规则版本
 * @param {number} ruleId - 规则ID
 * @param {number} versionId - 版本ID
 */
export const expireVersion = (ruleId, versionId) => {
  return request({
    url: '/health-rule/expire-version',
    method: 'post',
    data: { ruleId, versionId }
  })
}

/**
 * 删除健康规则
 * @param {number} ruleId - 规则ID
 */
export const deleteHealthRule = (ruleId) => {
  return request({
    url: `/health-rule/${ruleId}`,
    method: 'delete'
  })
}

/**
 * 批量删除健康规则
 * @param {Array} ruleIds - 规则ID数组
 */
export const batchDeleteHealthRule = (ruleIds) => {
  return request({
    url: '/health-rule/batch-delete',
    method: 'delete',
    data: { ruleIds }
  })
}

/**
 * 删除操作日志
 * @param {number} logId - 日志ID
 */
export const deleteOperateLog = (logId) => {
  return request({
    url: `/health-rule/operate-log/${logId}`,
    method: 'delete'
  })
}

/**
 * 批量删除操作日志
 * @param {Array} logIds - 日志ID数组
 */
export const batchDeleteOperateLog = (logIds) => {
  return request({
    url: '/health-rule/operate-log/batch-delete',
    method: 'delete',
    data: { logIds }
  })
}

