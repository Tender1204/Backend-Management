<template>
  <div class="menu-container">
    <div class="logo">
      <h2>健康管理平台</h2>
    </div>
    
    <el-menu
      :default-active="activeMenu"
      class="sidebar-menu"
      :collapse="false"
      background-color="#304156"
      text-color="#bfcbd9"
      active-text-color="#409EFF"
      @select="handleMenuSelect"
    >
      <el-menu-item index="/dashboard">
        <el-icon><DataBoard /></el-icon>
        <span>控制台</span>
      </el-menu-item>
      
      <el-sub-menu index="/users">
        <template #title>
          <el-icon><User /></el-icon>
          <span>用户管理</span>
        </template>
        <el-menu-item index="/users/list">用户列表</el-menu-item>
        <el-menu-item index="/users/tags">用户标签管理</el-menu-item>
      </el-sub-menu>
      
      <el-sub-menu index="/rules">
        <template #title>
          <el-icon><Document /></el-icon>
          <span>健康规则管理</span>
        </template>
        <el-menu-item index="/rules/config">基础规则配置</el-menu-item>
        <el-menu-item index="/rules/import">卫健委指标导入</el-menu-item>
        <el-menu-item index="/rules/rule-config">规则配置与版本管理</el-menu-item>
        <el-menu-item index="/rules/templates">规则模板管理</el-menu-item>
        <el-menu-item index="/rules/statistics">规则效果统计</el-menu-item>
      </el-sub-menu>
      
      <el-sub-menu index="/content">
        <template #title>
          <el-icon><Document /></el-icon>
          <span>内容管理</span>
        </template>
        <el-menu-item index="/content/list">健康知识维护</el-menu-item>
        <el-menu-item index="/content/push">文章推送</el-menu-item>
        <el-menu-item index="/content/calendar">运营日历</el-menu-item>
      </el-sub-menu>
      
      <el-sub-menu index="/statistics">
        <template #title>
          <el-icon><DataAnalysis /></el-icon>
          <span>数据统计分析</span>
        </template>
        <el-menu-item index="/statistics/global-indicators">全局指标分析</el-menu-item>
        <el-menu-item index="/statistics/user-dimension">用户维度分析</el-menu-item>
        <el-menu-item index="/statistics/function-usage">功能使用分析</el-menu-item>
      </el-sub-menu>
      
      <el-sub-menu index="/ai">
        <template #title>
          <el-icon><ChatLineRound /></el-icon>
          <span>AI模块辅助管理</span>
        </template>
        <el-menu-item index="/ai/sync-knowledge">知识库管理</el-menu-item>
        <el-menu-item index="/ai/qa-log-config">问答日志与模板配置</el-menu-item>
        <el-menu-item index="/ai/report-manage">报告管理</el-menu-item>
      </el-sub-menu>
      
      <el-sub-menu index="/system">
        <template #title>
          <el-icon><Setting /></el-icon>
          <span>系统管理</span>
        </template>
        <el-menu-item index="/system/config">系统配置</el-menu-item>
        <el-menu-item index="/system/logs">系统日志</el-menu-item>
        <el-menu-item index="/system/backup">数据备份</el-menu-item>
      </el-sub-menu>
    </el-menu>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  DataBoard,
  User,
  Document,
  DataAnalysis,
  ChatLineRound,
  Setting
} from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()

// 计算当前激活的菜单项
const activeMenu = computed(() => {
  const { path } = route
  // 处理子路由，确保父菜单也能高亮
  if (path.startsWith('/ai')) {
    return '/ai'
  }
  if (path.startsWith('/system')) {
    return '/system'
  }
  if (path.startsWith('/users')) {
    return '/users'
  }
  if (path.startsWith('/rules')) {
    return '/rules'
  }
  if (path.startsWith('/statistics')) {
    return '/statistics'
  }
  if (path.startsWith('/content')) {
    return '/content'
  }
  return path
})

// 处理菜单选择事件
const handleMenuSelect = (index) => {
  if (!index) return
  
  const targetPath = index.split('?')[0]
  const currentPath = route.path
  
  // 如果当前路径和目标路径相同，直接返回（避免重复导航）
  if (currentPath === targetPath) {
    return
  }
  
  // 使用 window.location 确保页面正确跳转
  if (index.startsWith('/')) {
    window.location.href = index
  } else {
    window.location.href = '/' + index
  }
}
</script>

<style scoped>
.menu-container {
  width: 200px;
  height: 100vh;
  background-color: #304156;
  overflow-y: auto;
  flex-shrink: 0;
}

.logo {
  height: 60px;
  line-height: 60px;
  text-align: center;
  background-color: #2b3a4a;
  border-bottom: 1px solid #1f2d3d;
}

.logo h2 {
  color: #fff;
  font-size: 18px;
  font-weight: 600;
  margin: 0;
}

.sidebar-menu {
  border: none;
  width: 200px;
}

.sidebar-menu:not(.el-menu--collapse) {
  width: 200px;
}

/* 菜单项样式 */
:deep(.el-menu-item),
:deep(.el-sub-menu__title) {
  height: 50px;
  line-height: 50px;
}

:deep(.el-menu-item:hover),
:deep(.el-sub-menu__title:hover) {
  background-color: #263445 !important;
}

:deep(.el-menu-item.is-active) {
  background-color: #1890ff !important;
  color: #fff !important;
}

:deep(.el-sub-menu .el-menu-item) {
  background-color: #1f2d3d !important;
  padding-left: 50px !important;
}

:deep(.el-sub-menu .el-menu-item:hover) {
  background-color: #263445 !important;
}
</style>

