/**
 * Axios请求封装
 * 统一baseURL、请求拦截器添加token、响应拦截器处理统一返回格式
 */

import axios from 'axios'
import { ElMessage } from 'element-plus'
import router from '@/router'

// 创建axios实例
const service = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api', // 从环境变量读取，默认/api
  timeout: 60000, // 请求超时时间（60秒，同步操作可能需要更长时间）
  headers: {
    'Content-Type': 'application/json;charset=UTF-8'
  }
})

// 请求拦截器
service.interceptors.request.use(
  config => {
    // 从localStorage获取token
    const token = localStorage.getItem('token')
    if (token) {
      // 在请求头中添加token
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  error => {
    console.error('请求错误：', error)
    return Promise.reject(error)
  }
)

// 响应拦截器
service.interceptors.response.use(
  response => {
    const res = response.data
    
    // 后端统一返回格式：{ code, message, data }
    if (res.code === 200) {
      // 请求成功，直接返回data
      return res.data
    } else {
      // 业务错误（如参数验证失败、权限不足等）
      // 404错误不自动弹出消息，由具体业务逻辑处理
      // 对于创建操作（创建用户、创建标签、创建推送任务），不在这里显示错误，由具体业务逻辑处理
      const errorMessage = res.message || '请求失败'
      const isCreateOperation = errorMessage.includes('创建用户失败') || 
                                errorMessage.includes('创建标签失败') ||
                                errorMessage.includes('创建推送任务失败')
      
      if (res.code !== 404 && !isCreateOperation) {
        ElMessage.error(errorMessage)
      }
      
      // 401未授权，清除token并跳转到登录页
      if (res.code === 401) {
        localStorage.removeItem('token')
        localStorage.removeItem('adminInfo')
        router.push('/login')
      }
      
      return Promise.reject(new Error(errorMessage))
    }
  },
  error => {
    console.error('响应错误：', error)
    
    // HTTP错误处理
    if (error.response) {
      const { status, data } = error.response
      
      switch (status) {
        case 401:
          ElMessage.error('未授权，请重新登录')
          localStorage.removeItem('token')
          localStorage.removeItem('adminInfo')
          router.push('/login')
          break
        case 403:
          ElMessage.error('禁止访问')
          break
        case 404:
          // 404错误不自动弹出消息，由具体业务逻辑处理
          // 只有在明确是用户不存在时才提示
          if (data?.message && data.message.includes('用户不存在')) {
            ElMessage.error('用户不存在')
          } else if (data?.message && data.message.includes('标签不存在')) {
            ElMessage.error('标签不存在')
          } else {
            // 其他404错误不提示，避免干扰
          }
          break
        case 500:
          ElMessage.error('服务器内部错误')
          break
        default:
          // 只有在有明确错误消息时才提示
          if (data?.message) {
            ElMessage.error(data.message)
          }
      }
    } else if (error.request) {
      // 请求已发出但没有收到响应
      ElMessage.error('网络错误，请检查网络连接')
    } else {
      // 请求配置错误
      ElMessage.error(error.message || '请求配置错误')
    }
    
    return Promise.reject(error)
  }
)

export default service

