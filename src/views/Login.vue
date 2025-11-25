<template>
  <section class="login-section">
    <div class="box">
      <div class="form">
        <img src="/images/_user.jpg" class="user" alt="用户头像">
        <h2>健康管理平台</h2>
        <el-form
          ref="loginFormRef"
          :model="loginForm"
          :rules="loginRules"
          @submit.prevent="handleLogin"
        >
          <el-form-item prop="username">
            <div class="inputBx">
              <input
                v-model="loginForm.username"
                type="text"
                placeholder="请输入用户名"
                autofocus
              >
              <img src="/images/user.png" alt="用户名图标">
            </div>
          </el-form-item>
          
          <el-form-item prop="password">
            <div class="inputBx">
              <input
                v-model="loginForm.password"
                type="password"
                placeholder="请输入密码"
                @keyup.enter="handleLogin"
              >
              <img src="/images/lock.png" alt="密码图标">
            </div>
          </el-form-item>
          
          <el-form-item>
            <label class="remeber">
              <input type="checkbox" v-model="rememberMe"> 记住我
            </label>
          </el-form-item>
          
          <el-form-item>
            <div class="inputBx">
              <el-button
                type="primary"
                :loading="loading"
                @click="handleLogin"
                class="login-btn"
              >
                登录
              </el-button>
            </div>
          </el-form-item>
        </el-form>
        <p>忘记 <a href="#" @click.prevent="handleForgotPassword">密码</a>?</p>
      </div>
    </div>
    
    <!-- 忘记密码对话框 -->
    <el-dialog
      v-model="forgotPasswordDialogVisible"
      title="忘记密码"
      width="400px"
      :close-on-click-modal="false"
    >
      <el-form
        ref="forgotPasswordFormRef"
        :model="forgotPasswordForm"
        :rules="forgotPasswordRules"
        label-width="80px"
      >
        <el-form-item label="用户名" prop="username">
          <el-input
            v-model="forgotPasswordForm.username"
            placeholder="请输入用户名"
            @keyup.enter="handleSendResetRequest"
          />
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="forgotPasswordDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="forgotPasswordLoading" @click="handleSendResetRequest">
          发送重置请求
        </el-button>
      </template>
    </el-dialog>
    
    <!-- 重置密码对话框 -->
    <el-dialog
      v-model="resetPasswordDialogVisible"
      title="重置密码"
      width="400px"
      :close-on-click-modal="false"
    >
      <el-form
        ref="resetPasswordFormRef"
        :model="resetPasswordForm"
        :rules="resetPasswordRules"
        label-width="100px"
      >
        <el-form-item label="用户名" prop="username">
          <el-input
            v-model="resetPasswordForm.username"
            placeholder="请输入用户名"
            disabled
          />
        </el-form-item>
        <el-form-item label="重置令牌" prop="resetToken">
          <el-input
            v-model="resetPasswordForm.resetToken"
            placeholder="请输入重置令牌"
            @keyup.enter="handleResetPassword"
          />
        </el-form-item>
        <el-form-item label="新密码" prop="newPassword">
          <el-input
            v-model="resetPasswordForm.newPassword"
            type="password"
            placeholder="请输入新密码（至少6位）"
            show-password
            @keyup.enter="handleResetPassword"
          />
        </el-form-item>
        <el-form-item label="确认密码" prop="confirmPassword">
          <el-input
            v-model="resetPasswordForm.confirmPassword"
            type="password"
            placeholder="请再次输入新密码"
            show-password
            @keyup.enter="handleResetPassword"
          />
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="resetPasswordDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="resetPasswordLoading" @click="handleResetPassword">
          重置密码
        </el-button>
      </template>
    </el-dialog>
  </section>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { login, forgotPassword, resetPassword } from '@/api/auth'

const router = useRouter()
const loginFormRef = ref(null)
const forgotPasswordFormRef = ref(null)
const resetPasswordFormRef = ref(null)
const loading = ref(false)
const rememberMe = ref(false)
const forgotPasswordDialogVisible = ref(false)
const resetPasswordDialogVisible = ref(false)
const forgotPasswordLoading = ref(false)
const resetPasswordLoading = ref(false)

// 登录表单数据
const loginForm = reactive({
  username: '',
  password: ''
})

// 忘记密码表单数据
const forgotPasswordForm = reactive({
  username: ''
})

// 重置密码表单数据
const resetPasswordForm = reactive({
  username: '',
  resetToken: '',
  newPassword: '',
  confirmPassword: ''
})

// 表单验证规则
const loginRules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码长度不能少于6位', trigger: 'blur' }
  ]
}

const forgotPasswordRules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' }
  ]
}

const resetPasswordRules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' }
  ],
  resetToken: [
    { required: true, message: '请输入重置令牌', trigger: 'blur' }
  ],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, message: '密码长度不能少于6位', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '请再次输入新密码', trigger: 'blur' },
    {
      validator: (rule, value, callback) => {
        if (value !== resetPasswordForm.newPassword) {
          callback(new Error('两次输入的密码不一致'))
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
  ]
}

// 处理登录
const handleLogin = async () => {
  if (!loginFormRef.value) return
  
  // 表单验证
  await loginFormRef.value.validate(async (valid) => {
    if (!valid) {
      return false
    }
    
    loading.value = true
    
    try {
      // 调用登录API
      const data = await login({
        username: loginForm.username,
        password: loginForm.password
      })
      
      // 保存token和管理员信息
      localStorage.setItem('token', data.token)
      localStorage.setItem('adminInfo', JSON.stringify({
        id: data.id,
        username: data.username,
        nickname: data.nickname,
        avatar: data.avatar
      }))
      
      // 如果勾选了记住我，保存用户名（不保存密码，安全考虑）
      if (rememberMe.value) {
        localStorage.setItem('rememberedUsername', loginForm.username)
      } else {
        localStorage.removeItem('rememberedUsername')
      }
      
      ElMessage.success('登录成功')
      
      // 跳转到首页或之前访问的页面
      const redirect = router.currentRoute.value.query.redirect || '/'
      router.push(redirect)
      
    } catch (error) {
      console.error('登录失败：', error)
      // 错误信息已在axios拦截器中处理
    } finally {
      loading.value = false
    }
  })
}

// 忘记密码
const handleForgotPassword = () => {
  forgotPasswordForm.username = loginForm.username || ''
  forgotPasswordDialogVisible.value = true
}

// 发送重置密码请求
const handleSendResetRequest = async () => {
  if (!forgotPasswordFormRef.value) return
  
  await forgotPasswordFormRef.value.validate(async (valid) => {
    if (!valid) return false
    
    forgotPasswordLoading.value = true
    
    try {
      const response = await forgotPassword({
        username: forgotPasswordForm.username
      })
      
      // 开发模式下，显示重置令牌
      if (response.resetToken) {
        ElMessageBox.alert(
          `重置令牌已生成（开发模式）\n\n重置令牌：${response.resetToken}\n\n请复制此令牌用于重置密码`,
          '重置密码请求成功',
          {
            confirmButtonText: '确定',
            type: 'success',
            dangerouslyUseHTMLString: false
          }
        ).then(() => {
          forgotPasswordDialogVisible.value = false
          // 打开重置密码对话框
          resetPasswordForm.username = forgotPasswordForm.username
          resetPasswordForm.resetToken = response.resetToken
          resetPasswordDialogVisible.value = true
        })
      } else {
        ElMessage.success('重置密码请求已发送，请查看您的邮箱')
        forgotPasswordDialogVisible.value = false
      }
    } catch (error) {
      console.error('发送重置密码请求失败：', error)
    } finally {
      forgotPasswordLoading.value = false
    }
  })
}

// 重置密码
const handleResetPassword = async () => {
  if (!resetPasswordFormRef.value) return
  
  await resetPasswordFormRef.value.validate(async (valid) => {
    if (!valid) return false
    
    resetPasswordLoading.value = true
    
    try {
      await resetPassword({
        username: resetPasswordForm.username,
        resetToken: resetPasswordForm.resetToken,
        newPassword: resetPasswordForm.newPassword
      })
      
      ElMessage.success('密码重置成功，请使用新密码登录')
      resetPasswordDialogVisible.value = false
      
      // 清空表单
      resetPasswordForm.resetToken = ''
      resetPasswordForm.newPassword = ''
      resetPasswordForm.confirmPassword = ''
    } catch (error) {
      console.error('重置密码失败：', error)
    } finally {
      resetPasswordLoading.value = false
    }
  })
}

// 页面加载时，如果有记住的用户名，自动填充
const rememberedUsername = localStorage.getItem('rememberedUsername')
if (rememberedUsername) {
  loginForm.username = rememberedUsername
  rememberMe.value = true
}
</script>

<style scoped>
.login-section {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: linear-gradient(-25deg, #03a9f4 0%, #3a78b7 50%, #262626 50%, #607d8d 100%);
  backdrop-filter: hue-rotate(120deg);
  animation: animate 10s ease-in infinite;
}

@keyframes animate {
  0% {
    filter: hue-rotate(0deg);
  }
  100% {
    filter: hue-rotate(360deg);
  }
}

.box {
  position: relative;
  padding: 50px;
  padding-top: 0px;
  width: 360px;
  min-height: 480px;
  display: flex;
  transform: translateY(-800px);
  justify-content: center;
  align-items: center;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  box-shadow: 0 5px 35px rgba(0, 0, 0, 0.2);
  animation: appare 1.5s linear;
  animation-iteration-count: 1;
  animation-direction: normal;
  animation-fill-mode: forwards;
}

@keyframes appare {
  0% {
    transform: translateY(-800px);
  }
  40% {
    transform: translateY(0px);
  }
  55% {
    transform: translateY(-80px);
  }
  70% {
    transform: translateY(0px);
  }
  85% {
    transform: translateY(-40px);
  }
  100% {
    transform: translateY(0px);
  }
}

.box::after {
  content: "";
  position: absolute;
  top: 5px;
  left: 5px;
  right: 5px;
  bottom: 5px;
  border-radius: 5px;
  pointer-events: none;
  background: linear-gradient(to bottom, rgba(255, 255, 255, 0.3) 0%, rgba(255, 255, 255, 0.1) 15%, transparent 50%, transparent 85%, rgba(255, 255, 255, 0.3) 100%);
}

.box .form {
  position: relative;
  width: 100%;
}

.box .form h2 {
  color: white;
  font-weight: 600;
  letter-spacing: 2px;
  margin-bottom: 30px;
  text-align: center;
  position: relative;
  top: -20px;
}

.box .form .inputBx {
  position: relative;
  width: 100%;
  margin-bottom: 20px;
}

.box .form .inputBx input {
  width: 100%;
  outline: none;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: transparent;
  padding: 8px 10px;
  padding-left: 35px;
  border-radius: 6px;
  color: white;
  font-size: 16px;
  font-weight: 300;
  box-shadow: inset 0 0 25px rgba(0, 0, 0, 0.2);
}

.box .form .inputBx input::placeholder {
  color: rgba(255, 255, 255, 0.6);
}

.box .form .inputBx img {
  position: absolute;
  top: 10px;
  left: 10px;
  transition: scale(0.7);
  filter: invert(1);
  width: 20px;
  height: 20px;
}

.remeber {
  position: relative;
  display: inline-block;
  color: white;
  font-weight: 300;
  margin-bottom: 10px;
  cursor: pointer;
}

.box .form p {
  color: white;
  font-weight: 300;
  font-size: 15px;
  margin-top: 5px;
  text-align: center;
}

.box .form a {
  color: white;
  text-decoration: none;
}

.box .form a:hover {
  color: #ffd700;
}

.user {
  width: 100px;
  height: 100px;
  border-radius: 50%;
  display: block;
  position: relative;
  top: -70px;
  filter: grayscale(1);
  margin: auto;
  box-shadow: 0 5px 35px rgba(0, 0, 0, 0.2);
  border: 5px solid rgba(255, 255, 255, 0.1);
}

.login-btn {
  width: 100%;
  background: white;
  color: black;
  padding: 8px 24px;
  font-weight: 700;
  letter-spacing: 1px;
  cursor: pointer;
  font-size: 16px;
  border: none;
}

.login-btn:hover {
  background: #f0f0f0;
}

:deep(.el-form-item) {
  margin-bottom: 20px;
}

:deep(.el-form-item__error) {
  color: #ffd700;
  font-size: 12px;
}

@media screen and (max-width: 400px) {
  .box {
    padding: 20px;
    width: 310px;
    min-height: 420px;
  }
}
</style>

