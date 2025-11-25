<template>
  <div class="profile-container">
    <el-card class="profile-card">
      <template #header>
        <div class="card-header">
          <h2>个人信息</h2>
        </div>
      </template>
      
      <el-form
        ref="profileFormRef"
        :model="profileForm"
        :rules="profileRules"
        label-width="120px"
        class="profile-form"
      >
        <el-form-item label="用户名">
          <el-input v-model="profileForm.username" disabled />
        </el-form-item>
        
        <el-form-item label="昵称" prop="nickname">
          <el-input v-model="profileForm.nickname" placeholder="请输入昵称" />
        </el-form-item>
        
        <el-form-item label="头像">
          <div class="avatar-upload">
            <el-avatar :size="100" :src="profileForm.avatar">
              <el-icon><User /></el-icon>
            </el-avatar>
            <el-button type="text" @click="handleAvatarClick" style="margin-top: 10px">
              更换头像
            </el-button>
            <input
              ref="avatarInputRef"
              type="file"
              accept="image/*"
              style="display: none"
              @change="handleAvatarChange"
            />
          </div>
        </el-form-item>
        
        <el-form-item label="账号状态">
          <el-tag :type="profileForm.status === 1 ? 'success' : 'danger'">
            {{ profileForm.status === 1 ? '启用' : '禁用' }}
          </el-tag>
        </el-form-item>
        
        <el-form-item label="最后登录时间">
          <span>{{ profileForm.last_login_time || '暂无' }}</span>
        </el-form-item>
        
        <el-form-item label="最后登录IP">
          <span>{{ profileForm.last_login_ip || '暂无' }}</span>
        </el-form-item>
        
        <el-form-item label="创建时间">
          <span>{{ profileForm.created_at || '暂无' }}</span>
        </el-form-item>
        
        <el-form-item>
          <el-button type="primary" @click="handleSave" :loading="saving">
            保存修改
          </el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { User } from '@element-plus/icons-vue'
import { getAdminInfo, updateAdminInfo } from '@/api/auth'

const profileFormRef = ref(null)
const avatarInputRef = ref(null)
const saving = ref(false)

const profileForm = reactive({
  id: null,
  username: '',
  nickname: '',
  avatar: '',
  status: 1,
  last_login_time: '',
  last_login_ip: '',
  created_at: ''
})

const originalForm = ref({})

const profileRules = {
  nickname: [
    { required: true, message: '请输入昵称', trigger: 'blur' },
    { min: 2, max: 20, message: '昵称长度在2到20个字符', trigger: 'blur' }
  ]
}

// 加载管理员信息
const loadAdminInfo = async () => {
  try {
    const info = await getAdminInfo()
    Object.assign(profileForm, info)
    originalForm.value = { ...info }
  } catch (error) {
    console.error('加载管理员信息失败：', error)
    ElMessage.error('加载信息失败')
  }
}

// 点击头像上传
const handleAvatarClick = () => {
  avatarInputRef.value?.click()
}

// 压缩图片
const compressImage = (file, maxWidth = 200, maxHeight = 200, quality = 0.8) => {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let width = img.width
        let height = img.height
        
        // 计算压缩后的尺寸
        if (width > height) {
          if (width > maxWidth) {
            height = (height * maxWidth) / width
            width = maxWidth
          }
        } else {
          if (height > maxHeight) {
            width = (width * maxHeight) / height
            height = maxHeight
          }
        }
        
        canvas.width = width
        canvas.height = height
        
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)
        
        // 转换为 base64
        const base64 = canvas.toDataURL('image/jpeg', quality)
        resolve(base64)
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  })
}

// 头像文件变化
const handleAvatarChange = async (event) => {
  const file = event.target.files[0]
  if (!file) return
  
  // 检查文件类型
  if (!file.type.startsWith('image/')) {
    ElMessage.error('请选择图片文件')
    return
  }
  
  // 检查文件大小（限制为 2MB）
  if (file.size > 2 * 1024 * 1024) {
    ElMessage.warning('图片大小不能超过 2MB，正在压缩...')
  }
  
  try {
    // 压缩图片
    const compressedBase64 = await compressImage(file)
    profileForm.avatar = compressedBase64
    ElMessage.success('头像已加载，点击保存即可更新')
  } catch (error) {
    console.error('图片处理失败：', error)
    ElMessage.error('图片处理失败，请重试')
  }
  
  // 清空 input，以便可以重复选择同一文件
  event.target.value = ''
}

// 保存修改
const handleSave = async () => {
  if (!profileFormRef.value) return
  
  await profileFormRef.value.validate(async (valid) => {
    if (!valid) return false
    
    saving.value = true
    try {
      const response = await updateAdminInfo({
        nickname: profileForm.nickname,
        avatar: profileForm.avatar
      })
      
      // 更新本地表单数据
      if (response && response.id) {
        // 使用接口返回的最新数据
        Object.assign(profileForm, response)
        originalForm.value = { ...response }
      } else {
        // 如果接口没有返回完整数据，重新加载
        await loadAdminInfo()
      }
      
      // 更新 localStorage 中的管理员信息（用于 Header 组件显示）
      const adminInfo = {
        id: profileForm.id,
        username: profileForm.username,
        nickname: profileForm.nickname,
        avatar: profileForm.avatar
      }
      localStorage.setItem('adminInfo', JSON.stringify(adminInfo))
      
      // 触发自定义事件，通知 Header 组件更新
      window.dispatchEvent(new CustomEvent('adminInfoUpdated', { 
        detail: adminInfo 
      }))
      
      ElMessage.success('保存成功，信息已自动刷新')
    } catch (error) {
      console.error('保存失败：', error)
    } finally {
      saving.value = false
    }
  })
}

// 重置
const handleReset = () => {
  Object.assign(profileForm, originalForm.value)
  ElMessage.info('已重置')
}

onMounted(() => {
  loadAdminInfo()
})
</script>

<style scoped>
.profile-container {
  padding: 20px;
  background: #fff;
  min-height: calc(100vh - 60px);
}

.profile-card {
  max-width: 800px;
  margin: 0 auto;
}

.card-header h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}

.profile-form {
  margin-top: 20px;
}

.avatar-upload {
  display: flex;
  flex-direction: column;
  align-items: center;
}
</style>

