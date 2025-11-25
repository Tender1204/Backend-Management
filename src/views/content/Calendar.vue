<template>
  <div class="content-calendar-container">
    <div class="page-header">
      <div class="header-left">
        <h2>
          <el-icon><Calendar /></el-icon>
          运营日历
        </h2>
        <p class="page-desc">查看和管理内容推送任务的日程安排</p>
      </div>
      <div class="header-right">
        <el-button type="primary" :icon="Plus" @click="handleAddPush">新增推送</el-button>
      </div>
    </div>

    <!-- 工具栏 -->
    <el-card class="toolbar-card">
      <div class="toolbar">
        <div class="toolbar-left">
          <el-button-group>
            <el-button :icon="ArrowLeft" @click="handlePrevMonth">上个月</el-button>
            <el-button @click="handleToday">今天</el-button>
            <el-button :icon="ArrowRight" @click="handleNextMonth">下个月</el-button>
          </el-button-group>
          <span class="current-date">{{ currentDateText }}</span>
        </div>
        <div class="toolbar-right">
          <el-radio-group v-model="viewMode" @change="handleViewModeChange">
            <el-radio-button label="month">月视图</el-radio-button>
            <el-radio-button label="week">周视图</el-radio-button>
          </el-radio-group>
        </div>
      </div>
    </el-card>

    <!-- 日历视图 -->
    <el-card class="calendar-card">
      <!-- 月视图 -->
      <div v-if="viewMode === 'month'" class="month-view">
        <!-- 星期标题 -->
        <div class="weekdays">
          <div class="weekday" v-for="day in weekdays" :key="day">{{ day }}</div>
        </div>
        <!-- 日期网格 -->
        <div class="days-grid">
          <div
            v-for="(day, index) in calendarDays"
            :key="index"
            class="day-cell"
            :class="{
              'is-today': isToday(day),
              'is-other-month': !isCurrentMonth(day),
              'has-tasks': getDayTasks(day).length > 0
            }"
            @click="handleDayClick(day)"
          >
            <div class="day-number">{{ day.getDate() }}</div>
            <div class="day-tasks">
              <el-tag
                v-for="(task, taskIndex) in getDayTasks(day).slice(0, 2)"
                :key="taskIndex"
                :type="getTaskStatusType(task.push_status)"
                size="small"
                class="task-tag"
              >
                {{ task.content_title }}
              </el-tag>
              <span v-if="getDayTasks(day).length > 2" class="more-tasks">
                +{{ getDayTasks(day).length - 2 }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- 周视图 -->
      <div v-else class="week-view">
        <div class="week-header">
          <div class="time-column">时间</div>
          <div
            v-for="day in weekDays"
            :key="day.getTime()"
            class="day-column"
            :class="{ 'is-today': isToday(day) }"
          >
            <div class="day-header">
              <div class="day-name">{{ getDayName(day) }}</div>
              <div class="day-date">{{ day.getDate() }}日</div>
            </div>
          </div>
        </div>
        <div class="week-body">
          <div class="time-column">
            <div
              v-for="hour in 24"
              :key="hour"
              class="time-slot"
            >
              {{ String(hour - 1).padStart(2, '0') }}:00
            </div>
          </div>
          <div
            v-for="day in weekDays"
            :key="day.getTime()"
            class="day-column"
          >
            <div
              v-for="hour in 24"
              :key="hour"
              class="time-slot"
            >
              <div
                v-for="task in getHourTasks(day, hour - 1)"
                :key="task.id"
                class="task-item"
                :class="`status-${task.push_status}`"
                @click="handleTaskClick(task)"
              >
                <div class="task-title">{{ task.content_title }}</div>
                <div class="task-time">{{ formatTime(task.push_time) }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </el-card>

    <!-- 日期详情对话框 -->
    <el-dialog
      v-model="dayDialogVisible"
      :title="`${selectedDateText} 的推送任务`"
      width="800px"
    >
      <el-table
        :data="selectedDayTasks"
        stripe
        style="width: 100%"
      >
        <el-table-column prop="content_title" label="内容标题" min-width="200" />
        <el-table-column prop="push_type" label="推送类型" width="120">
          <template #default="{ row }">
            <el-tag :type="row.push_type === 1 ? 'success' : 'warning'">
              {{ row.push_type === 1 ? '立即推送' : '定时推送' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="push_time" label="推送时间" width="180" />
        <el-table-column prop="push_status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getTaskStatusType(row.push_status)">
              {{ getTaskStatusText(row.push_status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150">
          <template #default="{ row }">
            <el-button
              type="primary"
              link
              size="small"
              @click="handleViewTaskDetail(row.id)"
            >
              查看详情
            </el-button>
            <el-button
              v-if="row.push_status === 0"
              type="danger"
              link
              size="small"
              @click="handleCancelTask(row)"
            >
              取消
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>

    <!-- 任务详情对话框 -->
    <el-dialog
      v-model="taskDialogVisible"
      title="推送任务详情"
      width="700px"
    >
      <div v-if="selectedTask" class="task-detail">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="内容标题">
            {{ selectedTask.content_title }}
          </el-descriptions-item>
          <el-descriptions-item label="推送类型">
            <el-tag :type="selectedTask.push_type === 1 ? 'success' : 'warning'">
              {{ selectedTask.push_type === 1 ? '立即推送' : '定时推送' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="推送时间">
            {{ selectedTask.push_type === 1 ? '立即推送' : (selectedTask.push_time || '-') }}
          </el-descriptions-item>
          <el-descriptions-item label="推送对象">
            <span v-if="selectedTask.target_type === 1">全部用户</span>
            <span v-else>
              指定标签：
              <el-tag
                v-for="tagId in selectedTask.target_tags"
                :key="tagId"
                size="small"
                style="margin-left: 4px"
              >
                {{ getTagName(tagId) }}
              </el-tag>
            </span>
          </el-descriptions-item>
          <el-descriptions-item label="推送状态">
            <el-tag :type="getTaskStatusType(selectedTask.push_status)">
              {{ getTaskStatusText(selectedTask.push_status) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="推送人数">
            {{ selectedTask.push_count || 0 }}
          </el-descriptions-item>
          <el-descriptions-item label="创建时间" :span="2">
            {{ selectedTask.created_at }}
          </el-descriptions-item>
        </el-descriptions>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Calendar, Plus, ArrowLeft, ArrowRight
} from '@element-plus/icons-vue'
import {
  getPushTaskList,
  getPushTaskDetail,
  cancelPushTask
} from '@/api/content'
import { getTagList } from '@/api/user'

const router = useRouter()

// 数据
const loading = ref(false)
const pushTasks = ref([])
const tags = ref([])
const viewMode = ref('month')
const currentDate = ref(new Date())
const dayDialogVisible = ref(false)
const taskDialogVisible = ref(false)
const selectedDate = ref(null)
const selectedTask = ref(null)

// 星期名称
const weekdays = ['日', '一', '二', '三', '四', '五', '六']

// 当前日期文本
const currentDateText = computed(() => {
  const year = currentDate.value.getFullYear()
  const month = currentDate.value.getMonth() + 1
  return `${year}年${month}月`
})

// 选中的日期文本
const selectedDateText = computed(() => {
  if (!selectedDate.value) return ''
  const year = selectedDate.value.getFullYear()
  const month = selectedDate.value.getMonth() + 1
  const day = selectedDate.value.getDate()
  return `${year}年${month}月${day}日`
})

// 日历天数（月视图）
const calendarDays = computed(() => {
  const year = currentDate.value.getFullYear()
  const month = currentDate.value.getMonth()
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const firstDayWeek = firstDay.getDay()
  const days = []
  
  // 上个月的日期
  const prevMonthLastDay = new Date(year, month, 0).getDate()
  for (let i = firstDayWeek - 1; i >= 0; i--) {
    days.push(new Date(year, month - 1, prevMonthLastDay - i))
  }
  
  // 当前月的日期
  for (let i = 1; i <= lastDay.getDate(); i++) {
    days.push(new Date(year, month, i))
  }
  
  // 下个月的日期（补齐42天）
  const remainingDays = 42 - days.length
  for (let i = 1; i <= remainingDays; i++) {
    days.push(new Date(year, month + 1, i))
  }
  
  return days
})

// 周视图的日期
const weekDays = computed(() => {
  const year = currentDate.value.getFullYear()
  const month = currentDate.value.getMonth()
  const date = currentDate.value.getDate()
  const day = currentDate.value.getDay()
  
  const weekStart = new Date(year, month, date - day)
  const days = []
  
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart)
    d.setDate(weekStart.getDate() + i)
    days.push(d)
  }
  
  return days
})

// 选中日期的任务
const selectedDayTasks = computed(() => {
  if (!selectedDate.value) return []
  return getDayTasks(selectedDate.value)
})

// 获取标签列表
const fetchTags = async () => {
  try {
    const data = await getTagList()
    tags.value = data
  } catch (error) {
    console.error('获取标签列表失败：', error)
  }
}

// 获取推送任务列表
const fetchPushTasks = async () => {
  loading.value = true
  try {
    // 获取所有推送任务（不分页）
    const data = await getPushTaskList({ page: 1, limit: 1000 })
    pushTasks.value = data.list || []
  } catch (error) {
    console.error('获取推送任务列表失败：', error)
  } finally {
    loading.value = false
  }
}

// 获取某天的任务
const getDayTasks = (date) => {
  if (!date || !pushTasks.value) return []
  
  const dateStr = formatDate(date)
  return pushTasks.value.filter(task => {
    if (task.push_type === 1) {
      // 立即推送，使用创建时间
      return formatDate(new Date(task.created_at)) === dateStr
    } else {
      // 定时推送，使用推送时间
      return task.push_time && formatDate(new Date(task.push_time)) === dateStr
    }
  })
}

// 获取某小时的任务（周视图）
const getHourTasks = (date, hour) => {
  const dayTasks = getDayTasks(date)
  return dayTasks.filter(task => {
    if (task.push_type === 1) return false
    if (!task.push_time) return false
    const taskDate = new Date(task.push_time)
    return taskDate.getHours() === hour
  })
}

// 格式化日期
const formatDate = (date) => {
  if (!date) return ''
  const d = new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// 格式化时间
const formatTime = (timeStr) => {
  if (!timeStr) return ''
  const date = new Date(timeStr)
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

// 获取星期名称
const getDayName = (date) => {
  return weekdays[date.getDay()]
}

// 判断是否是今天
const isToday = (date) => {
  const today = new Date()
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  )
}

// 判断是否是当前月
const isCurrentMonth = (date) => {
  return (
    date.getFullYear() === currentDate.value.getFullYear() &&
    date.getMonth() === currentDate.value.getMonth()
  )
}

// 获取任务状态文本
const getTaskStatusText = (status) => {
  const statusMap = {
    0: '待推送',
    1: '已推送',
    2: '已取消'
  }
  return statusMap[status] || '未知'
}

// 获取任务状态类型
const getTaskStatusType = (status) => {
  const typeMap = {
    0: 'info',
    1: 'success',
    2: 'warning'
  }
  return typeMap[status] || 'info'
}

// 获取标签名称
const getTagName = (tagId) => {
  const tag = tags.value.find(t => t.id === tagId)
  return tag ? tag.tag_name : `标签${tagId}`
}

// 上个月
const handlePrevMonth = () => {
  const newDate = new Date(currentDate.value)
  newDate.setMonth(newDate.getMonth() - 1)
  currentDate.value = newDate
}

// 下个月
const handleNextMonth = () => {
  const newDate = new Date(currentDate.value)
  newDate.setMonth(newDate.getMonth() + 1)
  currentDate.value = newDate
}

// 今天
const handleToday = () => {
  currentDate.value = new Date()
}

// 视图模式切换
const handleViewModeChange = () => {
  // 可以在这里添加其他逻辑
}

// 日期点击
const handleDayClick = (date) => {
  selectedDate.value = date
  const tasks = getDayTasks(date)
  if (tasks.length > 0) {
    dayDialogVisible.value = true
  } else {
    ElMessage.info('该日期没有推送任务')
  }
}

// 任务点击
const handleTaskClick = async (task) => {
  try {
    const data = await getPushTaskDetail(task.id)
    selectedTask.value = data
    taskDialogVisible.value = true
  } catch (error) {
    console.error('获取推送任务详情失败：', error)
  }
}

// 查看任务详情
const handleViewTaskDetail = async (id) => {
  dayDialogVisible.value = false
  try {
    const data = await getPushTaskDetail(id)
    selectedTask.value = data
    taskDialogVisible.value = true
  } catch (error) {
    console.error('获取推送任务详情失败：', error)
  }
}

// 取消任务
const handleCancelTask = async (task) => {
  try {
    await ElMessageBox.confirm(
      `确定要取消推送任务吗？`,
      '提示',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    await cancelPushTask(task.id)
    ElMessage.success('取消推送成功')
    fetchPushTasks()
    dayDialogVisible.value = false
  } catch (error) {
    if (error !== 'cancel') {
      console.error('取消推送失败：', error)
    }
  }
}

// 新增推送
const handleAddPush = () => {
  router.push('/content/push')
}

// 初始化
onMounted(() => {
  fetchTags()
  fetchPushTasks()
})
</script>

<style scoped>
.content-calendar-container {
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

.toolbar-card {
  margin-bottom: 20px;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 20px;
}

.current-date {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

/* 月视图样式 */
.month-view {
  width: 100%;
}

.weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 1px;
  background: #ebeef5;
  border: 1px solid #ebeef5;
}

.weekday {
  padding: 12px;
  text-align: center;
  background: #f5f7fa;
  font-weight: 600;
  color: #606266;
}

.days-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 1px;
  background: #ebeef5;
  border: 1px solid #ebeef5;
  border-top: none;
}

.day-cell {
  min-height: 120px;
  padding: 8px;
  background: #fff;
  cursor: pointer;
  transition: background-color 0.2s;
}

.day-cell:hover {
  background: #f5f7fa;
}

.day-cell.is-today {
  background: #ecf5ff;
}

.day-cell.is-other-month {
  background: #fafafa;
  color: #c0c4cc;
}

.day-cell.has-tasks {
  border-left: 3px solid #409eff;
}

.day-number {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 4px;
}

.day-tasks {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.task-tag {
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.more-tasks {
  font-size: 12px;
  color: #909399;
}

/* 周视图样式 */
.week-view {
  width: 100%;
}

.week-header {
  display: grid;
  grid-template-columns: 80px repeat(7, 1fr);
  gap: 1px;
  background: #ebeef5;
  border: 1px solid #ebeef5;
}

.day-column {
  padding: 12px;
  text-align: center;
  background: #f5f7fa;
  border-right: 1px solid #ebeef5;
}

.day-column.is-today {
  background: #ecf5ff;
}

.day-header {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.day-name {
  font-weight: 600;
  color: #606266;
}

.day-date {
  font-size: 12px;
  color: #909399;
}

.week-body {
  display: grid;
  grid-template-columns: 80px repeat(7, 1fr);
  gap: 1px;
  background: #ebeef5;
  border: 1px solid #ebeef5;
  border-top: none;
  max-height: 600px;
  overflow-y: auto;
}

.time-column {
  background: #f5f7fa;
  border-right: 1px solid #ebeef5;
}

.time-slot {
  height: 60px;
  padding: 4px 8px;
  border-bottom: 1px solid #ebeef5;
  font-size: 12px;
  color: #909399;
  position: relative;
}

.day-column .time-slot {
  background: #fff;
  position: relative;
}

.task-item {
  position: absolute;
  left: 2px;
  right: 2px;
  padding: 4px 8px;
  background: #409eff;
  color: #fff;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  overflow: hidden;
  z-index: 1;
}

.task-item.status-0 {
  background: #909399;
}

.task-item.status-1 {
  background: #67c23a;
}

.task-item.status-2 {
  background: #e6a23c;
}

.task-title {
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-time {
  font-size: 11px;
  opacity: 0.9;
  margin-top: 2px;
}

.task-detail {
  padding: 10px 0;
}
</style>

