<template>
  <div class="content-push-container">
    <div class="page-header">
      <div class="header-left">
        <h2>
          <el-icon><Promotion /></el-icon>
          内容推送管理
        </h2>
        <p class="page-desc">管理内容推送任务，支持立即推送和定时推送</p>
      </div>
      <div class="header-right">
        <el-button type="primary" :icon="Plus" @click="handleAddPush">新增推送</el-button>
      </div>
    </div>

    <!-- 数据表格 -->
    <el-card class="table-card">
      <el-table
        v-loading="loading"
        :data="tableData"
        stripe
        style="width: 100%"
      >
        <el-table-column type="index" label="序号" width="80" :index="(index) => (pagination.page - 1) * pagination.limit + index + 1" />
        <el-table-column prop="content_title" label="内容标题" min-width="200" show-overflow-tooltip />
        <el-table-column prop="push_type" label="推送类型" width="120">
          <template #default="{ row }">
            <el-tag :type="row.push_type === 1 ? 'success' : 'warning'">
              {{ row.push_type === 1 ? '立即推送' : '定时推送' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="target_type" label="推送对象" min-width="200">
          <template #default="{ row }">
            <span v-if="row.target_type === 1">全部用户</span>
            <span v-else>
              指定标签：
              <template v-if="row.target_tags && Array.isArray(row.target_tags) && row.target_tags.length > 0">
                <el-tag
                  v-for="tagId in getValidTags(row.target_tags)"
                  :key="tagId"
                  size="small"
                  style="margin-left: 4px"
                >
                  {{ getTagName(tagId) }}
                </el-tag>
                <span v-if="getValidTags(row.target_tags).length === 0" class="text-muted" style="font-size: 12px; margin-left: 4px;">
                  (标签加载中或标签不存在)
                </span>
              </template>
              <span v-else class="text-muted" style="font-size: 12px;">
                未选择标签
              </span>
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="push_time" label="推送时间" width="180">
          <template #default="{ row }">
            <span v-if="row.push_type === 1">立即推送</span>
            <span v-else>{{ row.push_time || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="push_status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.push_status)">
              {{ getStatusText(row.push_status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="push_count" label="推送人数" width="120" />
        <el-table-column prop="created_at" label="创建时间" width="180" />
        <el-table-column label="操作" width="250" fixed="right">
          <template #default="{ row }">
            <el-button
              type="primary"
              link
              size="small"
              :icon="View"
              @click="handleViewDetail(row.id)"
            >
              查看详情
            </el-button>
            <el-button
              v-if="row.push_status === 0"
              type="warning"
              link
              size="small"
              :icon="Close"
              @click="handleCancel(row)"
            >
              取消推送
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

    <!-- 新增推送对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="'新增推送任务'"
      width="600px"
      @close="handleDialogClose"
    >
      <el-form
        ref="pushFormRef"
        :model="pushFormData"
        :rules="pushFormRules"
        label-width="120px"
      >
        <el-form-item label="选择内容" prop="contentId">
          <el-select
            v-model="pushFormData.contentId"
            placeholder="请选择要推送的内容"
            filterable
            style="width: 100%"
            @change="handleContentChange"
          >
            <el-option
              v-for="content in availableContents"
              :key="content.id"
              :label="content.title"
              :value="content.id"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="推送类型" prop="pushType">
          <el-radio-group v-model="pushFormData.pushType" @change="handlePushTypeChange">
            <el-radio :label="1">立即推送</el-radio>
            <el-radio :label="2">定时推送</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item
          v-if="pushFormData.pushType === 2"
          label="推送时间"
          prop="pushTime"
        >
          <el-date-picker
            v-model="pushFormData.pushTime"
            type="datetime"
            placeholder="请选择推送时间"
            format="YYYY-MM-DD HH:mm:ss"
            value-format="YYYY-MM-DD HH:mm:ss"
            style="width: 100%"
            :disabled-date="disabledDate"
            :disabled-time="disabledTime"
          />
        </el-form-item>

        <el-form-item label="推送对象" prop="targetType">
          <el-radio-group v-model="pushFormData.targetType" @change="handleTargetTypeChange">
            <el-radio :label="1">全部用户</el-radio>
            <el-radio :label="2">指定标签</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item
          v-if="pushFormData.targetType === 2"
          label="选择标签"
          prop="targetTags"
        >
          <el-select
            ref="tagSelectRef"
            v-model="pushFormData.targetTags"
            multiple
            placeholder="请选择标签（可多选）"
            style="width: 100%"
            @change="handleTagChange"
            @visible-change="handleTagVisibleChange"
          >
            <el-option
              v-for="tag in tags"
              :key="tag.id"
              :label="tag.tag_name"
              :value="tag.id"
            />
            <template #tag="{ item, close }">
              <el-tag
                v-if="item && item.value"
                closable
                @close="close"
                style="margin-right: 4px; margin-bottom: 2px"
                type="info"
                effect="plain"
              >
                {{ item.label }}
              </el-tag>
            </template>
          </el-select>
          <div class="form-tip" style="margin-top: 4px; color: #909399; font-size: 12px;">
            已选择 {{ pushFormData.targetTags.length }} 个标签
          </div>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmitPush" :loading="submitting">
          确定
        </el-button>
      </template>
    </el-dialog>

    <!-- 推送详情对话框 -->
    <el-dialog
      v-model="detailDialogVisible"
      title="推送任务详情"
      width="700px"
    >
      <div v-if="pushDetail" class="push-detail">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="内容标题">
            {{ pushDetail.content_title }}
          </el-descriptions-item>
          <el-descriptions-item label="推送类型">
            <el-tag :type="pushDetail.push_type === 1 ? 'success' : 'warning'">
              {{ pushDetail.push_type === 1 ? '立即推送' : '定时推送' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="推送时间">
            {{ pushDetail.push_type === 1 ? '立即推送' : (pushDetail.push_time || '-') }}
          </el-descriptions-item>
          <el-descriptions-item label="推送对象">
            <span v-if="pushDetail.target_type === 1">全部用户</span>
            <span v-else>
              指定标签：
              <el-tag
                v-for="tagId in pushDetail.target_tags"
                :key="tagId"
                size="small"
                style="margin-left: 4px"
              >
                {{ getTagName(tagId) }}
              </el-tag>
            </span>
          </el-descriptions-item>
          <el-descriptions-item label="推送状态">
            <el-tag :type="getStatusType(pushDetail.push_status)">
              {{ getStatusText(pushDetail.push_status) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="推送人数">
            {{ pushDetail.push_count || 0 }}
          </el-descriptions-item>
          <el-descriptions-item label="创建时间" :span="2">
            {{ pushDetail.created_at }}
          </el-descriptions-item>
        </el-descriptions>

        <div v-if="pushDetail.content_body" class="content-preview" style="margin-top: 20px">
          <h4>内容预览：</h4>
          <div class="content-body" v-html="pushDetail.content_body"></div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Promotion, Plus, View, Close, Delete
} from '@element-plus/icons-vue'
import {
  getPushTaskList,
  getPushTaskDetail,
  cancelPushTask,
  deletePushTask,
  createPushTask,
  getContentList
} from '@/api/content'
import { getTagList } from '@/api/user'

// 数据
const loading = ref(false)
const submitting = ref(false)
const tableData = ref([])
const tags = ref([])
const availableContents = ref([])
const pushDetail = ref(null)
const dialogVisible = ref(false)
const detailDialogVisible = ref(false)
const pushFormRef = ref(null)
const tagSelectRef = ref(null)

const pagination = reactive({
  page: 1,
  limit: 10,
  total: 0
})

const pushFormData = reactive({
  contentId: '',
  pushType: 1,
  pushTime: '',
  targetType: 1,
  targetTags: []
})

const pushFormRules = {
  contentId: [
    { required: true, message: '请选择要推送的内容', trigger: 'change' }
  ],
  pushType: [
    { required: true, message: '请选择推送类型', trigger: 'change' }
  ],
  pushTime: [
    { required: true, message: '请选择推送时间', trigger: 'change' }
  ],
  targetType: [
    { required: true, message: '请选择推送对象', trigger: 'change' }
  ],
  targetTags: [
    { required: true, message: '请至少选择一个标签', trigger: 'change' }
  ]
}

// 获取标签列表
const fetchTags = async () => {
  try {
    const data = await getTagList()
    tags.value = data
  } catch (error) {
    console.error('获取标签列表失败：', error)
  }
}

// 获取可用内容列表（已发布的内容）
const fetchAvailableContents = async () => {
  try {
    const data = await getContentList({ publishStatus: 1, limit: 1000 })
    availableContents.value = data.list || []
  } catch (error) {
    console.error('获取内容列表失败：', error)
  }
}

// 获取推送任务列表
const fetchPushTaskList = async () => {
  loading.value = true
  try {
    const params = {
      page: pagination.page,
      limit: pagination.limit
    }
    
    const data = await getPushTaskList(params)
    tableData.value = data.list
    
    // 调试输出：查看标签数据
    console.log('推送任务列表数据：', data.list.map(task => ({
      id: task.id,
      content_title: task.content_title,
      target_type: task.target_type,
      target_tags: task.target_tags,
      target_tags_type: typeof task.target_tags,
      target_tags_isArray: Array.isArray(task.target_tags)
    })))
    
    pagination.total = data.total
  } catch (error) {
    console.error('获取推送任务列表失败：', error)
  } finally {
    loading.value = false
  }
}

// 状态文本
const getStatusText = (status) => {
  const statusMap = {
    0: '待推送',
    1: '已推送',
    2: '已取消'
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

// 获取有效标签（不过滤，直接返回所有有效的标签ID）
const getValidTags = (tagIds) => {
  if (!Array.isArray(tagIds) || tagIds.length === 0) {
    return []
  }
  
  // 确保标签ID是数字类型，过滤掉无效值
  const normalizedTagIds = tagIds.map(id => {
    const numId = parseInt(id)
    return isNaN(numId) ? null : numId
  }).filter(id => id !== null && id > 0)
  
  if (normalizedTagIds.length === 0) {
    console.warn('标签ID数组为空或无效：', tagIds)
    return []
  }
  
  // 直接返回所有有效的标签ID，不进行过滤
  // 因为标签可能被删除了，但我们仍然需要显示它们
  return normalizedTagIds
}

// 获取标签名称
const getTagName = (tagId) => {
  // 确保tagId是数字类型
  const numId = parseInt(tagId)
  if (isNaN(numId)) {
    return `无效标签(${tagId})`
  }
  
  const tag = tags.value.find(t => parseInt(t.id) === numId)
  // 如果标签不存在，返回ID而不是"标签X"（避免混淆）
  return tag ? tag.tag_name : `标签ID:${numId}`
}

// 查看详情
const handleViewDetail = async (id) => {
  try {
    const data = await getPushTaskDetail(id)
    pushDetail.value = data
    detailDialogVisible.value = true
  } catch (error) {
    console.error('获取推送任务详情失败：', error)
  }
}

// 取消推送
const handleCancel = async (row) => {
  try {
    await ElMessageBox.confirm(
      `确定要取消推送任务吗？取消后可以删除该任务。`,
      '提示',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    await cancelPushTask(row.id)
    ElMessage.success('取消推送成功')
    fetchPushTaskList()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('取消推送失败：', error)
    }
  }
}

// 删除推送任务
const handleDelete = async (row) => {
  try {
    const statusText = row.push_status === 0 ? '待推送' : row.push_status === 1 ? '已推送' : '已取消'
    await ElMessageBox.confirm(
      `确定要删除推送任务"${row.content_title}"吗？当前状态：${statusText}。此操作不可恢复！`,
      '警告',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'error'
      }
    )
    
    await deletePushTask(row.id)
    ElMessage.success('删除推送任务成功')
    fetchPushTaskList()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除推送任务失败：', error)
    }
  }
}

// 新增推送
const handleAddPush = () => {
  dialogVisible.value = true
  fetchAvailableContents()
}

// 推送类型改变
const handlePushTypeChange = () => {
  if (pushFormData.pushType === 1) {
    pushFormData.pushTime = ''
  }
}

// 推送对象改变
const handleTargetTypeChange = () => {
  // 如果切换为全部用户，清空标签
  if (pushFormData.targetType === 1) {
    pushFormData.targetTags = []
  } else {
    // 如果切换为指定标签，确保targetTags是数组
    if (!Array.isArray(pushFormData.targetTags)) {
      pushFormData.targetTags = []
    }
  }
  // 清除标签验证错误
  if (pushFormRef.value) {
    pushFormRef.value.clearValidate('targetTags')
  }
}

// 标签选择变化（选择后自动收起）
const handleTagChange = (value) => {
  console.log('标签选择变化：', {
    value,
    valueType: typeof value,
    isArray: Array.isArray(value),
    length: Array.isArray(value) ? value.length : 0,
    currentTargetTags: pushFormData.targetTags,
    allTags: tags.value.map(t => ({ id: t.id, name: t.tag_name }))
  })
  
  // 确保只保存选中的标签值，过滤掉无效值
  if (Array.isArray(value)) {
    // 确保只保存有效的标签ID（存在于tags列表中的）
    const validTagIds = tags.value.map(t => t.id)
    const filteredValue = value
      .map(tagId => {
        const id = parseInt(tagId)
        return isNaN(id) ? null : id
      })
      .filter(tagId => {
        // 过滤掉无效值
        if (tagId === null || tagId === undefined || tagId <= 0) {
          return false
        }
        // 确保标签ID存在于tags列表中
        return validTagIds.includes(tagId)
      })
    
    // 更新表单数据（确保只保存有效的标签）
    pushFormData.targetTags = filteredValue
    
    console.log('过滤后的标签：', {
      original: value,
      filtered: filteredValue,
      validTagIds: validTagIds
    })
    
    // 如果过滤后的标签数量与原始值不同，说明有无效标签被过滤
    if (filteredValue.length !== value.length) {
      ElMessage.warning(`已过滤 ${value.length - filteredValue.length} 个无效标签`)
    }
  } else {
    // 如果不是数组，清空
    pushFormData.targetTags = []
  }
  
  // 延迟一下，让选择操作完成后再收起
  nextTick(() => {
    if (tagSelectRef.value) {
      // 收起下拉框
      tagSelectRef.value.blur()
    }
  })
}

// 标签下拉框显示/隐藏变化
const handleTagVisibleChange = (visible) => {
  // 可以在这里添加其他逻辑
}

// 内容改变
const handleContentChange = () => {
  // 可以在这里加载内容详情
}

// 提交推送
const handleSubmitPush = async () => {
  if (!pushFormRef.value) return
  
  try {
    // 动态验证规则 - 只验证需要的字段
    const validateFields = ['contentId', 'pushType', 'targetType']
    
    // 如果是定时推送，需要验证推送时间
    if (pushFormData.pushType === 2) {
      validateFields.push('pushTime')
    }
    
    // 如果是指定标签，需要验证标签
    if (pushFormData.targetType === 2) {
      validateFields.push('targetTags')
    }
    
    // 只验证需要的字段
    for (const field of validateFields) {
      await pushFormRef.value.validateField(field)
    }
    
    // 验证定时推送时间
    if (pushFormData.pushType === 2) {
      if (!pushFormData.pushTime) {
        ElMessage.warning('请选择推送时间')
        return
      }
      const pushTime = new Date(pushFormData.pushTime)
      const now = new Date()
      if (pushTime <= now) {
        ElMessage.warning('推送时间必须晚于当前时间')
        return
      }
    }
    
    // 验证指定标签
    if (pushFormData.targetType === 2) {
      if (!pushFormData.targetTags || pushFormData.targetTags.length === 0) {
        ElMessage.warning('请至少选择一个标签')
        return
      }
    }
    
    // 在提交前检查数据
    console.log('提交前的表单数据：', {
      targetType: pushFormData.targetType,
      targetTags: pushFormData.targetTags,
      targetTagsLength: pushFormData.targetTags?.length,
      allTags: tags.value.map(t => t.id)
    })
    
    submitting.value = true
    
    // 确保只提交选中的标签（创建新数组避免引用问题，并过滤掉无效值）
    // 只取pushFormData.targetTags中有效的标签ID
    let selectedTags = []
    if (pushFormData.targetType === 2) {
      // 检查targetTags是否是数组
      if (!Array.isArray(pushFormData.targetTags)) {
        ElMessage.warning('标签数据格式错误，请重新选择')
        submitting.value = false
        return
      }
      
      // 确保targetTags是正确的数组，并且只包含有效的标签ID
      // 直接使用值，不转换（因为标签ID应该已经是数字类型）
      selectedTags = pushFormData.targetTags
        .filter(tagId => {
          // 过滤掉null、undefined、空字符串和非数字
          if (tagId === null || tagId === undefined || tagId === '') {
            return false
          }
          const id = parseInt(tagId)
          return !isNaN(id) && id > 0
        })
        .map(tagId => parseInt(tagId))
      
      // 验证标签ID是否存在于tags列表中（确保是有效的标签）
      const validTagIds = tags.value.map(t => t.id)
      selectedTags = selectedTags.filter(tagId => validTagIds.includes(tagId))
      
      console.log('处理后的标签：', {
        original: pushFormData.targetTags,
        selected: selectedTags,
        validTagIds: validTagIds
      })
      
      if (selectedTags.length === 0) {
        ElMessage.warning('请至少选择一个有效的标签')
        submitting.value = false
        return
      }
    }
    
    // 确保contentId是单个数字，不是数组
    let finalContentId = pushFormData.contentId
    if (Array.isArray(finalContentId)) {
      // 如果是数组，取第一个元素
      finalContentId = finalContentId.length > 0 ? finalContentId[0] : null
      console.warn('contentId是数组，转换为单个值：', finalContentId)
    }
    
    // 确保是数字类型
    const numContentId = parseInt(finalContentId)
    if (isNaN(numContentId) || numContentId <= 0) {
      ElMessage.warning('请选择要推送的内容')
      submitting.value = false
      return
    }
    
    const submitData = {
      contentId: numContentId,
      pushType: pushFormData.pushType,
      pushTime: pushFormData.pushType === 2 ? pushFormData.pushTime : null,
      targetType: pushFormData.targetType,
      targetTags: selectedTags
    }
    
    console.log('最终提交的数据：', submitData)
    
    await createPushTask(submitData)
    ElMessage.success('推送任务创建成功')
    dialogVisible.value = false
    fetchPushTaskList()
  } catch (error) {
    if (error !== false) {
      // 不显示错误消息，因为request.js已经显示了
      console.error('创建推送任务失败：', error)
    }
  } finally {
    submitting.value = false
  }
}

// 对话框关闭
const handleDialogClose = () => {
  pushFormRef.value?.resetFields()
  pushFormData.contentId = ''
  pushFormData.pushType = 1
  pushFormData.pushTime = ''
  pushFormData.targetType = 1
  pushFormData.targetTags = []
}

// 禁用过去的日期
const disabledDate = (time) => {
  return time.getTime() < Date.now() - 8.64e7 // 禁用今天之前的日期
}

// 禁用过去的时间
const disabledTime = (time) => {
  const now = new Date()
  const selectedDate = new Date(time)
  if (selectedDate.toDateString() === now.toDateString()) {
    // 如果是今天，禁用过去的时间
    return {
      disabledHours: () => {
        const hours = []
        for (let i = 0; i < now.getHours(); i++) {
          hours.push(i)
        }
        return hours
      },
      disabledMinutes: (hour) => {
        if (hour === now.getHours()) {
          const minutes = []
          for (let i = 0; i <= now.getMinutes(); i++) {
            minutes.push(i)
          }
          return minutes
        }
        return []
      }
    }
  }
  return {}
}

// 分页
const handleSizeChange = (size) => {
  pagination.limit = size
  pagination.page = 1
  fetchPushTaskList()
}

const handlePageChange = (page) => {
  pagination.page = page
  fetchPushTaskList()
}

// 初始化
onMounted(() => {
  fetchTags()
  fetchPushTaskList()
})
</script>

<style scoped>
.content-push-container {
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

.text-muted {
  color: #909399;
  font-size: 12px;
}

.pagination-wrapper {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}

.push-detail {
  padding: 10px 0;
}

.content-preview {
  border-top: 1px solid #ebeef5;
  padding-top: 20px;
}

.content-preview h4 {
  margin: 0 0 10px 0;
  color: #303133;
}

.content-body {
  max-height: 400px;
  overflow-y: auto;
  padding: 10px;
  background: #f5f7fa;
  border-radius: 4px;
}
</style>

