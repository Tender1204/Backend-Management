<template>
  <div class="template-container">
    <div class="page-header">
      <div class="header-left">
        <h2>
          <el-icon><Document /></el-icon>
          规则模板管理
        </h2>
        <p class="page-desc">管理健康规则模板，按标签分配给用户</p>
      </div>
      <div class="header-right">
        <el-button type="primary" :icon="Plus" @click="handleAdd">新增模板</el-button>
      </div>
    </div>

    <!-- 筛选表单 -->
    <el-card class="filter-card">
      <el-form :model="filterForm" :inline="true">
        <el-form-item label="规则类型">
          <el-select v-model="filterForm.ruleTypeId" placeholder="全部" clearable style="width: 150px">
            <el-option
              v-for="type in ruleTypes"
              :key="type.id"
              :label="type.typeName || type.type_name"
              :value="type.id"
            />
          </el-select>
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
        <el-table-column type="index" label="序号" width="80" />
        <el-table-column prop="templateName" label="模板名称" width="180" />
        <el-table-column prop="ruleTypeName" label="规则类型" width="120" />
        <el-table-column prop="description" label="描述" show-overflow-tooltip />
        <el-table-column prop="tagNames" label="关联标签" width="200">
          <template #default="{ row }">
            <el-tag
              v-for="tag in (row.tagNames || '').split(', ').filter(t => t)"
              :key="tag"
              size="small"
              style="margin-right: 4px"
            >
              {{ tag }}
            </el-tag>
            <span v-if="!row.tagNames || row.tagNames === ''" style="color: #909399">未分配</span>
          </template>
        </el-table-column>
        <el-table-column prop="userCount" label="用户人数" width="120" align="center">
          <template #default="{ row }">
            <el-tag type="info" size="small">
              {{ row.userCount || 0 }} 人
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'danger'">
              {{ row.status === 1 ? '启用' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="280" fixed="right">
          <template #default="{ row }">
            <el-button
              type="primary"
              link
              size="small"
              :icon="User"
              @click="handleAssign(row)"
            >
              分配用户
            </el-button>
            <el-button
              type="primary"
              link
              size="small"
              :icon="Edit"
              @click="handleEdit(row)"
            >
              编辑
            </el-button>
            <el-button
              type="danger"
              link
              size="small"
              :icon="Delete"
              @click="handleDelete(row)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 新增/编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="700px"
      @close="handleDialogClose"
    >
      <el-form
        :model="formData"
        :rules="formRules"
        ref="formRef"
        label-width="120px"
      >
        <el-form-item label="模板名称" prop="templateName">
          <el-input v-model="formData.templateName" placeholder="请输入模板名称" />
        </el-form-item>
        <el-form-item label="规则类型" prop="ruleTypeId">
          <el-select 
            v-model="formData.ruleTypeId" 
            placeholder="请选择规则类型" 
            style="width: 100%"
            @change="handleRuleTypeChange"
          >
            <el-option
              v-for="type in ruleTypes"
              :key="type.id"
              :label="type.typeName || type.type_name"
              :value="type.id"
            />
          </el-select>
        </el-form-item>
        
        <!-- 规则配置 - 根据规则类型显示不同表单 -->
        <el-form-item label="规则配置" prop="ruleConfig">
          <div v-if="!formData.ruleTypeId" class="config-placeholder">
            请先选择规则类型
          </div>
          
          <!-- 饮水规则配置 -->
          <div v-else-if="currentRuleTypeCode === 'water'" class="rule-config-form">
            <el-form-item label="每日推荐量" prop="ruleConfig.dailyTarget">
              <el-input-number
                v-model="ruleConfigForm.dailyTarget"
                :min="500"
                :max="10000"
                :step="100"
                style="width: 200px"
              />
              <span style="margin-left: 8px; color: #909399">ml</span>
            </el-form-item>
            <el-form-item label="提醒间隔" prop="ruleConfig.reminderInterval">
              <el-input-number
                v-model="ruleConfigForm.reminderInterval"
                :min="30"
                :max="480"
                :step="30"
                style="width: 200px"
              />
              <span style="margin-left: 8px; color: #909399">分钟</span>
            </el-form-item>
          </div>
          
          <!-- 饮食规则配置 -->
          <div v-else-if="currentRuleTypeCode === 'diet'" class="rule-config-form">
            <el-form-item label="热量目标" prop="ruleConfig.calorieTarget">
              <el-input-number
                v-model="ruleConfigForm.calorieTarget"
                :min="800"
                :max="5000"
                :step="100"
                style="width: 200px"
              />
              <span style="margin-left: 8px; color: #909399">kcal</span>
            </el-form-item>
          </div>
          
          <!-- 运动规则配置 -->
          <div v-else-if="currentRuleTypeCode === 'exercise'" class="rule-config-form">
            <el-form-item label="步数目标" prop="ruleConfig.stepTarget">
              <el-input-number
                v-model="ruleConfigForm.stepTarget"
                :min="1000"
                :max="50000"
                :step="500"
                style="width: 200px"
              />
              <span style="margin-left: 8px; color: #909399">步</span>
            </el-form-item>
            <el-form-item label="久坐时长" prop="ruleConfig.sedentaryDuration">
              <el-input-number
                v-model="ruleConfigForm.sedentaryDuration"
                :min="30"
                :max="180"
                :step="15"
                style="width: 200px"
              />
              <span style="margin-left: 8px; color: #909399">分钟</span>
            </el-form-item>
          </div>
          
          <!-- 睡眠规则配置 -->
          <div v-else-if="currentRuleTypeCode === 'sleep'" class="rule-config-form">
            <el-form-item label="推荐时长" prop="ruleConfig.recommendedDuration">
              <el-input-number
                v-model="ruleConfigForm.recommendedDuration"
                :min="360"
                :max="600"
                :step="30"
                style="width: 200px"
              />
              <span style="margin-left: 8px; color: #909399">分钟（{{ Math.floor((ruleConfigForm.recommendedDuration || 480) / 60) }}小时）</span>
            </el-form-item>
          </div>
        </el-form-item>
        
        <el-form-item label="描述">
          <el-input
            v-model="formData.description"
            type="textarea"
            :rows="3"
            placeholder="请输入模板描述"
          />
        </el-form-item>
        <el-form-item label="关联标签">
          <el-select
            ref="tagSelectRef"
            v-model="formData.tagIds"
            multiple
            placeholder="请选择标签（可选）"
            style="width: 100%"
            @change="handleTagSelectChange"
          >
            <el-option
              v-for="tag in tagList"
              :key="tag.id"
              :label="tag.tag_name || tag.tagName"
              :value="tag.id"
            >
              <el-tag :color="tag.color" style="color: #fff; border: none">
                {{ tag.tag_name || tag.tagName }}
              </el-tag>
            </el-option>
            <template #tag="{ item, close }">
              <el-tag
                v-if="item && item.value"
                :color="getTagColor(item.value)"
                closable
                @close="close"
                style="color: #fff; border: none; margin-right: 4px"
              >
                {{ item.label || item.value }}
              </el-tag>
            </template>
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="submitting">
          确定
        </el-button>
      </template>
    </el-dialog>

    <!-- 分配用户对话框 -->
    <el-dialog
      v-model="assignDialogVisible"
      title="分配模板给用户"
      width="600px"
      @close="handleAssignDialogClose"
    >
      <el-form label-width="100px">
        <el-form-item label="模板名称">
          <el-input :value="currentTemplateName" disabled />
        </el-form-item>
        <el-form-item label="选择标签" required>
          <el-select
            ref="assignTagSelectRef"
            v-model="assignForm.tagIds"
            multiple
            placeholder="请选择标签"
            style="width: 100%"
            @change="handleAssignTagSelectChange"
          >
            <el-option
              v-for="tag in tagList"
              :key="tag.id"
              :label="tag.tag_name || tag.tagName"
              :value="tag.id"
            >
              <el-tag :color="tag.color" style="color: #fff; border: none">
                {{ tag.tag_name || tag.tagName }}
              </el-tag>
            </el-option>
            <template #tag="{ item, close }">
              <el-tag
                v-if="item && item.value"
                :color="getTagColor(item.value)"
                closable
                @close="close"
                style="color: #fff; border: none; margin-right: 4px"
              >
                {{ item.label || item.value }}
              </el-tag>
            </template>
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-alert
            type="info"
            :closable="false"
            show-icon
          >
            <template #default>
              模板将分配给选中标签下的所有用户。选择标签后，系统会自动统计并显示分配的用户数量。
            </template>
          </el-alert>
        </el-form-item>
        <el-form-item v-if="assignForm.userCount > 0" label="分配用户数">
          <el-tag type="success" size="large">
            将分配给 {{ assignForm.userCount }} 个用户
          </el-tag>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="assignDialogVisible = false">取消</el-button>
        <el-button 
          type="primary" 
          @click="handleAssignSubmit" 
          :loading="assigning"
          :disabled="!assignForm.tagIds || assignForm.tagIds.length === 0"
        >
          确认分配
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Document, Plus, Search, Refresh, Edit, Delete, User } from '@element-plus/icons-vue'
import {
  getRuleTypes,
  getTemplateList,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  assignTemplateToUsers
} from '@/api/rule'
import { getTagList, getTagUsers } from '@/api/user'

const loading = ref(false)
const submitting = ref(false)
const assigning = ref(false)
const dialogVisible = ref(false)
const assignDialogVisible = ref(false)
const formRef = ref(null)
const tagSelectRef = ref(null)
const assignTagSelectRef = ref(null)

const filterForm = reactive({
  ruleTypeId: null
})

const tableData = ref([])
const ruleTypes = ref([])
const tagList = ref([])

const formData = reactive({
  id: null,
  templateName: '',
  ruleTypeId: null,
  ruleConfig: {},
  description: '',
  tagIds: []
})

// 规则配置表单（根据类型动态显示）
const ruleConfigForm = reactive({
  dailyTarget: 2000,
  reminderInterval: 120,
  calorieTarget: 2000,
  stepTarget: 10000,
  sedentaryDuration: 60,
  recommendedDuration: 480
})

const assignForm = reactive({
  templateId: null,
  tagIds: [],
  userCount: 0
})

const currentTemplateName = ref('')

// 当前规则类型代码
const currentRuleTypeCode = computed(() => {
  if (!formData.ruleTypeId) return null
  const type = ruleTypes.value.find(t => t.id === formData.ruleTypeId)
  return type?.typeCode || type?.type_code || null
})

const dialogTitle = computed(() => {
  return formData.id ? '编辑模板' : '新增模板'
})

const formRules = {
  templateName: [
    { required: true, message: '请输入模板名称', trigger: 'blur' }
  ],
  ruleTypeId: [
    { required: true, message: '请选择规则类型', trigger: 'change' }
  ]
}

// 注意：用户数统计已移到 handleAssignTagSelectChange 中处理

// 格式化日期
const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// 加载模板列表
const loadTemplates = async () => {
  try {
    loading.value = true
    const params = {}
    if (filterForm.ruleTypeId) {
      params.ruleTypeId = filterForm.ruleTypeId
    }
    const data = await getTemplateList(params)
    tableData.value = data || []
  } catch (err) {
    console.error('加载模板列表失败：', err)
  } finally {
    loading.value = false
  }
}

// 加载规则类型列表
const loadRuleTypes = async () => {
  try {
    const data = await getRuleTypes()
    ruleTypes.value = data || []
  } catch (err) {
    console.error('加载规则类型失败：', err)
  }
}

// 加载标签列表
const loadTags = async () => {
  try {
    const data = await getTagList()
    tagList.value = data || []
  } catch (err) {
    console.error('加载标签列表失败：', err)
  }
}

// 规则类型变化时重置配置
const handleRuleTypeChange = () => {
  // 根据规则类型重置配置表单
  const typeCode = currentRuleTypeCode.value
  if (typeCode === 'water') {
    ruleConfigForm.dailyTarget = 2000
    ruleConfigForm.reminderInterval = 120
  } else if (typeCode === 'diet') {
    ruleConfigForm.calorieTarget = 2000
  } else if (typeCode === 'exercise') {
    ruleConfigForm.stepTarget = 10000
    ruleConfigForm.sedentaryDuration = 60
  } else if (typeCode === 'sleep') {
    ruleConfigForm.recommendedDuration = 480
  }
}

// 查询
const handleSearch = () => {
  loadTemplates()
}

// 重置
const handleReset = () => {
  filterForm.ruleTypeId = null
  loadTemplates()
}

// 新增
const handleAdd = () => {
  try {
    Object.assign(formData, {
      id: null,
      templateName: '',
      ruleTypeId: null,
      ruleConfig: {},
      description: '',
      tagIds: []
    })
    // 重置配置表单
    Object.assign(ruleConfigForm, {
      dailyTarget: 2000,
      reminderInterval: 120,
      calorieTarget: 2000,
      stepTarget: 10000,
      sedentaryDuration: 60,
      recommendedDuration: 480
    })
    dialogVisible.value = true
  } catch (err) {
    console.error('新增模板错误：', err)
    ElMessage.error('打开新增对话框失败，请重试')
  }
}

// 编辑
const handleEdit = (row) => {
  try {
    Object.assign(formData, {
      id: row.id,
      templateName: row.templateName || '',
      ruleTypeId: row.ruleTypeId,
      ruleConfig: row.ruleConfig || {},
      description: row.description || '',
      tagIds: row.tagIds || []
    })
    
    // 根据规则配置填充表单
    const config = row.ruleConfig || {}
    const ruleTypeCode = row.ruleTypeCode || ''
    
    if (ruleTypeCode === 'water') {
      ruleConfigForm.dailyTarget = config.dailyTarget || 2000
      ruleConfigForm.reminderInterval = config.reminderInterval || 120
    } else if (ruleTypeCode === 'diet') {
      ruleConfigForm.calorieTarget = config.calorieTarget || 2000
    } else if (ruleTypeCode === 'exercise') {
      ruleConfigForm.stepTarget = config.stepTarget || 10000
      ruleConfigForm.sedentaryDuration = config.sedentaryDuration || 60
    } else if (ruleTypeCode === 'sleep') {
      ruleConfigForm.recommendedDuration = config.recommendedDuration || 480
    }
    
    dialogVisible.value = true
  } catch (err) {
    console.error('编辑模板错误：', err)
    ElMessage.error('编辑模板失败，请重试')
  }
}

// 删除
const handleDelete = async (row) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除模板"${row.templateName}"吗？`,
      '提示',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    await deleteTemplate(row.id)
    ElMessage.success('删除成功')
    loadTemplates()
  } catch (err) {
    if (err !== 'cancel') {
      console.error('删除失败：', err)
    }
  }
}

// 分配用户
const handleAssign = async (row) => {
  try {
    assignForm.templateId = row.id
    assignForm.tagIds = row.tagIds || []
    currentTemplateName.value = row.templateName || ''
    assignForm.userCount = 0
    
    // 如果有已关联的标签，统计用户数
    if (assignForm.tagIds.length > 0) {
      await updateAssignUserCount()
    }
    
    assignDialogVisible.value = true
  } catch (err) {
    console.error('分配用户错误：', err)
    ElMessage.error('打开分配对话框失败，请重试')
  }
}

// 更新分配用户数
const updateAssignUserCount = async () => {
  if (!assignForm.tagIds || assignForm.tagIds.length === 0) {
    assignForm.userCount = 0
    return
  }
  
  try {
    // 统计所有选中标签下的用户数（去重）
    const userIds = new Set()
    for (const tagId of assignForm.tagIds) {
      try {
        const users = await getTagUsers(tagId)
        if (users && Array.isArray(users)) {
          users.forEach(user => userIds.add(user.id || user.user_id))
        }
      } catch (err) {
        console.error(`获取标签 ${tagId} 的用户失败：`, err)
      }
    }
    assignForm.userCount = userIds.size
  } catch (err) {
    console.error('统计用户数失败：', err)
    assignForm.userCount = 0
  }
}

// 提交表单
const handleSubmit = async () => {
  try {
    await formRef.value.validate()
    
    // 根据规则类型构建配置对象
    let ruleConfig = {}
    const typeCode = currentRuleTypeCode.value
    
    if (typeCode === 'water') {
      ruleConfig = {
        dailyTarget: ruleConfigForm.dailyTarget,
        reminderInterval: ruleConfigForm.reminderInterval
      }
    } else if (typeCode === 'diet') {
      ruleConfig = {
        calorieTarget: ruleConfigForm.calorieTarget
      }
    } else if (typeCode === 'exercise') {
      ruleConfig = {
        stepTarget: ruleConfigForm.stepTarget,
        sedentaryDuration: ruleConfigForm.sedentaryDuration
      }
    } else if (typeCode === 'sleep') {
      ruleConfig = {
        recommendedDuration: ruleConfigForm.recommendedDuration
      }
    }
    
    submitting.value = true
    const submitData = {
      templateName: formData.templateName,
      ruleTypeId: formData.ruleTypeId,
      ruleConfig: ruleConfig,
      description: formData.description,
      tagIds: formData.tagIds || []
    }
    
    if (formData.id) {
      await updateTemplate(formData.id, submitData)
      ElMessage.success('更新成功')
    } else {
      await createTemplate(submitData)
      ElMessage.success('创建成功')
    }
    
    dialogVisible.value = false
    loadTemplates()
  } catch (err) {
    if (err.message && !err.message.includes('validate')) {
      ElMessage.error(err.message)
    }
  } finally {
    submitting.value = false
  }
}

// 分配提交
const handleAssignSubmit = async () => {
  if (!assignForm.tagIds || assignForm.tagIds.length === 0) {
    ElMessage.warning('请至少选择一个标签')
    return
  }
  
  try {
    assigning.value = true
    const result = await assignTemplateToUsers(assignForm.templateId, {
      tagIds: assignForm.tagIds
    })
    
    ElMessage.success({
      message: `模板已成功分配给 ${result.userCount} 个用户`,
      duration: 3000
    })
    
    assignDialogVisible.value = false
    loadTemplates() // 刷新列表以更新标签显示
  } catch (err) {
    if (err.message) {
      ElMessage.error(err.message)
    }
  } finally {
    assigning.value = false
  }
}

// 对话框关闭
const handleDialogClose = () => {
  formRef.value?.resetFields()
  Object.assign(ruleConfigForm, {
    dailyTarget: 2000,
    reminderInterval: 120,
    calorieTarget: 2000,
    stepTarget: 10000,
    sedentaryDuration: 60,
    recommendedDuration: 480
  })
}

// 标签选择变化（新增/编辑表单）
const handleTagSelectChange = () => {
  // 选择标签后自动收起下拉框
  if (tagSelectRef.value) {
    tagSelectRef.value.blur()
  }
}

// 标签选择变化（分配表单）
const handleAssignTagSelectChange = () => {
  // 选择标签后自动收起下拉框
  if (assignTagSelectRef.value) {
    assignTagSelectRef.value.blur()
  }
  // 更新用户数统计
  updateAssignUserCount()
}

// 获取标签颜色
const getTagColor = (tagId) => {
  if (!tagId) return '#409EFF'
  const tag = tagList.value.find(t => t.id === tagId)
  return tag?.color || '#409EFF'
}

// 分配对话框关闭
const handleAssignDialogClose = () => {
  assignForm.templateId = null
  assignForm.tagIds = []
  assignForm.userCount = 0
  currentTemplateName.value = ''
}

onMounted(() => {
  loadRuleTypes()
  loadTemplates()
  loadTags()
})
</script>

<style scoped>
.template-container {
  padding: 20px;
  background: #fff;
  min-height: calc(100vh - 60px);
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
}

.header-left h2 {
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

.filter-card {
  margin-bottom: 20px;
}

.table-card {
  margin-bottom: 20px;
}

.config-placeholder {
  padding: 20px;
  text-align: center;
  color: #909399;
  background: #f5f7fa;
  border-radius: 4px;
}

.rule-config-form {
  padding: 16px;
  background: #f5f7fa;
  border-radius: 4px;
}

:deep(.rule-config-form .el-form-item) {
  margin-bottom: 16px;
}

:deep(.rule-config-form .el-form-item:last-child) {
  margin-bottom: 0;
}
</style>
