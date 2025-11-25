/**
 * 系统管理相关API
 */

import request from './request'

/**
 * 获取系统配置列表
 * @param {Object} params - 查询参数
 * @param {string} params.groupName - 配置分组
 * @param {number} params.page - 页码
 * @param {number} params.limit - 每页条数
 */
export const getConfigList = (params) => {
  return request({
    url: '/system/configs',
    method: 'get',
    params
  })
}

/**
 * 获取系统配置详情
 * @param {string} key - 配置键
 */
export const getConfigDetail = (key) => {
  return request({
    url: `/system/configs/${key}`,
    method: 'get'
  })
}

/**
 * 保存系统配置（创建或更新）
 * @param {Object} data - 配置数据
 */
export const saveConfig = (data) => {
  return request({
    url: '/system/configs',
    method: 'post',
    data
  })
}

/**
 * 删除系统配置
 * @param {string} key - 配置键
 */
export const deleteConfig = (key) => {
  return request({
    url: `/system/configs/${key}`,
    method: 'delete'
  })
}

/**
 * 获取系统日志列表
 * @param {Object} params - 查询参数
 * @param {string} params.logType - 日志类型
 * @param {string} params.moduleName - 模块名称
 * @param {string} params.startDate - 开始时间
 * @param {string} params.endDate - 结束时间
 * @param {number} params.page - 页码
 * @param {number} params.limit - 每页条数
 */
export const getLogList = (params) => {
  return request({
    url: '/system/logs',
    method: 'get',
    params
  })
}

/**
 * 获取系统日志详情
 * @param {number} id - 日志ID
 */
export const getLogDetail = (id) => {
  return request({
    url: `/system/logs/${id}`,
    method: 'get'
  })
}

/**
 * 获取备份列表
 * @param {Object} params - 查询参数
 * @param {string} params.backupType - 备份类型
 * @param {number} params.backupStatus - 备份状态
 * @param {number} params.page - 页码
 * @param {number} params.limit - 每页条数
 */
export const getBackupList = (params) => {
  return request({
    url: '/system/backups',
    method: 'get',
    params
  })
}

/**
 * 创建数据备份
 * @param {Object} data - 备份数据
 */
export const createBackup = (data) => {
  return request({
    url: '/system/backups',
    method: 'post',
    data
  })
}

/**
 * 删除备份
 * @param {number} id - 备份ID
 */
export const deleteBackup = (id) => {
  return request({
    url: `/system/backups/${id}`,
    method: 'delete'
  })
}

