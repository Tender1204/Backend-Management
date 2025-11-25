<template>
  <div class="report-manage-container">
    <div class="page-header">
      <h2>AI报告管理</h2>
      <p class="page-desc">管理用户健康周报和月报，支持批量生成和导出</p>
    </div>

    <!-- 顶部操作栏 -->
    <el-card class="action-card">
      <div class="action-bar">
        <div class="filters">
          <el-select v-model="reportType" placeholder="报告类型" style="width: 150px" @change="handleQuery">
            <el-option label="周报" value="week" />
            <el-option label="月报" value="month" />
          </el-select>
          <el-select v-model="reportPeriod" placeholder="周期筛选" style="width: 200px; margin-left: 10px" @change="handleQuery">
            <el-option
              v-for="period in periods"
              :key="period"
              :label="period"
              :value="period"
            />
          </el-select>
          <el-select v-model="selectedTag" placeholder="用户标签" clearable style="width: 200px; margin-left: 10px" @change="handleQuery">
            <el-option label="全部用户" value="" />
            <el-option label="VIP用户" value="1" />
            <el-option label="普通用户" value="2" />
          </el-select>
        </div>
        <div class="actions">
          <el-button type="primary" @click="showBatchGenerateDialog" icon="Plus">批量生成</el-button>
          <el-button @click="handleExport" icon="Download">导出</el-button>
        </div>
      </div>
    </el-card>

    <!-- 报告列表 -->
    <el-card class="report-list-card">
      <el-table :data="reportList" stripe v-loading="loading">
        <el-table-column prop="userId" label="用户ID" width="100" />
        <el-table-column prop="userName" label="用户姓名" width="120" />
        <el-table-column prop="reportPeriod" label="报告周期" width="150" />
        <el-table-column prop="generateTime" label="生成时间" width="180" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.isRead ? 'success' : 'info'">
              {{ row.isRead ? '已读' : '未读' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="250" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="viewReport(row)">查看</el-button>
            <el-button link type="primary" @click="downloadReport(row)">下载</el-button>
            <el-button link type="primary" @click="regenerateReport(row)">重新生成</el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pagination" style="margin-top: 20px">
        <el-pagination
          v-model:current-page="pageNum"
          v-model:page-size="pageSize"
          :total="total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleQuery"
          @current-change="handleQuery"
        />
      </div>
    </el-card>

    <!-- 报告详情弹窗 -->
    <el-dialog v-model="reportDetailVisible" title="报告详情" width="1000px" fullscreen>
      <div v-if="selectedReport" class="report-detail">
        <div class="report-header">
          <h3>{{ reportTitle }}</h3>
          <div class="report-meta">
            <span>生成时间：{{ selectedReport.generateTime }}</span>
            <span>模板名称：{{ selectedReport.templateName || '通用模板' }}</span>
          </div>
        </div>

        <div class="report-content">
          <!-- 数据概览卡片 -->
          <el-card class="report-section">
            <template #header>数据概览</template>
            <div class="overview-grid">
              <div v-for="(value, key) in reportData.statistics" :key="key" class="overview-item">
                <div class="overview-label">{{ key }}</div>
                <div class="overview-value">{{ value.value }}</div>
                <el-tag :type="value.status === '达标' ? 'success' : value.status === '未达标' ? 'warning' : 'danger'" size="small">
                  {{ value.status }}
                </el-tag>
              </div>
            </div>
          </el-card>

          <!-- 可视化图表区域 -->
          <el-row :gutter="20" class="charts-row">
            <el-col :span="12">
              <el-card class="report-section">
                <template #header>指标达标率</template>
                <ECharts :option="complianceChartOption" style="height: 300px" />
              </el-card>
            </el-col>
            <el-col :span="12">
              <el-card class="report-section">
                <template #header>趋势分析</template>
                <ECharts :option="trendChartOption" style="height: 300px" />
              </el-card>
            </el-col>
          </el-row>

          <el-row :gutter="20" class="charts-row">
            <el-col :span="24">
              <el-card class="report-section">
                <template #header>每日数据趋势</template>
                <ECharts :option="dailyTrendChartOption" style="height: 350px" />
              </el-card>
            </el-col>
          </el-row>

          <!-- 模型分析区域 -->
          <el-card class="report-section">
            <template #header>模型分析</template>
            <div class="analysis-content">
              <div v-for="(value, key) in reportData.analysis" :key="key" class="analysis-item">
                <div class="analysis-label">{{ key }}：</div>
                <div class="analysis-text">{{ value }}</div>
              </div>
            </div>
          </el-card>

          <!-- 健康建议区域 -->
          <el-card class="report-section">
            <template #header>健康建议</template>
            <ul class="suggestions-list">
              <li v-for="(suggestion, index) in reportData.suggestions" :key="index">
                <el-icon class="suggestion-icon"><Check /></el-icon>
                {{ suggestion }}
              </li>
            </ul>
          </el-card>
        </div>

        <div class="report-actions">
          <el-button type="primary" @click="downloadReport(selectedReport)" icon="Download">下载PDF</el-button>
          <el-button @click="markAsRead" icon="Check">标记已读</el-button>
          <el-button @click="reportDetailVisible = false">关闭</el-button>
        </div>
      </div>
    </el-dialog>

    <!-- 批量生成弹窗 -->
    <el-dialog v-model="batchGenerateVisible" title="批量生成报告" width="500px">
      <el-form :model="batchForm" label-width="100px">
        <el-form-item label="报告类型" required>
          <el-select v-model="batchForm.reportType" style="width: 100%">
            <el-option label="周报" value="week" />
            <el-option label="月报" value="month" />
          </el-select>
        </el-form-item>
        <el-form-item label="报告周期" required>
          <el-input v-model="batchForm.reportPeriod" placeholder="如：2024-10 第1周" />
        </el-form-item>
        <el-form-item label="用户标签">
          <el-select v-model="batchForm.tagId" placeholder="选择标签" clearable style="width: 100%">
            <el-option label="全部用户" value="" />
            <el-option label="VIP用户" value="1" />
            <el-option label="普通用户" value="2" />
          </el-select>
        </el-form-item>
      </el-form>

      <div v-if="batchProgress.visible" class="batch-progress">
        <el-progress :percentage="batchProgress.percentage" :status="batchProgress.status" />
        <div class="progress-info">
          <span>成功：{{ batchProgress.successCount }}</span>
          <span>失败：{{ batchProgress.failCount }}</span>
        </div>
      </div>

      <template #footer>
        <el-button @click="batchGenerateVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmBatchGenerate" :loading="batchProgress.visible">
          确认生成
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Check } from '@element-plus/icons-vue'
import { generateReport } from '@/api/ai'
import ECharts from '@/components/ECharts.vue'

const loading = ref(false)
const reportType = ref('week')
const reportPeriod = ref('')
const selectedTag = ref('')
const reportList = ref([])
const pageNum = ref(1)
const pageSize = ref(10)
const total = ref(0)

const reportDetailVisible = ref(false)
const selectedReport = ref(null)
const reportData = ref({
  statistics: {},
  analysis: {},
  suggestions: []
})

const batchGenerateVisible = ref(false)
const batchForm = ref({
  reportType: 'week',
  reportPeriod: '',
  tagId: ''
})
const batchProgress = ref({
  visible: false,
  percentage: 0,
  status: '',
  successCount: 0,
  failCount: 0
})

// 生成周期列表
const periods = computed(() => {
  const list = []
  const now = new Date()
  for (let i = 0; i < 12; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    if (reportType.value === 'week') {
      // 生成周报周期
      for (let week = 1; week <= 4; week++) {
        list.push(`${year}-${month} 第${week}周`)
      }
    } else {
      list.push(`${year}-${month}`)
    }
  }
  return list
})

const reportTitle = computed(() => {
  if (!selectedReport.value) return ''
  return `${selectedReport.value.reportPeriod}健康${reportType.value === 'week' ? '周' : '月'}报`
})

// 图表配置
const complianceChartOption = computed(() => {
  const stats = reportData.value.statistics || {}
  const categories = Object.keys(stats)
  const data = categories.map(key => {
    const value = stats[key]
    const numValue = parseFloat(value.value) || 0
    return {
      name: key,
      value: numValue
    }
  })

  return {
    tooltip: {
      trigger: 'item',
      formatter: '{a} <br/>{b}: {c} ({d}%)'
    },
    legend: {
      orient: 'vertical',
      left: 'left'
    },
    series: [
      {
        name: '达标率',
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 10,
          borderColor: '#fff',
          borderWidth: 2
        },
        label: {
          show: true,
          formatter: '{b}: {c}%'
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 16,
            fontWeight: 'bold'
          }
        },
        data: data
      }
    ]
  }
})

const trendChartOption = computed(() => {
  const stats = reportData.value.statistics || {}
  const categories = Object.keys(stats)
  const values = categories.map(key => {
    const value = stats[key]
    return parseFloat(value.value) || 0
  })

  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow'
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: categories,
      axisLabel: {
        rotate: 45
      }
    },
    yAxis: {
      type: 'value',
      name: '数值'
    },
    series: [
      {
        name: '指标值',
        type: 'bar',
        data: values,
        itemStyle: {
          color: function(params) {
            const colors = ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272']
            return colors[params.dataIndex % colors.length]
          }
        },
        label: {
          show: true,
          position: 'top'
        }
      }
    ]
  }
})

const dailyTrendChartOption = computed(() => {
  // 模拟7天或30天的数据
  const days = reportType.value === 'week' ? 7 : 30
  const dates = []
  const stepData = []
  const sleepData = []
  const waterData = []

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    dates.push(`${date.getMonth() + 1}/${date.getDate()}`)
    stepData.push(Math.floor(Math.random() * 5000) + 5000)
    sleepData.push((Math.random() * 3 + 6).toFixed(1))
    waterData.push(Math.floor(Math.random() * 1000) + 1000)
  }

  return {
    tooltip: {
      trigger: 'axis'
    },
    legend: {
      data: ['步数', '睡眠时长(小时)', '饮水量(ml)']
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: dates
    },
    yAxis: [
      {
        type: 'value',
        name: '步数/饮水量',
        position: 'left'
      },
      {
        type: 'value',
        name: '睡眠时长',
        position: 'right'
      }
    ],
    series: [
      {
        name: '步数',
        type: 'line',
        data: stepData,
        smooth: true,
        itemStyle: { color: '#5470c6' }
      },
      {
        name: '睡眠时长(小时)',
        type: 'line',
        yAxisIndex: 1,
        data: sleepData,
        smooth: true,
        itemStyle: { color: '#91cc75' }
      },
      {
        name: '饮水量(ml)',
        type: 'line',
        data: waterData,
        smooth: true,
        itemStyle: { color: '#fac858' }
      }
    ]
  }
})

// 查询报告列表
const handleQuery = async () => {
  try {
    loading.value = true
    // 这里调用接口查询报告列表
    // 模拟数据
    reportList.value = [
      {
        reportId: 1,
        userId: 1001,
        userName: '张三',
        reportPeriod: '2024-10 第1周',
        generateTime: '2024-10-07 10:00:00',
        isRead: 0,
        templateName: '通用健康周报'
      }
    ]
    total.value = 1
  } catch (error) {
    console.error('查询失败：', error)
    ElMessage.error('查询失败')
  } finally {
    loading.value = false
  }
}

// 查看报告
const viewReport = (row) => {
  selectedReport.value = row
  // 解析报告内容
  if (row.reportContent) {
    reportData.value = typeof row.reportContent === 'string'
      ? JSON.parse(row.reportContent)
      : row.reportContent
  } else {
    // 模拟数据（更丰富的数据）
    reportData.value = {
      statistics: {
        '步数达标率': { value: '75', status: '未达标' },
        '睡眠时长': { value: '6.5', status: '未达标' },
        '饮水量达标率': { value: '80', status: '未达标' },
        '运动频率': { value: '4', status: '达标' },
        '体重变化': { value: '-0.5', status: '达标' },
        '心率平均值': { value: '72', status: '达标' }
      },
      analysis: {
        '趋势分析': '本周数据较上周有所下降，步数和睡眠时长均未达到目标，需要加强运动并调整作息',
        '状态分类': '整体健康状态良好，但运动量不足，睡眠质量有待提升',
        '与上周对比': '步数下降15%，睡眠时长减少0.5小时，饮水量基本持平',
        '健康评分': '综合评分72分，属于良好水平，建议继续保持并逐步改善'
      },
      suggestions: [
        '建议增加30分钟快走，逐步提升至10000步目标，可分早晚两次完成',
        '建议调整作息时间，保证7-9小时充足睡眠，睡前1小时避免使用电子设备',
        '建议每天分多次少量饮水，总量达到2000ml，可在餐前30分钟适量饮水',
        '建议每周至少进行3-4次有氧运动，每次30分钟以上，可结合力量训练'
      ]
    }
  }
  reportDetailVisible.value = true
}

// 下载报告
const downloadReport = (row) => {
  ElMessage.success('下载功能开发中')
}

// 重新生成报告
const regenerateReport = async (row) => {
  try {
    await ElMessageBox.confirm('确定要重新生成该报告吗？', '确认操作', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })

    await generateReport({
      userId: row.userId,
      reportType: reportType.value,
      reportPeriod: row.reportPeriod
    })

    ElMessage.success('重新生成成功')
    handleQuery()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('重新生成失败：', error)
      ElMessage.error('重新生成失败')
    }
  }
}

// 显示批量生成弹窗
const showBatchGenerateDialog = () => {
  batchForm.value = {
    reportType: reportType.value,
    reportPeriod: reportPeriod.value || periods.value[0],
    tagId: selectedTag.value || ''
  }
  batchGenerateVisible.value = true
}

// 确认批量生成
const confirmBatchGenerate = async () => {
  try {
    if (!batchForm.value.reportPeriod) {
      ElMessage.warning('请选择报告周期')
      return
    }

    batchProgress.value = {
      visible: true,
      percentage: 0,
      status: '',
      successCount: 0,
      failCount: 0
    }

    // 模拟进度更新
    const interval = setInterval(() => {
      if (batchProgress.value.percentage < 90) {
        batchProgress.value.percentage += 10
      }
    }, 500)

    const result = await generateReport({
      tagId: batchForm.value.tagId || undefined,
      reportType: batchForm.value.reportType,
      reportPeriod: batchForm.value.reportPeriod
    })

    clearInterval(interval)
    batchProgress.value.percentage = 100
    batchProgress.value.status = 'success'
    batchProgress.value.successCount = result.successCount || 0
    batchProgress.value.failCount = result.failCount || 0

    setTimeout(() => {
      batchGenerateVisible.value = false
      batchProgress.value.visible = false
      ElMessage.success(`批量生成完成：成功${result.successCount}条，失败${result.failCount}条`)
      handleQuery()
    }, 2000)

  } catch (error) {
    console.error('批量生成失败：', error)
    ElMessage.error('批量生成失败')
    batchProgress.value.status = 'exception'
  }
}

// 导出报告
const handleExport = () => {
  ElMessage.success('导出功能开发中')
}

// 标记已读
const markAsRead = async () => {
  try {
    // 这里调用接口标记已读
    ElMessage.success('标记成功')
    selectedReport.value.isRead = 1
    handleQuery()
  } catch (error) {
    console.error('标记失败：', error)
    ElMessage.error('标记失败')
  }
}

onMounted(() => {
  handleQuery()
})
</script>

<style scoped>
.report-manage-container {
  padding: 20px;
  background: #f5f7fa;
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
}

.page-desc {
  margin: 0;
  color: #909399;
  font-size: 14px;
}

.action-card {
  margin-bottom: 20px;
}

.action-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.filters {
  display: flex;
  align-items: center;
}

.actions {
  display: flex;
  gap: 10px;
}

.report-list-card {
  margin-top: 20px;
}

.report-detail {
  padding: 20px;
}

.report-header {
  margin-bottom: 30px;
  padding-bottom: 20px;
  border-bottom: 1px solid #ebeef5;
}

.report-header h3 {
  margin: 0 0 10px 0;
  font-size: 24px;
  color: #303133;
}

.report-meta {
  display: flex;
  gap: 20px;
  color: #909399;
  font-size: 14px;
}

.report-content {
  margin-bottom: 30px;
}

.report-section {
  margin-bottom: 20px;
}

.overview-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}

.overview-item {
  text-align: center;
  padding: 20px;
  background: linear-gradient(135deg, #f5f7fa 0%, #e9ecef 100%);
  border-radius: 8px;
  border: 1px solid #e4e7ed;
  transition: all 0.3s;
}

.overview-item:hover {
  transform: translateY(-5px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.overview-label {
  color: #909399;
  font-size: 14px;
  margin-bottom: 10px;
}

.overview-value {
  color: #303133;
  font-size: 28px;
  font-weight: 600;
  margin-bottom: 10px;
}

.charts-row {
  margin-bottom: 20px;
}

.analysis-content {
  padding: 10px;
}

.analysis-item {
  margin-bottom: 15px;
  display: flex;
}

.analysis-label {
  font-weight: 600;
  color: #303133;
  min-width: 100px;
}

.analysis-text {
  color: #606266;
  flex: 1;
}

.suggestions-list {
  padding-left: 0;
  color: #606266;
  line-height: 2;
  list-style: none;
}

.suggestions-list li {
  margin-bottom: 15px;
  padding: 12px;
  background: #f0f9ff;
  border-left: 4px solid #409eff;
  border-radius: 4px;
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.suggestion-icon {
  color: #409eff;
  margin-top: 4px;
  flex-shrink: 0;
}

.report-actions {
  display: flex;
  justify-content: center;
  gap: 10px;
  padding-top: 20px;
  border-top: 1px solid #ebeef5;
}

.batch-progress {
  margin-top: 20px;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  margin-top: 10px;
  color: #606266;
  font-size: 14px;
}
</style>

