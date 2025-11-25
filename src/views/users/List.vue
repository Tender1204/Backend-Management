<template>
  <div class="user-list-container">
    <div class="page-header">
      <div class="header-left">
        <h2>
          <el-icon><User /></el-icon>
          用户管理
        </h2>
        <p class="page-desc">管理系统用户信息，支持筛选、查看、操作等功能</p>
      </div>
      <div class="header-right">
        <el-button type="primary" :icon="Plus" @click.stop="handleAddUser($event)">新增用户</el-button>
      </div>
    </div>

    <!-- 筛选表单 -->
    <el-card class="filter-card">
      <el-form :model="filterForm" :inline="true" class="filter-form">
        <el-form-item label="账号状态">
          <el-select v-model="filterForm.status" placeholder="全部" clearable style="width: 150px">
            <el-option label="启用" :value="1" />
            <el-option label="冻结" :value="0" />
          </el-select>
        </el-form-item>
        
        <el-form-item label="注册时间">
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
            style="width: 240px"
          />
        </el-form-item>
        
        <el-form-item label="昵称/手机号">
          <el-input
            v-model="filterForm.major"
            placeholder="请输入昵称或手机号"
            clearable
            style="width: 200px"
            @keyup.enter="handleSearch"
            @clear="handleReset"
          />
        </el-form-item>
        
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="handleSearch">查询</el-button>
          <el-button :icon="Refresh" @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 数据表格 -->
    <el-card class="table-card">
      <el-table
        v-loading="loading"
        :data="tableData"
        stripe
        style="width: 100%"
      >
        <el-table-column type="index" label="序号" width="80" :index="(index) => (pagination.page - 1) * pagination.limit + index + 1" />
        <el-table-column prop="nickname" label="昵称" width="120">
          <template #default="{ row }">
            <div class="user-info">
              <el-avatar :size="32" :src="row.avatar">
                <el-icon><User /></el-icon>
              </el-avatar>
              <span style="margin-left: 8px">{{ row.nickname || '未设置' }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="phone" label="手机号" width="120" />
        <el-table-column prop="email" label="邮箱" width="180" />
        <el-table-column prop="status" label="账号状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'danger'">
              {{ row.status === 1 ? '启用' : '冻结' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="tags" label="标签" width="250">
          <template #default="{ row }">
            <el-tag
              v-for="tag in row.tags"
              :key="tag"
              size="small"
              style="margin-right: 4px"
            >
              {{ tag }}
            </el-tag>
            <el-button
              type="primary"
              link
              size="small"
              :icon="Edit"
              @click.stop="handleEditTags(row, $event)"
            >
              编辑
            </el-button>
            <span v-if="!row.tags || row.tags.length === 0" class="text-muted">无标签</span>
          </template>
        </el-table-column>
        <el-table-column prop="register_time" label="注册时间" width="180" />
        <el-table-column prop="last_active_time" label="最后活跃" width="180" />
        <el-table-column label="操作" width="350" fixed="right">
          <template #default="{ row }">
            <el-button
              type="primary"
              link
              size="small"
              :icon="View"
              @click.stop="handleViewDetail(row.id, $event)"
            >
              查看详情
            </el-button>
            <el-button
              type="warning"
              link
              size="small"
              :icon="Key"
              @click="handleResetPassword(row)"
            >
              重置密码
            </el-button>
            <el-button
              :type="row.status === 1 ? 'danger' : 'success'"
              link
              size="small"
              :icon="row.status === 1 ? 'Lock' : 'Unlock'"
              @click="handleToggleStatus(row)"
            >
              {{ row.status === 1 ? '冻结' : '启用' }}
            </el-button>
            <el-button
              type="danger"
              link
              size="small"
              :icon="Delete"
              @click="handleDeleteUser(row)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pagination-wrapper">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.limit"
          :page-sizes="[10, 20, 50, 100]"
          :total="pagination.total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handlePageChange"
        />
      </div>
    </el-card>

    <!-- 密码重置对话框 -->
    <el-dialog
      v-model="passwordDialogVisible"
      title="密码重置成功"
      width="400px"
    >
      <div class="password-result">
        <el-alert
          type="success"
          :closable="false"
          show-icon
        >
          <template #title>
            <div>
              <p>临时密码已生成：</p>
              <div class="password-display">
                <el-input
                  v-model="tempPassword"
                  readonly
                  style="width: 200px"
                >
                  <template #append>
                    <el-button :icon="DocumentCopy" @click="handleCopyPassword">复制</el-button>
                  </template>
                </el-input>
              </div>
              <p class="password-tip">请妥善保管，用户首次登录后建议修改密码</p>
            </div>
          </template>
        </el-alert>
      </div>
      <template #footer>
        <el-button type="primary" @click="passwordDialogVisible = false">确定</el-button>
      </template>
    </el-dialog>

    <!-- 新增用户对话框 -->
    <el-dialog
      v-model="addUserDialogVisible"
      title="新增用户"
      width="600px"
    >
      <el-form
        :model="userForm"
        :rules="userRules"
        ref="userFormRef"
        label-width="100px"
      >
        <el-form-item label="昵称" prop="nickname">
          <el-input v-model="userForm.nickname" placeholder="请输入昵称" />
        </el-form-item>
        <el-form-item label="手机号" prop="phone">
          <el-input v-model="userForm.phone" placeholder="请输入手机号" />
        </el-form-item>
        <el-form-item label="邮箱">
          <el-input v-model="userForm.email" placeholder="请输入邮箱" />
        </el-form-item>
        <el-form-item label="性别">
          <el-radio-group v-model="userForm.gender">
            <el-radio :label="0">未知</el-radio>
            <el-radio :label="1">男</el-radio>
            <el-radio :label="2">女</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="生日">
          <el-date-picker
            v-model="userForm.birthday"
            type="date"
            placeholder="选择生日"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="身高(cm)">
          <el-input-number
            v-model="userForm.height"
            :min="0"
            :max="300"
            :precision="1"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="体重(kg)">
          <el-input-number
            v-model="userForm.weight"
            :min="0"
            :max="500"
            :precision="1"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="标签">
          <el-select
            v-model="userForm.tagIds"
            ref="userTagSelectRef"
            multiple
            placeholder="请选择标签"
            style="width: 100%"
            @change="handleTagSelectChange"
          >
            <el-option
              v-for="tag in tagsList"
              :key="tag.id"
              :label="tag.tag_name"
              :value="tag.id"
            >
              <div style="display: flex; align-items: center; gap: 8px;">
                <div 
                  :style="{ 
                    width: '12px', 
                    height: '12px', 
                    borderRadius: '2px', 
                    backgroundColor: tag.color || '#409EFF',
                    flexShrink: 0
                  }"
                ></div>
                <span style="color: #303133;">{{ tag.tag_name }}</span>
              </div>
            </el-option>
            <template #tag="{ item }">
              <el-tag
                v-if="item && item.value"
                :color="(tagsList && tagsList.find(t => t.id === item.value)?.color) || '#409EFF'"
                closable
                style="color: #fff;"
                @close="userForm.tagIds = userForm.tagIds.filter(id => id !== item.value)"
              >
                {{ item.label }}
              </el-tag>
            </template>
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addUserDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleConfirmAddUser">确定</el-button>
      </template>
    </el-dialog>

    <!-- 编辑标签对话框 -->
    <el-dialog
      v-model="editTagsDialogVisible"
      title="编辑用户标签"
      width="500px"
    >
      <el-select
        v-model="editingUserTags"
        ref="editTagSelectRef"
        multiple
        placeholder="请选择标签"
        style="width: 100%"
        @change="handleEditTagSelectChange"
      >
        <el-option
          v-for="tag in tagsList"
          :key="tag.id"
          :label="tag.tag_name"
          :value="tag.id"
        >
          <div style="display: flex; align-items: center; gap: 8px;">
            <div 
              :style="{ 
                width: '12px', 
                height: '12px', 
                borderRadius: '2px', 
                backgroundColor: tag.color || '#409EFF',
                flexShrink: 0
              }"
            ></div>
            <span style="color: #303133;">{{ tag.tag_name }}</span>
          </div>
        </el-option>
        <template #tag="{ item }">
          <el-tag
            v-if="item && item.value"
            :color="(tagsList && tagsList.find(t => t.id === item.value)?.color) || '#409EFF'"
            closable
            style="color: #fff;"
            @close="editingUserTags = editingUserTags.filter(id => id !== item.value)"
          >
            {{ item.label }}
          </el-tag>
        </template>
      </el-select>
      <template #footer>
        <el-button @click="editTagsDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleConfirmEditTags">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Refresh, View, Key, DocumentCopy, User, Plus, Delete, Edit } from '@element-plus/icons-vue'
import { getUserList, updateUserStatus, resetPassword, createUser, deleteUser, getTagList, addUsersToTag, removeUserFromTag, getUserDetail } from '@/api/user'

const router = useRouter()

// 数据状态
const loading = ref(false)
const tableData = ref([])
const dateRange = ref([])

// 筛选表单
const filterForm = reactive({
  status: '',
  startDate: '',
  endDate: '',
  major: ''
})

// 分页
const pagination = reactive({
  page: 1,
  limit: 10,
  total: 0
})

// 密码重置对话框
const passwordDialogVisible = ref(false)
const tempPassword = ref('')

// 新增用户对话框
const addUserDialogVisible = ref(false)
const userFormRef = ref(null)
const userTagSelectRef = ref(null)
const editTagSelectRef = ref(null)
const userForm = reactive({
  nickname: '',
  phone: '',
  email: '',
  gender: 0,
  birthday: '',
  height: null,
  weight: null,
  tagIds: []
})

// 标签列表
const tagsList = ref([])

// 编辑标签对话框
const editTagsDialogVisible = ref(false)
const editingUser = ref(null)
const editingUserTags = ref([])

// 用户表单验证规则
const userRules = {
  nickname: [
    { required: true, message: '请输入昵称', trigger: 'blur' },
    { min: 1, max: 50, message: '昵称长度应在1-50个字符之间', trigger: 'blur' }
  ],
  phone: [
    { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号', trigger: 'blur' }
  ],
  email: [
    { type: 'email', message: '请输入正确的邮箱地址', trigger: 'blur' }
  ]
}

// 加载数据
const loadData = async () => {
  loading.value = true
  try {
    const params = {
      page: pagination.page,
      limit: pagination.limit
    }
    
    if (filterForm.status !== '') {
      params.status = filterForm.status
    }
    
    if (dateRange.value && dateRange.value.length === 2) {
      params.startDate = dateRange.value[0]
      params.endDate = dateRange.value[1]
    }
    
    if (filterForm.major) {
      params.major = filterForm.major
    }
    
    const data = await getUserList(params)
    tableData.value = data.list || []
    pagination.total = data.total || 0
    
    // 如果有搜索条件但查询结果为空，提示用户不存在
    if (data.list && data.list.length === 0 && filterForm.major) {
      ElMessage.warning('用户不存在')
    }
  } catch (error) {
    console.error('加载数据失败：', error)
    const errorMessage = error.message || error.toString() || ''
    // 列表查询不应该出现"用户不存在"错误，如果出现可能是路由冲突
    if (errorMessage.includes('用户不存在')) {
      // 可能是路由冲突导致的，不显示错误，只记录日志
      console.warn('列表查询时出现用户不存在错误，可能是路由冲突')
    } else {
      ElMessage.error('加载数据失败')
    }
    tableData.value = []
    pagination.total = 0
  } finally {
    loading.value = false
  }
}

// 查询
const handleSearch = () => {
  pagination.page = 1
  loadData()
}

// 重置
const handleReset = () => {
  filterForm.status = ''
  filterForm.major = ''
  dateRange.value = []
  pagination.page = 1
  loadData()
}

// 查看详情
const handleViewDetail = (id, event) => {
  if (event) {
    event.stopPropagation()
    event.preventDefault()
  }
  if (!id) {
    ElMessage.error('用户ID无效')
    return
  }
  console.log('查看详情，用户ID:', id)
  router.push(`/users/detail/${id}`).catch(err => {
    // 处理路由重复导航错误
    if (err.name !== 'NavigationDuplicated') {
      console.error('路由跳转失败：', err)
      // 如果路由跳转失败，尝试使用replace
      router.replace(`/users/detail/${id}`).catch(replaceErr => {
        console.error('路由替换失败：', replaceErr)
        // 如果replace也失败，使用window.location
        window.location.href = `/users/detail/${id}`
      })
    }
  })
}

// 重置密码
const handleResetPassword = async (row) => {
  try {
    await ElMessageBox.confirm(
      `确定要重置用户"${row.nickname || row.id}"的密码吗？`,
      '确认重置密码',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    const data = await resetPassword(row.id)
    tempPassword.value = data.tempPassword
    passwordDialogVisible.value = true
    ElMessage.success('密码重置成功')
  } catch (error) {
    if (error !== 'cancel') {
      console.error('重置密码失败：', error)
      ElMessage.error('重置密码失败')
    }
  }
}

// 复制密码
const handleCopyPassword = async () => {
  try {
    await navigator.clipboard.writeText(tempPassword.value)
    ElMessage.success('密码已复制到剪贴板')
  } catch (error) {
    // 降级方案
    const input = document.createElement('input')
    input.value = tempPassword.value
    document.body.appendChild(input)
    input.select()
    document.execCommand('copy')
    document.body.removeChild(input)
    ElMessage.success('密码已复制到剪贴板')
  }
}

// 切换状态
const handleToggleStatus = async (row) => {
  const action = row.status === 1 ? '冻结' : '启用'
  const newStatus = row.status === 1 ? 0 : 1
  
  try {
    await ElMessageBox.confirm(
      `确定要${action}用户"${row.nickname || row.id}"吗？`,
      `确认${action}`,
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    await updateUserStatus(row.id, newStatus)
    ElMessage.success(`${action}成功`)
    loadData()
  } catch (error) {
    if (error !== 'cancel') {
      console.error(`${action}失败：`, error)
      ElMessage.error(`${action}失败`)
    }
  }
}

// 分页变化
const handleSizeChange = () => {
  loadData()
}

const handlePageChange = () => {
  loadData()
}

// 加载标签列表
const loadTags = async () => {
  try {
    const data = await getTagList()
    // 确保每个标签都有颜色字段，如果没有则使用默认颜色
    if (tagsList) {
      tagsList.value = Array.isArray(data) ? data.map(tag => ({
        ...tag,
        color: tag.color || '#409EFF'
      })) : []
    }
  } catch (error) {
    console.error('加载标签列表失败：', error)
    // 确保即使出错也设置一个空数组
    if (tagsList) {
      tagsList.value = []
    }
  }
}

// 新增用户
const handleAddUser = (event) => {
  if (event) {
    event.stopPropagation()
    event.preventDefault()
  }
  try {
    console.log('打开新增用户对话框')
    // 重置表单
    userForm.nickname = ''
    userForm.phone = ''
    userForm.email = ''
    userForm.gender = 0
    userForm.birthday = ''
    userForm.height = null
    userForm.weight = null
    userForm.tagIds = []
    
    // 打开对话框
    addUserDialogVisible.value = true
    
    // 异步加载标签列表（不阻塞对话框打开）
    loadTags().catch(error => {
      console.error('加载标签列表失败：', error)
    })
    
    // 等待DOM更新后清除表单验证状态
    nextTick(() => {
      if (userFormRef.value) {
        userFormRef.value.clearValidate()
      }
    })
  } catch (error) {
    console.error('打开新增用户对话框失败：', error)
    ElMessage.error('打开新增用户对话框失败')
  }
}

// 标签选择变化处理
const handleTagSelectChange = () => {
  // 选择标签后自动关闭下拉框
  nextTick(() => {
    if (userTagSelectRef.value) {
      userTagSelectRef.value.blur()
    }
  })
}

// 编辑标签选择变化处理
const handleEditTagSelectChange = () => {
  // 选择标签后自动关闭下拉框
  nextTick(() => {
    if (editTagSelectRef.value) {
      editTagSelectRef.value.blur()
    }
  })
}

// 确认新增用户
const handleConfirmAddUser = async () => {
  if (!userFormRef.value) return
  
  await userFormRef.value.validate(async (valid) => {
    if (!valid) return
    
    try {
      const result = await createUser(userForm)
      // 如果成功返回，说明用户已创建
      // 响应拦截器不会显示错误（因为code=200），所以这里只显示成功消息
      ElMessage.success('创建用户成功')
      addUserDialogVisible.value = false
      // 重置表单
      userForm.nickname = ''
      userForm.phone = ''
      userForm.email = ''
      userForm.gender = 0
      userForm.birthday = ''
      userForm.height = null
      userForm.weight = null
      userForm.tagIds = []
      // 刷新列表
      await loadData()
    } catch (error) {
      console.error('创建用户失败：', error)
      const errorMessage = error.message || error.toString() || ''
      
      // 先尝试刷新列表，因为可能已经创建成功了
      let userCreated = false
      const nicknameToCheck = userForm.nickname
      const phoneToCheck = userForm.phone
      try {
        await loadData()
        // 检查用户是否已创建（通过昵称和手机号）
        const latestUsers = tableData.value
        const justCreated = latestUsers.find(u => 
          u.nickname === nicknameToCheck || 
          (phoneToCheck && u.phone === phoneToCheck)
        )
        if (justCreated) {
          userCreated = true
        }
      } catch (refreshError) {
        console.error('刷新用户列表失败：', refreshError)
      }
      
      // 如果用户已创建，显示成功消息（延迟显示，避免与错误消息冲突）
      if (userCreated) {
        // 用户已创建，但响应拦截器可能显示了错误
        // 延迟显示成功消息，确保在错误消息之后
        setTimeout(() => {
          ElMessage.success('创建用户成功')
        }, 500)
        addUserDialogVisible.value = false
        userForm.nickname = ''
        userForm.phone = ''
        userForm.email = ''
        userForm.gender = 0
        userForm.birthday = ''
        userForm.height = null
        userForm.weight = null
        userForm.tagIds = []
      } else {
        // 如果用户没有创建，且响应拦截器没有显示错误，才显示错误消息
        // 响应拦截器会在code不是200时显示错误，所以这里不再重复显示
        if (!errorMessage.includes('创建用户失败') && !errorMessage.includes('请求失败')) {
          ElMessage.error(errorMessage || '创建用户失败')
        }
      }
    }
  })
}

// 编辑标签
const handleEditTags = (row, event) => {
  if (event) {
    event.stopPropagation()
    event.preventDefault()
  }
  try {
    console.log('打开编辑标签对话框，用户:', row)
    if (!row || !row.id) {
      ElMessage.error('用户信息无效')
      return
    }
    
    editingUser.value = row
    
    // 先打开对话框
    editTagsDialogVisible.value = true
    
    // 异步加载标签列表（不阻塞对话框打开）
    loadTags().catch(error => {
      console.error('加载标签列表失败：', error)
    })
    
    // 异步加载用户当前的标签
    getUserDetail(row.id).then(userDetail => {
      // 用户详情返回的tags是对象数组，包含id字段
      if (userDetail.tags && Array.isArray(userDetail.tags)) {
        editingUserTags.value = userDetail.tags.map(tag => tag.id)
      } else {
        editingUserTags.value = []
      }
    }).catch(error => {
      console.error('加载用户标签失败：', error)
      const errorMessage = error.message || error.toString() || ''
      if (errorMessage.includes('用户不存在')) {
        ElMessage.error('用户不存在')
        editTagsDialogVisible.value = false
      } else {
        // 即使加载失败，也允许用户选择标签
        editingUserTags.value = []
      }
    })
  } catch (error) {
    console.error('打开编辑标签对话框失败：', error)
    ElMessage.error('打开编辑标签对话框失败')
  }
}

// 确认编辑标签
const handleConfirmEditTags = async () => {
  if (!editingUser.value) return
  
  try {
    const userId = editingUser.value.id
    const newTagIds = editingUserTags.value
    
    // 获取用户当前的标签ID
    const userDetail = await getUserDetail(userId)
    const currentTags = userDetail.tags || []
    const currentTagIdsFromServer = currentTags.map(tag => tag.id)
    
    // 计算需要添加和删除的标签
    const toAdd = newTagIds.filter(id => !currentTagIdsFromServer.includes(id))
    const toRemove = currentTagIdsFromServer.filter(id => !newTagIds.includes(id))
    
    // 批量添加标签（每个标签单独添加用户）
    for (const tagId of toAdd) {
      await addUsersToTag(tagId, [userId])
    }
    
    // 批量删除标签
    for (const tagId of toRemove) {
      await removeUserFromTag(tagId, userId)
    }
    
    ElMessage.success('标签更新成功')
    editTagsDialogVisible.value = false
    loadData()
  } catch (error) {
    console.error('更新标签失败：', error)
    const errorMessage = error.message || error.toString() || ''
    if (errorMessage.includes('用户不存在')) {
      ElMessage.error('用户不存在')
    } else {
      ElMessage.error('更新标签失败')
    }
  }
}

// 删除用户
const handleDeleteUser = async (row) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除用户"${row.nickname || row.id}"吗？删除后，该用户的所有数据将被永久删除，此操作不可恢复！`,
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    await deleteUser(row.id)
    ElMessage.success('删除用户成功')
    loadData()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除用户失败：', error)
      ElMessage.error('删除用户失败')
    }
  }
}

// 初始化
onMounted(() => {
  loadData()
  loadTags()
})
</script>

<style scoped>
.user-list-container {
  padding: 20px;
  background: #f0f2f5;
  min-height: calc(100vh - 60px);
}

.page-header {
  margin-bottom: 20px;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.header-left {
  flex: 1;
}

.page-header h2 {
  margin: 0 0 8px 0;
  font-size: 24px;
  font-weight: 600;
  color: #303133;
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-right {
  margin-top: 0;
}

.page-desc {
  margin: 0;
  color: #909399;
  font-size: 14px;
}

.filter-card {
  margin-bottom: 20px;
}

.filter-form {
  margin: 0;
}

.table-card {
  margin-bottom: 20px;
}

.user-info {
  display: flex;
  align-items: center;
}

.text-muted {
  color: #909399;
  font-size: 12px;
}

.pagination-wrapper {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}

.password-result {
  padding: 10px 0;
}

.password-display {
  margin: 10px 0;
}

.password-tip {
  margin-top: 10px;
  font-size: 12px;
  color: #909399;
}
</style>
