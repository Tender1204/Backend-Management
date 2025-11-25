<template>
  <div class="content-list-container">
    <div class="page-header">
      <div class="header-left">
        <h2>
          <el-icon><Document /></el-icon>
          健康知识维护
        </h2>
        <p class="page-desc">维护健康科普内容，支持新增、编辑、删除、上下架等操作</p>
      </div>
      <div class="header-right">
        <el-button type="primary" :icon="Plus" @click="handleAdd">新增内容</el-button>
      </div>
    </div>

    <!-- 筛选表单 -->
    <el-card class="filter-card">
      <el-form :model="filterForm" :inline="true" class="filter-form">
        <el-form-item label="标题">
          <el-input
            v-model="filterForm.title"
            placeholder="请输入标题关键词"
            clearable
            style="width: 200px"
            @keyup.enter="handleSearch"
            @clear="handleReset"
          />
        </el-form-item>
        
        <el-form-item label="分类">
          <el-select v-model="filterForm.categoryId" placeholder="全部" clearable style="width: 150px">
            <el-option
              v-for="category in categories"
              :key="category.id"
              :label="category.category_name"
              :value="category.id"
            />
          </el-select>
        </el-form-item>
        
        <el-form-item label="状态">
          <el-select v-model="filterForm.publishStatus" placeholder="全部" clearable style="width: 150px">
            <el-option label="草稿" :value="0" />
            <el-option label="已发布" :value="1" />
            <el-option label="已下架" :value="2" />
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
        <el-table-column prop="title" label="标题" min-width="200" show-overflow-tooltip />
        <el-table-column prop="category_name" label="分类" width="120" />
        <el-table-column prop="tags" label="标签" width="200">
          <template #default="{ row }">
            <el-tag
              v-for="tag in row.tags"
              :key="tag"
              size="small"
              style="margin-right: 4px"
            >
              {{ tag }}
            </el-tag>
            <span v-if="!row.tags || row.tags.length === 0" class="text-muted">无标签</span>
          </template>
        </el-table-column>
        <el-table-column prop="publish_status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.publish_status)">
              {{ getStatusText(row.publish_status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="view_count" label="点击量" width="100" />
        <el-table-column prop="publish_time" label="发布时间" width="180" />
        <el-table-column label="操作" width="300" fixed="right">
          <template #default="{ row }">
            <el-button
              type="primary"
              link
              size="small"
              :icon="Edit"
              @click="handleEdit(row.id)"
            >
              编辑
            </el-button>
            <el-button
              v-if="row.publish_status === 1"
              type="warning"
              link
              size="small"
              :icon="Bottom"
              @click="handleOffline(row)"
            >
              下架
            </el-button>
            <el-button
              v-if="row.publish_status === 0 || row.publish_status === 2"
              type="success"
              link
              size="small"
              :icon="Top"
              @click="handleOnline(row)"
            >
              上架
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

      <!-- 分页 -->
      <div class="pagination-wrapper">
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
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Document, Plus, Search, Refresh, Edit, Delete, Top, Bottom
} from '@element-plus/icons-vue'
import {
  getContentList,
  deleteContent,
  updateContentStatus,
  getCategories
} from '@/api/content'

const router = useRouter()

// 数据
const loading = ref(false)
const tableData = ref([])
const categories = ref([])
const filterForm = reactive({
  title: '',
  categoryId: '',
  publishStatus: ''
})
const pagination = reactive({
  page: 1,
  limit: 10,
  total: 0
})

// 获取分类列表
const fetchCategories = async () => {
  try {
    const data = await getCategories()
    categories.value = data
  } catch (error) {
    console.error('获取分类列表失败：', error)
  }
}

// 获取内容列表
const fetchContentList = async () => {
  loading.value = true
  try {
    const params = {
      page: pagination.page,
      limit: pagination.limit,
      ...filterForm
    }
    // 移除空值
    Object.keys(params).forEach(key => {
      if (params[key] === '' || params[key] === null || params[key] === undefined) {
        delete params[key]
      }
    })
    
    const data = await getContentList(params)
    tableData.value = data.list
    pagination.total = data.total
  } catch (error) {
    console.error('获取内容列表失败：', error)
  } finally {
    loading.value = false
  }
}

// 状态文本
const getStatusText = (status) => {
  const statusMap = {
    0: '草稿',
    1: '已发布',
    2: '已下架'
  }
  return statusMap[status] || '未知'
}

// 状态类型
const getStatusType = (status) => {
  const typeMap = {
    0: 'info',
    1: 'success',
    2: 'warning'
  }
  return typeMap[status] || 'info'
}

// 搜索
const handleSearch = () => {
  pagination.page = 1
  fetchContentList()
}

// 重置
const handleReset = () => {
  filterForm.title = ''
  filterForm.categoryId = ''
  filterForm.publishStatus = ''
  pagination.page = 1
  fetchContentList()
}

// 新增
const handleAdd = () => {
  router.push('/content/edit')
}

// 编辑
const handleEdit = (id) => {
  router.push(`/content/edit?id=${id}`)
}

// 上架
const handleOnline = async (row) => {
  try {
    await ElMessageBox.confirm(
      `确定要上架内容"${row.title}"吗？`,
      '提示',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    await updateContentStatus(row.id, 1)
    ElMessage.success('上架成功')
    fetchContentList()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('上架失败：', error)
    }
  }
}

// 下架
const handleOffline = async (row) => {
  try {
    await ElMessageBox.confirm(
      `确定要下架内容"${row.title}"吗？下架后用户端将不可见。`,
      '提示',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    await updateContentStatus(row.id, 2)
    ElMessage.success('下架成功')
    fetchContentList()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('下架失败：', error)
    }
  }
}

// 删除
const handleDelete = async (row) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除内容"${row.title}"吗？此操作不可恢复！`,
      '警告',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'error'
      }
    )
    
    await deleteContent(row.id)
    ElMessage.success('删除成功')
    fetchContentList()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除失败：', error)
    }
  }
}

// 分页
const handleSizeChange = (size) => {
  pagination.limit = size
  pagination.page = 1
  fetchContentList()
}

const handlePageChange = (page) => {
  pagination.page = page
  fetchContentList()
}

// 初始化
onMounted(() => {
  fetchCategories()
  fetchContentList()
})
</script>

<style scoped>
.content-list-container {
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

.text-muted {
  color: #909399;
  font-size: 12px;
}

.pagination-wrapper {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}
</style>
