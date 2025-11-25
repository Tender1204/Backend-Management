<template>
  <div class="change-password-container">
    <el-card class="password-card">
      <template #header>
        <div class="card-header">
          <h2>修改密码</h2>
        </div>
      </template>
      
      <el-form
        ref="passwordFormRef"
        :model="passwordForm"
        :rules="passwordRules"
        label-width="120px"
        class="password-form"
      >
        <el-form-item label="当前密码" prop="oldPassword">
          <el-input
            v-model="passwordForm.oldPassword"
            type="password"
            placeholder="请输入当前密码"
            show-password
            autocomplete="off"
          />
        </el-form-item>
        
        <el-form-item label="新密码" prop="newPassword">
          <el-input
            v-model="passwordForm.newPassword"
            type="password"
            placeholder="请输入新密码（至少6位）"
            show-password
            autocomplete="off"
          />
        </el-form-item>
        
        <el-form-item label="确认新密码" prop="confirmPassword">
          <el-input
            v-model="passwordForm.confirmPassword"
            type="password"
            placeholder="请再次输入新密码"
            show-password
            autocomplete="off"
          />
        </el-form-item>
        
        <el-form-item>
          <el-button type="primary" @click="handleSubmit" :loading="submitting">
            确认修改
          </el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
      
      <el-alert
        title="密码安全提示"
        type="info"
        :closable="false"
        style="margin-top: 20px"
      >
        <template #default>
          <ul style="margin: 8px 0; padding-left: 20px">
            <li>密码长度至少6位</li>
            <li>建议使用字母、数字和特殊字符组合</li>
            <li>定期更换密码以提高安全性</li>
          </ul>
        </template>
      </el-alert>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { changePassword } from '@/api/auth'

const router = useRouter()
const passwordFormRef = ref(null)
const submitting = ref(false)

const passwordForm = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
})

// 验证确认密码
const validateConfirmPassword = (rule, value, callback) => {
  if (value !== passwordForm.newPassword) {
    callback(new Error('两次输入的密码不一致'))
  } else {
    callback()
  }
}

const passwordRules = {
  oldPassword: [
    { required: true, message: '请输入当前密码', trigger: 'blur' }
  ],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, message: '密码长度不能少于6位', trigger: 'blur' },
    { max: 20, message: '密码长度不能超过20位', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '请再次输入新密码', trigger: 'blur' },
    { validator: validateConfirmPassword, trigger: 'blur' }
  ]
}

// 提交修改
const handleSubmit = async () => {
  if (!passwordFormRef.value) return
  
  await passwordFormRef.value.validate(async (valid) => {
    if (!valid) return false
    
    submitting.value = true
    try {
      await changePassword({
        oldPassword: passwordForm.oldPassword,
        newPassword: passwordForm.newPassword
      })
      
      ElMessage.success('密码修改成功，请重新登录')
      
      // 清除token，跳转到登录页
      setTimeout(() => {
        localStorage.removeItem('token')
        localStorage.removeItem('adminInfo')
        router.push('/login')
      }, 1500)
      
    } catch (error) {
      console.error('修改密码失败：', error)
    } finally {
      submitting.value = false
    }
  })
}

// 重置表单
const handleReset = () => {
  passwordFormRef.value?.resetFields()
  ElMessage.info('已重置')
}
</script>

<style scoped>
.change-password-container {
  padding: 20px;
  background: #fff;
  min-height: calc(100vh - 60px);
}

.password-card {
  max-width: 600px;
  margin: 0 auto;
}

.card-header h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}

.password-form {
  margin-top: 20px;
}
</style>

