<template>
  <div class="tags-container">
    <div class="page-header">
      <h2>
        <el-icon><PriceTag /></el-icon>
        用户标签管理
      </h2>
      <p class="page-desc">管理用户标签，支持标签的创建、删除和用户关联</p>
    </div>

    <div class="tags-layout">
      <!-- 左侧：标签列表 -->
      <el-card class="tags-list-card">
        <template #header>
          <div class="card-header">
            <span>标签列表</span>
            <el-button type="primary" :icon="Plus" size="small" @click="handleAddTag">新增标签</el-button>
          </div>
        </template>
        
        <el-scrollbar height="600px">
          <div v-if="tagsList.length === 0" class="empty-state">
            <el-empty description="暂无标签" />
          </div>
          <div v-else class="tags-list">
            <div
              v-for="tag in tagsList"
              :key="tag.id"
              class="tag-item"
              :class="{ active: selectedTagId === tag.id }"
              @click="handleSelectTag(tag.id)"
            >
              <div class="tag-content-wrapper">
                <div class="tag-progress-bar" :style="{ backgroundColor: tag.color || '#409EFF' }">
                  <span class="tag-name" :style="{ 
                    color: getContrastColor(tag.color || '#409EFF'),
                    textShadow: '0 1px 2px rgba(0,0,0,0.3)'
                  }">{{ tag.tag_name }}</span>
                </div>
                <span class="tag-desc">{{ tag.tag_desc || '无描述' }}</span>
              </div>
              <div class="tag-actions">
                <el-button
                  type="danger"
                  link
                  size="small"
                  :icon="Delete"
                  @click.stop="handleDeleteTag(tag)"
                >
                  删除
                </el-button>
              </div>
            </div>
          </div>
        </el-scrollbar>
      </el-card>

      <!-- 右侧：关联用户列表 -->
      <el-card class="users-list-card">
        <template #header>
          <div class="card-header">
            <span>关联用户列表</span>
            <el-button
              v-if="selectedTagId"
              type="primary"
              :icon="Plus"
              size="small"
              @click="handleAddUsers"
            >
              批量添加用户
            </el-button>
          </div>
        </template>

        <div v-if="!selectedTagId" class="empty-state">
          <el-empty description="请先选择一个标签" />
        </div>
        <div v-else>
          <el-table
            v-loading="usersLoading"
            :data="tagUsersList"
            stripe
            style="width: 100%"
          >
            <el-table-column type="index" label="序号" width="80" :index="(index) => index + 1" />
            <el-table-column prop="nickname" label="昵称" width="150">
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
            <el-table-column prop="register_time" label="注册时间" width="180" />
            <el-table-column label="操作" width="120">
              <template #default="{ row }">
                <el-button
                  type="danger"
                  link
                  size="small"
                  :icon="Remove"
                  @click="handleRemoveUser(row)"
                >
                  移除
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-card>
    </div>

    <!-- 新增标签对话框 -->
    <el-dialog
      v-model="tagDialogVisible"
      :title="editingTag ? '编辑标签' : '新增标签'"
      width="500px"
    >
      <el-form :model="tagForm" :rules="tagRules" ref="tagFormRef" label-width="80px">
        <el-form-item label="标签名称" prop="tag_name">
          <el-input v-model="tagForm.tag_name" placeholder="请输入标签名称" />
        </el-form-item>
        <el-form-item label="标签描述" prop="tag_desc">
          <el-input
            v-model="tagForm.tag_desc"
            type="textarea"
            :rows="3"
            placeholder="请输入标签描述"
          />
        </el-form-item>
        <el-form-item label="标签颜色" prop="color">
          <el-color-picker v-model="tagForm.color" color-format="hex" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="tagDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSaveTag">确定</el-button>
      </template>
    </el-dialog>

    <!-- 批量添加用户对话框 -->
    <el-dialog
      v-model="addUsersDialogVisible"
      title="批量添加用户"
      width="800px"
    >
      <div class="add-users-content">
        <el-form :inline="true" class="filter-form">
          <el-form-item label="搜索用户">
            <el-input
              v-model="userSearchKeyword"
              placeholder="请输入昵称或手机号"
              clearable
              style="width: 200px"
              @keyup.enter="handleSearchUsers"
            />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" :icon="Search" @click="handleSearchUsers">查询</el-button>
          </el-form-item>
        </el-form>

        <el-table
          v-loading="allUsersLoading"
          :data="allUsersList"
          @selection-change="handleSelectionChange"
          style="width: 100%"
        >
          <el-table-column type="selection" width="55" />
          <el-table-column prop="id" label="ID" width="80" />
          <el-table-column prop="nickname" label="昵称" width="150">
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
          <el-table-column prop="register_time" label="注册时间" width="180" />
        </el-table>
      </div>
      <template #footer>
        <el-button @click="addUsersDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleConfirmAddUsers" :disabled="selectedUsers.length === 0">
          确定添加（{{ selectedUsers.length }}）
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Delete, Remove, Search, PriceTag, User } from '@element-plus/icons-vue'
import {
  getTagList,
  createTag,
  deleteTag,
  getTagUsers,
  addUsersToTag,
  removeUserFromTag,
  getUserList
} from '@/api/user'

// 数据状态
const tagsList = ref([])
const selectedTagId = ref(null)
const tagUsersList = ref([])
const usersLoading = ref(false)
const allUsersList = ref([])
const allUsersLoading = ref(false)
const selectedUsers = ref([])
const userSearchKeyword = ref('')

// 标签对话框
const tagDialogVisible = ref(false)
const editingTag = ref(null)
const tagFormRef = ref(null)
const tagForm = reactive({
  tag_name: '',
  tag_desc: '',
  color: '#409EFF'
})

// 标签表单验证规则
const tagRules = {
  tag_name: [
    { required: true, message: '请输入标签名称', trigger: 'blur' },
    { min: 1, max: 50, message: '标签名称长度应在1-50个字符之间', trigger: 'blur' }
  ]
}

// 批量添加用户对话框
const addUsersDialogVisible = ref(false)

// 根据背景色计算对比色（白色或黑色）
const getContrastColor = (hexColor) => {
  if (!hexColor || !hexColor.startsWith('#')) {
    return '#fff'
  }
  // 移除#号
  const hex = hexColor.replace('#', '')
  // 转换为RGB
  const r = parseInt(hex.substr(0, 2), 16)
  const g = parseInt(hex.substr(2, 2), 16)
  const b = parseInt(hex.substr(4, 2), 16)
  // 计算亮度（使用相对亮度公式）
  const brightness = (r * 299 + g * 587 + b * 114) / 1000
  // 如果亮度大于128，使用黑色文字，否则使用白色文字
  return brightness > 128 ? '#000' : '#fff'
}

// 加载标签列表
const loadTags = async () => {
  try {
    const data = await getTagList()
    // 确保每个标签都有颜色字段，如果没有则使用默认颜色
    tagsList.value = Array.isArray(data) ? data.map(tag => ({
      ...tag,
      color: tag.color || '#409EFF'
    })) : []
  } catch (error) {
    console.error('加载标签列表失败：', error)
    const errorMessage = error.message || error.toString() || ''
    // 只有在不是"用户不存在"错误时才提示（因为路由冲突可能导致这个错误）
    if (!errorMessage.includes('用户不存在') && !errorMessage.includes('404')) {
      ElMessage.error('加载标签列表失败：' + errorMessage)
    }
    tagsList.value = []
  }
}

// 选择标签
const handleSelectTag = async (tagId) => {
  selectedTagId.value = tagId
  await loadTagUsers(tagId)
}

// 加载标签关联的用户
const loadTagUsers = async (tagId) => {
  usersLoading.value = true
  try {
    const data = await getTagUsers(tagId)
    tagUsersList.value = data
  } catch (error) {
    console.error('加载用户列表失败：', error)
    ElMessage.error('加载用户列表失败')
  } finally {
    usersLoading.value = false
  }
}

// 新增标签
const handleAddTag = () => {
  editingTag.value = null
  tagForm.tag_name = ''
  tagForm.tag_desc = ''
  tagForm.color = '#409EFF'
  tagDialogVisible.value = true
}

// 将颜色值转换为十六进制格式
const convertColorToHex = (color) => {
  if (!color) return '#409EFF'
  // 如果已经是十六进制格式，直接返回
  if (typeof color === 'string' && color.startsWith('#')) {
    return color
  }
  // 如果是RGB格式，转换为十六进制
  if (typeof color === 'string' && color.startsWith('rgb')) {
    const matches = color.match(/\d+/g)
    if (matches && matches.length >= 3) {
      const r = parseInt(matches[0]).toString(16).padStart(2, '0')
      const g = parseInt(matches[1]).toString(16).padStart(2, '0')
      const b = parseInt(matches[2]).toString(16).padStart(2, '0')
      return `#${r}${g}${b}`.toUpperCase()
    }
  }
  // 默认返回
  return color || '#409EFF'
}

// 保存标签
const handleSaveTag = async () => {
  if (!tagFormRef.value) return
  
  await tagFormRef.value.validate(async (valid) => {
    if (!valid) return
    
    try {
      if (editingTag.value) {
        // 编辑标签（如果需要编辑功能，可以添加updateTag接口）
        ElMessage.info('编辑功能待开发')
      } else {
        // 确保颜色值是十六进制格式
        const colorHex = convertColorToHex(tagForm.color)
        const tagData = {
          ...tagForm,
          color: colorHex
        }
        const result = await createTag(tagData)
        // 如果成功返回，说明标签已创建
        // 注意：响应拦截器不会显示错误（因为code=200），所以这里只显示成功消息
        ElMessage.success('添加成功')
        tagDialogVisible.value = false
        // 重置表单
        tagForm.tag_name = ''
        tagForm.tag_desc = ''
        tagForm.color = '#409EFF'
        // 立即刷新标签列表
        await loadTags()
      }
    } catch (error) {
      console.error('保存标签失败：', error)
      const errorMessage = error.message || error.toString() || ''
      
      // 先尝试刷新列表，因为可能已经创建成功了
      let tagCreated = false
      const tagNameToCheck = tagForm.tag_name
      try {
        await loadTags()
        // 如果刷新成功，检查标签是否已创建
        const latestTags = tagsList.value
        const justCreated = latestTags.find(t => t.tag_name === tagNameToCheck)
        if (justCreated) {
          tagCreated = true
        }
      } catch (refreshError) {
        console.error('刷新标签列表失败：', refreshError)
      }
      
      // 如果标签已创建，显示成功消息（延迟显示，避免与错误消息冲突）
      if (tagCreated) {
        // 标签已创建，但响应拦截器可能显示了错误
        // 延迟显示成功消息，确保在错误消息之后
        setTimeout(() => {
          ElMessage.success('添加成功')
        }, 500)
        tagDialogVisible.value = false
        tagForm.tag_name = ''
        tagForm.tag_desc = ''
        tagForm.color = '#409EFF'
      } else {
        // 如果标签没有创建，且响应拦截器没有显示错误，才显示错误消息
        // 响应拦截器会在code不是200时显示错误，所以这里不再重复显示
        if (!errorMessage.includes('用户不存在') && !errorMessage.includes('404')) {
          // 检查错误消息是否包含"创建标签失败"，如果包含说明响应拦截器已经显示了
          if (!errorMessage.includes('创建标签失败') && !errorMessage.includes('请求失败')) {
            ElMessage.error(errorMessage || '保存标签失败')
          }
        }
      }
    }
  })
}

// 删除标签
const handleDeleteTag = async (tag) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除标签"${tag.tag_name}"吗？删除后，该标签与所有用户的关联关系将被移除。`,
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    await deleteTag(tag.id)
    ElMessage.success('删除标签成功')
    
    if (selectedTagId.value === tag.id) {
      selectedTagId.value = null
      tagUsersList.value = []
    }
    
    loadTags()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除标签失败：', error)
      ElMessage.error('删除标签失败')
    }
  }
}

// 批量添加用户
const handleAddUsers = async () => {
  addUsersDialogVisible.value = true
  userSearchKeyword.value = ''
  selectedUsers.value = []
  await loadAllUsers()
}

// 加载所有用户（用于批量添加）
const loadAllUsers = async () => {
  allUsersLoading.value = true
  try {
    const data = await getUserList({ page: 1, limit: 100 })
    allUsersList.value = data.list
  } catch (error) {
    console.error('加载用户列表失败：', error)
    ElMessage.error('加载用户列表失败')
  } finally {
    allUsersLoading.value = false
  }
}

// 搜索用户
const handleSearchUsers = async () => {
  allUsersLoading.value = true
  try {
    const params = { page: 1, limit: 100 }
    if (userSearchKeyword.value) {
      params.major = userSearchKeyword.value
    }
    const data = await getUserList(params)
    allUsersList.value = data.list
  } catch (error) {
    console.error('搜索用户失败：', error)
    ElMessage.error('搜索用户失败')
  } finally {
    allUsersLoading.value = false
  }
}

// 选择变化
const handleSelectionChange = (selection) => {
  selectedUsers.value = selection
}

// 确认添加用户
const handleConfirmAddUsers = async () => {
  if (selectedUsers.value.length === 0) {
    ElMessage.warning('请至少选择一个用户')
    return
  }
  
  try {
    const userIds = selectedUsers.value.map(user => user.id)
    await addUsersToTag(selectedTagId.value, userIds)
    ElMessage.success(`成功添加 ${userIds.length} 个用户`)
    addUsersDialogVisible.value = false
    await loadTagUsers(selectedTagId.value)
  } catch (error) {
    console.error('添加用户失败：', error)
    ElMessage.error('添加用户失败')
  }
}

// 移除用户
const handleRemoveUser = async (user) => {
  try {
    await ElMessageBox.confirm(
      `确定要从标签中移除用户"${user.nickname || user.id}"吗？`,
      '确认移除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    await removeUserFromTag(selectedTagId.value, user.id)
    ElMessage.success('移除用户成功')
    await loadTagUsers(selectedTagId.value)
  } catch (error) {
    if (error !== 'cancel') {
      console.error('移除用户失败：', error)
      ElMessage.error('移除用户失败')
    }
  }
}

// 初始化
onMounted(() => {
  loadTags()
})
</script>

<style scoped>
.tags-container {
  padding: 20px;
  background: #f0f2f5;
  min-height: calc(100vh - 60px);
}

.page-header {
  margin-bottom: 20px;
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

.page-desc {
  margin: 0;
  color: #909399;
  font-size: 14px;
}

.tags-layout {
  display: grid;
  grid-template-columns: 350px 1fr;
  gap: 20px;
}

.tags-list-card,
.users-list-card {
  height: calc(100vh - 200px);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.tags-list {
  padding: 10px 0;
}

.tag-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  margin-bottom: 8px;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.3s;
}

.tag-item:hover {
  background-color: #f5f7fa;
  border-color: #409EFF;
}

.tag-item.active {
  background-color: #ecf5ff;
  border-color: #409EFF;
}

.tag-content-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.tag-progress-bar {
  width: 100%;
  height: 36px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  padding: 0 12px;
  min-width: 0;
}

.tag-name {
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tag-desc {
  font-size: 12px;
  color: #909399;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tag-actions {
  margin-left: 12px;
}

.empty-state {
  padding: 60px 0;
}

.add-users-content {
  padding: 10px 0;
}

.filter-form {
  margin-bottom: 20px;
}

.user-info {
  display: flex;
  align-items: center;
}
</style>

