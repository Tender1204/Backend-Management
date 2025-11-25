<template>
  <el-dialog
    v-model="visible"
    title="操作日志"
    width="900px"
    @close="handleClose"
  >
    <!-- 筛选表单 -->
    <el-form :inline="true" style="margin-bottom: 20px">
      <el-form-item label="操作类型">
        <el-select v-model="filterForm.operateType" placeholder="全部" clearable style="width: 150px">
          <el-option label="导入" value="import" />
          <el-option label="修改" value="update" />
          <el-option label="回滚" value="rollback" />
          <el-option label="关联" value="bind" />
          <el-option label="解除关联" value="unbind" />
        </el-select>
      </el-form-item>
      <el-form-item label="时间范围">
        <el-date-picker
          v-model="dateRange"
          type="datetimerange"
          range-separator="至"
          start-placeholder="开始时间"
          end-placeholder="结束时间"
          format="YYYY-MM-DD HH:mm:ss"
          value-format="YYYY-MM-DD HH:mm:ss"
          style="width: 400px"
        />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" :icon="Search" @click="handleSearch">查询</el-button>
        <el-button :icon="Refresh" @click="handleReset">重置</el-button>
      </el-form-item>
    </el-form>

    <!-- 日志表格 -->
    <el-table
      v-loading="loading"
      :data="logList"
      stripe
      max-height="500"
    >
      <el-table-column type="index" label="序号" width="80" />
      <el-table-column prop="operateType" label="操作类型" width="120">
        <template #default="{ row }">
          <el-tag :type="getOperateTypeColor(row.operateType)">
            {{ getOperateTypeName(row.operateType) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="adminName" label="操作人" width="120" />
      <el-table-column prop="operateContent" label="操作内容" show-overflow-tooltip />
      <el-table-column prop="operateResult" label="结果" width="100">
        <template #default="{ row }">
          <el-tag :type="row.operateResult ? 'success' : 'danger'">
            {{ row.operateResult ? '成功' : '失败' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="errorMessage" label="错误信息" show-overflow-tooltip />
      <el-table-column prop="createdAt" label="操作时间" width="180">
        <template #default="{ row }">
          {{ formatDateTime(row.createdAt) }}
        </template>
      </el-table-column>
      <el-table-column label="变更详情" width="120">
        <template #default="{ row }">
          <el-button
            v-if="row.changeDetail"
            type="primary"
            link
            @click="handleViewDetail(row)"
          >
            查看详情
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 分页 -->
    <div style="margin-top: 20px; text-align: right">
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

    <!-- 变更详情弹窗 -->
    <el-dialog
      v-model="detailDialogVisible"
      title="变更详情"
      width="600px"
      append-to-body
    >
      <pre style="white-space: pre-wrap; word-wrap: break-word">{{ detailContent }}</pre>
    </el-dialog>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, watch } from 'vue'
import { Search, Refresh } from '@element-plus/icons-vue'
import { getOperateLogs } from '@/api/healthRule'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue'])

const visible = ref(false)
const loading = ref(false)
const detailDialogVisible = ref(false)
const detailContent = ref('')

const filterForm = reactive({
  operateType: null,
  startDate: null,
  endDate: null
})

const dateRange = ref(null)

const logList = ref([])
const pagination = reactive({
  page: 1,
  limit: 10,
  total: 0
})

// 监听visible变化
watch(() => props.modelValue, (val) => {
  visible.value = val
  if (val) {
    loadLogs()
  }
})

watch(visible, (val) => {
  emit('update:modelValue', val)
})

// 获取操作类型名称
const getOperateTypeName = (type) => {
  const map = {
    'import': '导入',
    'update': '修改',
    'rollback': '回滚',
    'bind': '关联',
    'unbind': '解除关联',
    'sync-dict': '同步字典'
  }
  return map[type] || type
}

// 获取操作类型颜色
const getOperateTypeColor = (type) => {
  const map = {
    'import': 'success',
    'update': 'primary',
    'rollback': 'warning',
    'bind': 'info',
    'unbind': 'danger',
    'sync-dict': 'success'
  }
  return map[type] || ''
}

// 格式化日期时间
const formatDateTime = (dateStr) => {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

// 加载日志
const loadLogs = async () => {
  try {
    loading.value = true
    const params = {
      page: pagination.page,
      limit: pagination.limit
    }
    
    if (filterForm.operateType) {
      params.operateType = filterForm.operateType
    }
    
    if (filterForm.startDate) {
      params.startDate = filterForm.startDate
    }
    
    if (filterForm.endDate) {
      params.endDate = filterForm.endDate
    }
    
    const result = await getOperateLogs(params)
    logList.value = result.list || []
    pagination.total = result.total || 0
  } catch (err) {
    console.error('加载操作日志失败：', err)
  } finally {
    loading.value = false
  }
}

// 查询
const handleSearch = () => {
  if (dateRange.value && dateRange.value.length === 2) {
    filterForm.startDate = dateRange.value[0]
    filterForm.endDate = dateRange.value[1]
  } else {
    filterForm.startDate = null
    filterForm.endDate = null
  }
  pagination.page = 1
  loadLogs()
}

// 重置
const handleReset = () => {
  filterForm.operateType = null
  dateRange.value = null
  filterForm.startDate = null
  filterForm.endDate = null
  pagination.page = 1
  loadLogs()
}

// 查看详情
const handleViewDetail = (row) => {
  detailContent.value = JSON.stringify(row.changeDetail, null, 2)
  detailDialogVisible.value = true
}

// 分页变化
const handleSizeChange = () => {
  loadLogs()
}

const handlePageChange = () => {
  loadLogs()
}

// 关闭
const handleClose = () => {
  visible.value = false
}
</script>

<style scoped>
pre {
  background: #f5f7fa;
  padding: 16px;
  border-radius: 4px;
  font-size: 12px;
  line-height: 1.6;
}
</style>

