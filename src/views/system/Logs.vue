<template>
  <div class="system-logs-container">
    <div class="page-header">
      <h2>
        <el-icon><Document /></el-icon>
        系统日志
      </h2>
      <p class="page-desc">查看系统运行日志，监控系统状态</p>
    </div>

    <!-- 筛选表单 -->
    <el-card class="filter-card">
      <el-form :model="filterForm" :inline="true" class="filter-form">
        <el-form-item label="日志类型">
          <el-select v-model="filterForm.logType" placeholder="全部" clearable style="width: 150px">
            <el-option label="登录" value="login" />
            <el-option label="操作" value="operation" />
            <el-option label="错误" value="error" />
          </el-select>
        </el-form-item>
        
        <el-form-item label="模块名称">
          <el-input
            v-model="filterForm.moduleName"
            placeholder="请输入模块名称"
            clearable
            style="width: 200px"
          />
        </el-form-item>
        
        <el-form-item label="时间范围">
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
        <el-table-column prop="logType" label="日志类型" width="100">
          <template #default="{ row }">
            <el-tag :type="getLogTypeTagType(row.logType)">
              {{ getLogTypeLabel(row.logType) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="moduleName" label="模块" width="120" />
        <el-table-column prop="operation" label="操作" min-width="200" show-overflow-tooltip />
        <el-table-column prop="adminNickname" label="操作人" width="120" />
        <el-table-column prop="requestMethod" label="请求方法" width="100">
          <template #default="{ row }">
            <el-tag :type="getMethodTagType(row.requestMethod)" size="small">
              {{ row.requestMethod }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="requestUrl" label="请求URL" min-width="200" show-overflow-tooltip />
        <el-table-column prop="responseStatus" label="状态码" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.responseStatus" :type="getStatusTagType(row.responseStatus)" size="small">
              {{ row.responseStatus }}
            </el-tag>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="ipAddress" label="IP地址" width="140" />
        <el-table-column prop="executionTime" label="执行时间" width="100">
          <template #default="{ row }">
            <span v-if="row.executionTime">{{ row.executionTime }}ms</span>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="180" />
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" :icon="View" @click="handleViewDetail(row)">详情</el-button>
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

    <!-- 日志详情对话框 -->
    <el-dialog
      v-model="detailDialogVisible"
      title="日志详情"
      width="800px"
    >
      <el-descriptions :column="2" border v-if="currentLog">
        <el-descriptions-item label="日志ID">{{ currentLog.id }}</el-descriptions-item>
        <el-descriptions-item label="日志类型">
          <el-tag :type="getLogTypeTagType(currentLog.logType)">
            {{ getLogTypeLabel(currentLog.logType) }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="模块名称">{{ currentLog.moduleName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="操作描述">{{ currentLog.operation || '-' }}</el-descriptions-item>
        <el-descriptions-item label="操作人">{{ currentLog.adminNickname || '系统' }}</el-descriptions-item>
        <el-descriptions-item label="请求方法">
          <el-tag :type="getMethodTagType(currentLog.requestMethod)" size="small">
            {{ currentLog.requestMethod || '-' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="请求URL" :span="2">{{ currentLog.requestUrl || '-' }}</el-descriptions-item>
        <el-descriptions-item label="请求参数" :span="2">
          <pre v-if="currentLog.requestParams" style="max-height: 200px; overflow: auto; background: #f5f7fa; padding: 10px; border-radius: 4px;">{{ JSON.stringify(currentLog.requestParams, null, 2) }}</pre>
          <span v-else>-</span>
        </el-descriptions-item>
        <el-descriptions-item label="响应状态码">
          <el-tag v-if="currentLog.responseStatus" :type="getStatusTagType(currentLog.responseStatus)" size="small">
            {{ currentLog.responseStatus }}
          </el-tag>
          <span v-else>-</span>
        </el-descriptions-item>
        <el-descriptions-item label="执行时间">
          <span v-if="currentLog.executionTime">{{ currentLog.executionTime }}ms</span>
          <span v-else>-</span>
        </el-descriptions-item>
        <el-descriptions-item label="IP地址">{{ currentLog.ipAddress || '-' }}</el-descriptions-item>
        <el-descriptions-item label="用户代理" :span="2">{{ currentLog.userAgent || '-' }}</el-descriptions-item>
        <el-descriptions-item label="错误信息" :span="2" v-if="currentLog.errorMessage">
          <el-alert type="error" :closable="false">{{ currentLog.errorMessage }}</el-alert>
        </el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ currentLog.createdAt }}</el-descriptions-item>
      </el-descriptions>
      <template #footer>
        <el-button @click="detailDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Search, Refresh, View, Document } from '@element-plus/icons-vue'
import { getLogList, getLogDetail } from '@/api/system'

// 数据状态
const loading = ref(false)
const tableData = ref([])
const dateRange = ref([])

// 筛选表单
const filterForm = reactive({
  logType: '',
  moduleName: '',
  startDate: '',
  endDate: ''
})

// 分页
const pagination = reactive({
  page: 1,
  limit: 20,
  total: 0
})

// 详情对话框
const detailDialogVisible = ref(false)
const currentLog = ref(null)

// 监听日期范围变化
watch(dateRange, (newVal) => {
  if (newVal && newVal.length === 2) {
    filterForm.startDate = newVal[0]
    filterForm.endDate = newVal[1]
  } else {
    filterForm.startDate = ''
    filterForm.endDate = ''
  }
})

// 获取日志列表
const fetchLogList = async () => {
  loading.value = true
  try {
    const params = {
      page: pagination.page,
      limit: pagination.limit,
      ...(filterForm.logType && { logType: filterForm.logType }),
      ...(filterForm.moduleName && { moduleName: filterForm.moduleName }),
      ...(filterForm.startDate && { startDate: filterForm.startDate }),
      ...(filterForm.endDate && { endDate: filterForm.endDate })
    }
    const data = await getLogList(params)
    tableData.value = data.list || []
    pagination.total = data.total || 0
  } catch (error) {
    console.error('获取日志列表错误：', error)
    // 错误消息已在响应拦截器中显示
  } finally {
    loading.value = false
  }
}

// 查询
const handleSearch = () => {
  pagination.page = 1
  fetchLogList()
}

// 重置
const handleReset = () => {
  filterForm.logType = ''
  filterForm.moduleName = ''
  filterForm.startDate = ''
  filterForm.endDate = ''
  dateRange.value = []
  pagination.page = 1
  fetchLogList()
}

// 查看详情
const handleViewDetail = async (row) => {
  try {
    const data = await getLogDetail(row.id)
    currentLog.value = data
    detailDialogVisible.value = true
  } catch (error) {
    console.error('获取日志详情错误：', error)
    // 错误消息已在响应拦截器中显示
  }
}

// 获取日志类型标签类型
const getLogTypeTagType = (type) => {
  const typeMap = {
    login: 'success',
    operation: '',
    error: 'danger'
  }
  return typeMap[type] || ''
}

// 获取日志类型标签文本
const getLogTypeLabel = (type) => {
  const typeMap = {
    login: '登录',
    operation: '操作',
    error: '错误'
  }
  return typeMap[type] || type
}

// 获取请求方法标签类型
const getMethodTagType = (method) => {
  const methodMap = {
    GET: 'success',
    POST: 'warning',
    PUT: 'primary',
    DELETE: 'danger'
  }
  return methodMap[method] || ''
}

// 获取状态码标签类型
const getStatusTagType = (status) => {
  if (status >= 200 && status < 300) return 'success'
  if (status >= 300 && status < 400) return 'warning'
  if (status >= 400) return 'danger'
  return ''
}

// 分页大小改变
const handleSizeChange = (val) => {
  pagination.limit = val
  pagination.page = 1
  fetchLogList()
}

// 页码改变
const handlePageChange = (val) => {
  pagination.page = val
  fetchLogList()
}

// 初始化
onMounted(() => {
  fetchLogList()
})
</script>

<style scoped>
.system-logs-container {
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

pre {
  margin: 0;
  font-family: 'Courier New', monospace;
  font-size: 12px;
}
</style>
