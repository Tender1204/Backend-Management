<template>
  <div class="system-backup-container">
    <div class="page-header">
      <div class="header-left">
        <h2>
          <el-icon><FolderOpened /></el-icon>
          数据备份
        </h2>
        <p class="page-desc">备份系统数据，保障数据安全</p>
      </div>
      <div class="header-right">
        <el-button type="primary" :icon="Plus" @click="handleCreateBackup">创建备份</el-button>
      </div>
    </div>

    <!-- 筛选表单 -->
    <el-card class="filter-card">
      <el-form :model="filterForm" :inline="true" class="filter-form">
        <el-form-item label="备份类型">
          <el-select v-model="filterForm.backupType" placeholder="全部" clearable style="width: 150px">
            <el-option label="全量备份" value="full" />
            <el-option label="增量备份" value="incremental" />
          </el-select>
        </el-form-item>
        
        <el-form-item label="备份状态">
          <el-select v-model="filterForm.backupStatus" placeholder="全部" clearable style="width: 150px">
            <el-option label="进行中" :value="0" />
            <el-option label="成功" :value="1" />
            <el-option label="失败" :value="2" />
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
        <el-table-column type="index" label="序号" width="80" :index="(index) => (pagination.page - 1) * pagination.limit + index + 1" />
        <el-table-column prop="backup_name" label="备份名称" min-width="200" />
        <el-table-column prop="backup_type" label="备份类型" width="120">
          <template #default="{ row }">
            <el-tag :type="row.backup_type === 'full' ? 'success' : 'warning'">
              {{ row.backup_type === 'full' ? '全量备份' : '增量备份' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="file_size" label="文件大小" width="120">
          <template #default="{ row }">
            {{ row.fileSizeFormatted || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="backup_status" label="备份状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusTagType(row.backup_status)">
              {{ getStatusLabel(row.backup_status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="operator_nickname" label="操作人" width="120" />
        <el-table-column prop="backup_time" label="备份时间" width="180" />
        <el-table-column prop="restore_time" label="恢复时间" width="180">
          <template #default="{ row }">
            {{ row.restore_time || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" min-width="200" show-overflow-tooltip />
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button 
              v-if="row.backup_status === 1"
              type="success" 
              link 
              size="small" 
              :icon="Download"
              @click="handleDownloadBackup(row)"
            >
              下载
            </el-button>
            <el-button 
              type="danger" 
              link 
              size="small" 
              :icon="Delete"
              @click="handleDeleteBackup(row)"
            >
              删除
            </el-button>
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

    <!-- 创建备份对话框 -->
    <el-dialog
      v-model="backupDialogVisible"
      title="创建数据备份"
      width="600px"
    >
      <el-form
        :model="backupForm"
        :rules="backupRules"
        ref="backupFormRef"
        label-width="120px"
      >
        <el-form-item label="备份名称" prop="backup_name">
          <el-input v-model="backupForm.backup_name" placeholder="请输入备份名称" />
        </el-form-item>
        <el-form-item label="备份类型" prop="backup_type">
          <el-select v-model="backupForm.backup_type" style="width: 100%">
            <el-option label="全量备份" value="full" />
            <el-option label="增量备份" value="incremental" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input 
            v-model="backupForm.remark" 
            type="textarea"
            :rows="3"
            placeholder="请输入备注信息（可选）"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="backupDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleConfirmBackup" :loading="backupLoading">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Refresh, Plus, Delete, Download, FolderOpened } from '@element-plus/icons-vue'
import { getBackupList, createBackup, deleteBackup } from '@/api/system'

// 数据状态
const loading = ref(false)
const tableData = ref([])

// 筛选表单
const filterForm = reactive({
  backupType: '',
  backupStatus: ''
})

// 分页
const pagination = reactive({
  page: 1,
  limit: 20,
  total: 0
})

// 备份对话框
const backupDialogVisible = ref(false)
const backupLoading = ref(false)
const backupFormRef = ref(null)
const backupForm = reactive({
  backup_name: '',
  backup_type: 'full',
  remark: ''
})

// 表单验证规则
const backupRules = {
  backup_name: [
    { required: true, message: '备份名称不能为空', trigger: 'blur' }
  ],
  backup_type: [
    { required: true, message: '备份类型不能为空', trigger: 'change' }
  ]
}

// 获取备份列表
const fetchBackupList = async () => {
  loading.value = true
  try {
    const params = {
      page: pagination.page,
      limit: pagination.limit,
      ...(filterForm.backupType && { backupType: filterForm.backupType }),
      ...(filterForm.backupStatus !== '' && filterForm.backupStatus !== undefined && { backupStatus: filterForm.backupStatus })
    }
    const data = await getBackupList(params)
    tableData.value = data.list || []
    pagination.total = data.total || 0
  } catch (error) {
    console.error('获取备份列表错误：', error)
    // 错误消息已在响应拦截器中显示
  } finally {
    loading.value = false
  }
}

// 查询
const handleSearch = () => {
  pagination.page = 1
  fetchBackupList()
}

// 重置
const handleReset = () => {
  filterForm.backupType = ''
  filterForm.backupStatus = ''
  pagination.page = 1
  fetchBackupList()
}

// 创建备份
const handleCreateBackup = () => {
  Object.assign(backupForm, {
    backup_name: '',
    backup_type: 'full',
    remark: ''
  })
  backupDialogVisible.value = true
}

// 确认创建备份
const handleConfirmBackup = async () => {
  if (!backupFormRef.value) return
  
  await backupFormRef.value.validate(async (valid) => {
    if (valid) {
      backupLoading.value = true
      try {
        await createBackup(backupForm)
        ElMessage.success('备份创建成功')
        backupDialogVisible.value = false
        fetchBackupList()
      } catch (error) {
        console.error('创建备份错误：', error)
        // 错误消息已在响应拦截器中显示
      } finally {
        backupLoading.value = false
      }
    }
  })
}

// 删除备份
const handleDeleteBackup = (row) => {
  ElMessageBox.confirm(
    `确定要删除备份 "${row.backup_name}" 吗？删除后无法恢复。`,
    '提示',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(async () => {
    try {
      await deleteBackup(row.id)
      ElMessage.success('删除成功')
      fetchBackupList()
    } catch (error) {
      console.error('删除备份错误：', error)
      // 错误消息已在响应拦截器中显示
    }
  }).catch(() => {})
}

// 下载备份
const handleDownloadBackup = (row) => {
  ElMessage.info('下载功能需要后端支持文件下载接口，当前版本暂不支持')
  // 实际实现时，可以调用后端下载接口
  // window.open(`/api/system/backups/${row.id}/download`)
}

// 获取状态标签类型
const getStatusTagType = (status) => {
  const statusMap = {
    0: 'info',
    1: 'success',
    2: 'danger'
  }
  return statusMap[status] || ''
}

// 获取状态标签文本
const getStatusLabel = (status) => {
  const statusMap = {
    0: '进行中',
    1: '成功',
    2: '失败'
  }
  return statusMap[status] || '未知'
}

// 分页大小改变
const handleSizeChange = (val) => {
  pagination.limit = val
  pagination.page = 1
  fetchBackupList()
}

// 页码改变
const handlePageChange = (val) => {
  pagination.page = val
  fetchBackupList()
}

// 初始化
onMounted(() => {
  fetchBackupList()
})
</script>

<style scoped>
.system-backup-container {
  padding: 20px;
  background: #fff;
  min-height: calc(100vh - 60px);
}

.page-header {
  margin-bottom: 20px;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
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
