<template>
  <div class="system-config-container">
    <div class="page-header">
      <h2>
        <el-icon><Setting /></el-icon>
        系统配置
      </h2>
      <p class="page-desc">配置系统参数，管理基础设置</p>
    </div>

    <!-- 筛选表单 -->
    <el-card class="filter-card">
      <el-form :model="filterForm" :inline="true" class="filter-form">
        <el-form-item label="配置分组">
          <el-select v-model="filterForm.groupName" placeholder="全部" clearable style="width: 200px">
            <el-option label="基础配置" value="basic" />
            <el-option label="系统设置" value="system" />
            <el-option label="默认分组" value="default" />
          </el-select>
        </el-form-item>
        
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="handleSearch">查询</el-button>
          <el-button :icon="Refresh" @click="handleReset">重置</el-button>
          <el-button type="success" :icon="Plus" @click="handleAddConfig">新增配置</el-button>
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
        <el-table-column prop="config_key" label="配置键" width="200" />
        <el-table-column prop="config_value" label="配置值" min-width="200">
          <template #default="{ row }">
            <span v-if="row.config_type === 'json'">{{ JSON.stringify(row.config_value) }}</span>
            <span v-else>{{ row.config_value }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="config_type" label="类型" width="100">
          <template #default="{ row }">
            <el-tag :type="getTypeTagType(row.config_type)">
              {{ getTypeLabel(row.config_type) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="group_name" label="分组" width="120" />
        <el-table-column prop="config_desc" label="描述" min-width="200" show-overflow-tooltip />
        <el-table-column prop="is_public" label="是否公开" width="100">
          <template #default="{ row }">
            <el-tag :type="row.is_public === 1 ? 'success' : 'info'">
              {{ row.is_public === 1 ? '是' : '否' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="updated_at" label="更新时间" width="180" />
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" :icon="Edit" @click="handleEditConfig(row)">编辑</el-button>
            <el-button type="danger" link size="small" :icon="Delete" @click="handleDeleteConfig(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pagination-container">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.limit"
          :total="pagination.total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handlePageChange"
        />
      </div>
    </el-card>

    <!-- 新增/编辑配置对话框 -->
    <el-dialog
      v-model="configDialogVisible"
      :title="isEdit ? '编辑配置' : '新增配置'"
      width="600px"
    >
      <el-form
        :model="configForm"
        :rules="configRules"
        ref="configFormRef"
        label-width="120px"
      >
        <el-form-item label="配置键" prop="config_key">
          <el-input 
            v-model="configForm.config_key" 
            placeholder="请输入配置键（唯一标识）"
            :disabled="isEdit"
          />
        </el-form-item>
        <el-form-item label="配置值" prop="config_value">
          <el-input 
            v-if="configForm.config_type !== 'json' && configForm.config_type !== 'boolean'"
            v-model="configForm.config_value" 
            :type="configForm.config_type === 'number' ? 'number' : 'text'"
            placeholder="请输入配置值"
          />
          <el-switch
            v-else-if="configForm.config_type === 'boolean'"
            v-model="configForm.config_value"
          />
          <el-input
            v-else
            v-model="configForm.config_value"
            type="textarea"
            :rows="4"
            placeholder='请输入JSON格式，例如: {"key": "value"}'
          />
        </el-form-item>
        <el-form-item label="配置类型" prop="config_type">
          <el-select v-model="configForm.config_type" style="width: 100%">
            <el-option label="字符串" value="string" />
            <el-option label="数字" value="number" />
            <el-option label="布尔值" value="boolean" />
            <el-option label="JSON" value="json" />
          </el-select>
        </el-form-item>
        <el-form-item label="配置分组" prop="group_name">
          <el-input v-model="configForm.group_name" placeholder="请输入配置分组" />
        </el-form-item>
        <el-form-item label="配置描述">
          <el-input 
            v-model="configForm.config_desc" 
            type="textarea"
            :rows="2"
            placeholder="请输入配置描述"
          />
        </el-form-item>
        <el-form-item label="是否公开">
          <el-switch v-model="configForm.is_public" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="configDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleConfirmConfig">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Refresh, Plus, Edit, Delete, Setting } from '@element-plus/icons-vue'
import { getConfigList, saveConfig, deleteConfig } from '@/api/system'

// 数据状态
const loading = ref(false)
const tableData = ref([])

// 筛选表单
const filterForm = reactive({
  groupName: ''
})

// 分页
const pagination = reactive({
  page: 1,
  limit: 20,
  total: 0
})

// 配置对话框
const configDialogVisible = ref(false)
const isEdit = ref(false)
const configFormRef = ref(null)
const configForm = reactive({
  config_key: '',
  config_value: '',
  config_type: 'string',
  group_name: 'default',
  config_desc: '',
  is_public: false
})

// 表单验证规则
const configRules = {
  config_key: [
    { required: true, message: '配置键不能为空', trigger: 'blur' }
  ],
  config_value: [
    { required: true, message: '配置值不能为空', trigger: 'blur' }
  ],
  config_type: [
    { required: true, message: '配置类型不能为空', trigger: 'change' }
  ]
}

// 获取配置列表
const fetchConfigList = async () => {
  loading.value = true
  try {
    const params = {
      page: pagination.page,
      limit: pagination.limit,
      ...(filterForm.groupName && { groupName: filterForm.groupName })
    }
    const data = await getConfigList(params)
    tableData.value = data.list || []
    pagination.total = data.total || 0
  } catch (error) {
    console.error('获取配置列表错误：', error)
    // 错误消息已在响应拦截器中显示
  } finally {
    loading.value = false
  }
}

// 查询
const handleSearch = () => {
  pagination.page = 1
  fetchConfigList()
}

// 重置
const handleReset = () => {
  filterForm.groupName = ''
  pagination.page = 1
  fetchConfigList()
}

// 新增配置
const handleAddConfig = () => {
  isEdit.value = false
  Object.assign(configForm, {
    config_key: '',
    config_value: '',
    config_type: 'string',
    group_name: 'default',
    config_desc: '',
    is_public: false
  })
  configDialogVisible.value = true
}

// 编辑配置
const handleEditConfig = (row) => {
  isEdit.value = true
  Object.assign(configForm, {
    config_key: row.config_key,
    config_value: row.config_value,
    config_type: row.config_type,
    group_name: row.group_name,
    config_desc: row.config_desc || '',
    is_public: row.is_public === 1
  })
  configDialogVisible.value = true
}

// 确认保存配置
const handleConfirmConfig = async () => {
  if (!configFormRef.value) return
  
  await configFormRef.value.validate(async (valid) => {
    if (valid) {
      try {
        // 如果是JSON类型，验证JSON格式
        if (configForm.config_type === 'json') {
          try {
            JSON.parse(configForm.config_value)
          } catch (e) {
            ElMessage.error('JSON格式不正确')
            return
          }
        }
        
        const data = {
          ...configForm,
          is_public: configForm.is_public ? 1 : 0
        }
        
        await saveConfig(data)
        ElMessage.success('保存成功')
        configDialogVisible.value = false
        fetchConfigList()
      } catch (error) {
        console.error('保存配置错误：', error)
        ElMessage.error('保存配置失败')
      }
    }
  })
}

// 删除配置
const handleDeleteConfig = (row) => {
  ElMessageBox.confirm(
    `确定要删除配置 "${row.config_key}" 吗？`,
    '提示',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(async () => {
    try {
      await deleteConfig(row.config_key)
      ElMessage.success('删除成功')
      fetchConfigList()
    } catch (error) {
      console.error('删除配置错误：', error)
      ElMessage.error('删除配置失败')
    }
  }).catch(() => {})
}

// 获取类型标签类型
const getTypeTagType = (type) => {
  const typeMap = {
    string: '',
    number: 'success',
    boolean: 'warning',
    json: 'info'
  }
  return typeMap[type] || ''
}

// 获取类型标签文本
const getTypeLabel = (type) => {
  const typeMap = {
    string: '字符串',
    number: '数字',
    boolean: '布尔值',
    json: 'JSON'
  }
  return typeMap[type] || type
}

// 分页大小改变
const handleSizeChange = (val) => {
  pagination.limit = val
  pagination.page = 1
  fetchConfigList()
}

// 页码改变
const handlePageChange = (val) => {
  pagination.page = val
  fetchConfigList()
}

// 初始化
onMounted(() => {
  fetchConfigList()
})
</script>

<style scoped>
.system-config-container {
  padding: 20px;
  background: #fff;
  min-height: calc(100vh - 60px);
}

.page-header {
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.page-header h2 {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  color: #303133;
  display: flex;
  align-items: center;
  gap: 8px;
}

.page-desc {
  margin: 8px 0 0 0;
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

.pagination-container {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}
</style>
