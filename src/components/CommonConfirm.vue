<template>
  <!-- 此组件主要用于统一确认弹窗的封装，实际使用中直接使用ElMessageBox即可 -->
</template>

<script>
/**
 * 统一确认弹窗组件
 * 用于删除、冻结等高危操作的确认
 * 实际使用中，可以直接使用Element Plus的ElMessageBox
 */

import { ElMessageBox } from 'element-plus'

/**
 * 确认删除
 * @param {String} message - 提示信息
 * @param {String} title - 标题
 * @returns {Promise}
 */
export const confirmDelete = (message = '确定要删除吗？', title = '提示') => {
  return ElMessageBox.confirm(message, title, {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning',
    dangerouslyUseHTMLString: false
  })
}

/**
 * 确认操作（通用）
 * @param {String} message - 提示信息
 * @param {String} title - 标题
 * @param {String} type - 类型：warning/info/success/error
 * @returns {Promise}
 */
export const confirmAction = (message, title = '提示', type = 'warning') => {
  return ElMessageBox.confirm(message, title, {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: type
  })
}

/**
 * 确认冻结/解冻
 * @param {String} action - 操作类型：freeze-冻结，unfreeze-解冻
 * @returns {Promise}
 */
export const confirmFreeze = (action = 'freeze') => {
  const message = action === 'freeze' ? '确定要冻结该账号吗？' : '确定要解冻该账号吗？'
  return ElMessageBox.confirm(message, '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  })
}

export default {
  confirmDelete,
  confirmAction,
  confirmFreeze
}
</script>

