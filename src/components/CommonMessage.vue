<template>
  <!-- 此组件主要用于统一消息提示的封装，实际使用中直接使用ElMessage即可 -->
  <!-- 这里提供一个工具函数供全局使用 -->
</template>

<script>
/**
 * 统一消息提示组件
 * 实际使用中，可以直接使用Element Plus的ElMessage
 * 这里提供一些封装好的方法，方便统一管理
 */

import { ElMessage } from 'element-plus'

/**
 * 成功提示
 * @param {String} message - 提示信息
 */
export const showSuccess = (message) => {
  ElMessage.success(message)
}

/**
 * 错误提示
 * @param {String} message - 提示信息
 */
export const showError = (message) => {
  ElMessage.error(message)
}

/**
 * 警告提示
 * @param {String} message - 提示信息
 */
export const showWarning = (message) => {
  ElMessage.warning(message)
}

/**
 * 信息提示
 * @param {String} message - 提示信息
 */
export const showInfo = (message) => {
  ElMessage.info(message)
}

export default {
  showSuccess,
  showError,
  showWarning,
  showInfo
}
</script>

