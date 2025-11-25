<template>
  <div class="header-container">
    <div class="header-left">
      <span class="system-name">智慧健康小程序 - 管理员后台</span>
    </div>
    
    <div class="header-right">
      <el-dropdown @command="handleCommand">
        <div class="admin-info">
          <el-avatar :size="32" :src="adminInfo?.avatar">
            <el-icon><User /></el-icon>
          </el-avatar>
          <span class="admin-name">{{ adminInfo?.nickname || '管理员' }}</span>
          <el-icon class="arrow-down"><ArrowDown /></el-icon>
        </div>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="info">
              <el-icon><User /></el-icon>
              个人信息
            </el-dropdown-item>
            <el-dropdown-item command="password">
              <el-icon><Lock /></el-icon>
              修改密码
            </el-dropdown-item>
            <el-dropdown-item divided command="logout">
              <el-icon><SwitchButton /></el-icon>
              安全退出
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { User, ArrowDown, Lock, SwitchButton } from '@element-plus/icons-vue'
import { getAdminInfo } from '@/api/auth'
import CommonConfirm from '@/components/CommonConfirm.vue'

const router = useRouter()
const adminInfo = ref(null)

// 加载管理员信息
const loadAdminInfo = async () => {
  try {
    const info = await getAdminInfo()
    adminInfo.value = info
    localStorage.setItem('adminInfo', JSON.stringify(info))
  } catch (error) {
    console.error('获取管理员信息失败：', error)
  }
}

// 从localStorage恢复管理员信息
const restoreAdminInfo = () => {
  const saved = localStorage.getItem('adminInfo')
  if (saved) {
    try {
      adminInfo.value = JSON.parse(saved)
    } catch (error) {
      console.error('解析管理员信息失败：', error)
    }
  }
}

// 更新管理员信息（从事件或 localStorage）
const updateAdminInfo = (newInfo) => {
  if (newInfo) {
    adminInfo.value = newInfo
  } else {
    // 如果没有传入新信息，从 localStorage 读取
    restoreAdminInfo()
  }
}

// 监听管理员信息更新事件
const handleAdminInfoUpdated = (event) => {
  if (event.detail) {
    adminInfo.value = event.detail
  } else {
    // 如果没有详情，重新加载
    loadAdminInfo()
  }
}

// 监听 localStorage 变化（跨标签页同步）
const handleStorageChange = (event) => {
  if (event.key === 'adminInfo') {
    restoreAdminInfo()
  }
}

// 下拉菜单命令处理
const handleCommand = (command) => {
  switch (command) {
    case 'info':
      router.push('/profile')
      break
    case 'password':
      router.push('/change-password')
      break
    case 'logout':
      handleLogout()
      break
  }
}

// 安全退出
const handleLogout = () => {
  ElMessageBox.confirm(
    '确定要退出登录吗？',
    '提示',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(() => {
    // 清除本地存储
    localStorage.removeItem('token')
    localStorage.removeItem('adminInfo')
    
    ElMessage.success('退出成功')
    
    // 跳转到登录页
    router.push('/login')
  }).catch(() => {
    // 用户取消
  })
}

onMounted(() => {
  restoreAdminInfo()
  loadAdminInfo()
  
  // 监听自定义事件
  window.addEventListener('adminInfoUpdated', handleAdminInfoUpdated)
  // 监听 localStorage 变化（用于跨标签页同步）
  window.addEventListener('storage', handleStorageChange)
})

onUnmounted(() => {
  // 清理事件监听
  window.removeEventListener('adminInfoUpdated', handleAdminInfoUpdated)
  window.removeEventListener('storage', handleStorageChange)
})
</script>

<style scoped>
.header-container {
  height: 60px;
  background-color: #fff;
  border-bottom: 1px solid #e4e7ed;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 20px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.header-left {
  display: flex;
  align-items: center;
}

.system-name {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}

.header-right {
  display: flex;
  align-items: center;
}

.admin-info {
  display: flex;
  align-items: center;
  cursor: pointer;
  padding: 5px 10px;
  border-radius: 4px;
  transition: background-color 0.3s;
}

.admin-info:hover {
  background-color: #f5f7fa;
}

.admin-name {
  margin: 0 8px;
  color: #303133;
  font-size: 14px;
}

.arrow-down {
  font-size: 12px;
  color: #909399;
}

:deep(.el-dropdown-menu__item) {
  display: flex;
  align-items: center;
}

:deep(.el-dropdown-menu__item .el-icon) {
  margin-right: 8px;
}
</style>

