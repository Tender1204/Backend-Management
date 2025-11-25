<template>
  <div class="user-dimension-container">
    <div class="page-header">
      <h2>用户维度分析</h2>
      <p class="page-desc">按标签（性别/年龄/健康状态）拆分健康数据（平均步数/睡眠时长等）</p>
    </div>

    <!-- 筛选器 -->
    <el-card class="filter-card">
      <div class="filter-row">
        <div class="filter-item">
          <span class="filter-label">维度选择：</span>
          <el-radio-group v-model="dimension" @change="handleDimensionChange" size="default">
            <el-radio-button label="gender">性别</el-radio-button>
            <el-radio-button label="age">年龄</el-radio-button>
            <el-radio-button label="healthStatus">健康状态</el-radio-button>
          </el-radio-group>
        </div>
        <div class="filter-item">
          <span class="filter-label">统计周期：</span>
          <el-radio-group v-model="period" @change="handlePeriodChange" size="default">
            <el-radio-button label="day">最近7天</el-radio-button>
            <el-radio-button label="week">最近4周</el-radio-button>
            <el-radio-button label="month">最近3个月</el-radio-button>
          </el-radio-group>
        </div>
        <div class="filter-item">
          <el-button type="primary" :icon="Refresh" @click="loadData" :loading="loading">
            刷新数据
          </el-button>
          <el-button type="success" :icon="Download" @click="exportExcel">
            导出Excel
          </el-button>
        </div>
      </div>
    </el-card>

    <!-- 对比柱状图 -->
    <el-card class="chart-card">
      <div class="chart-header">
        <div class="chart-title">
          <el-icon class="chart-icon"><DataAnalysis /></el-icon>
          <h3>数据对比图</h3>
        </div>
        <el-button 
          type="text" 
          :icon="Download" 
          @click="downloadChart"
          size="small"
          class="download-btn"
        >
          下载PNG
        </el-button>
      </div>
      <div class="chart-content">
        <ECharts 
          ref="chartRef"
          :option="chartOption"
          height="500px"
        />
      </div>
    </el-card>

    <!-- 数据表格 -->
    <el-card class="table-card">
      <div class="table-header">
        <h3>数据明细</h3>
        <el-button type="text" :icon="Download" @click="exportExcel" size="small">
          导出Excel
        </el-button>
      </div>
      <el-table 
        :data="tableData" 
        border 
        stripe
        v-loading="loading"
        style="width: 100%"
      >
        <el-table-column prop="category" label="分类" width="150" align="center" />
        <el-table-column prop="userCount" label="用户数" align="center">
          <template #default="{ row }">
            {{ formatValue(row.userCount, '人') }}
          </template>
        </el-table-column>
        <el-table-column prop="avgSteps" label="平均步数" align="center">
          <template #default="{ row }">
            {{ formatValue(row.avgSteps, '步') }}
          </template>
        </el-table-column>
        <el-table-column prop="avgSleepHours" label="平均睡眠时长" align="center">
          <template #default="{ row }">
            {{ formatValue(row.avgSleepHours, '小时') }}
          </template>
        </el-table-column>
        <el-table-column prop="avgWaterCount" label="平均饮水量" align="center">
          <template #default="{ row }">
            {{ formatValue(row.avgWaterCount, '次') }}
          </template>
        </el-table-column>
        <el-table-column prop="avgCompletionRate" label="平均完成率" align="center">
          <template #default="{ row }">
            <el-progress 
              :percentage="parseFloat(row.avgCompletionRate)" 
              :color="getProgressColor(parseFloat(row.avgCompletionRate))"
              :stroke-width="8"
              :show-text="true"
            />
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Refresh, Download, DataAnalysis } from '@element-plus/icons-vue'
import { getUserDimension } from '@/api/stat'
import ECharts from '@/components/ECharts.vue'
import * as XLSX from 'xlsx'

const dimension = ref('gender')
const period = ref('month')
const loading = ref(false)
const chartRef = ref(null)
const chartData = ref(null)

// 图表配置
const chartOption = computed(() => {
  if (!chartData.value || !chartData.value.categories || chartData.value.categories.length === 0) {
    return {
      title: {
        text: '暂无数据',
        left: 'center',
        top: 'middle',
        textStyle: { color: '#999' }
      }
    }
  }

  const { categories, data } = chartData.value

  return {
    title: {
      text: '用户维度数据对比',
      left: 'center',
      textStyle: { fontSize: 16, fontWeight: 'bold' }
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' }
    },
    legend: {
      data: ['平均步数', '平均睡眠时长(小时)', '平均饮水量', '平均完成率(%)'],
      top: 30,
      left: 'center'
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: '15%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: categories,
      axisLabel: {
        rotate: categories.length > 5 ? 45 : 0
      }
    },
    yAxis: [
      {
        type: 'value',
        name: '步数/饮水量',
        position: 'left',
        axisLabel: {
          formatter: '{value}'
        }
      },
      {
        type: 'value',
        name: '完成率(%)',
        position: 'right',
        axisLabel: {
          formatter: '{value}%'
        }
      }
    ],
    series: [
      {
        name: '平均步数',
        type: 'bar',
        data: data.avgSteps,
        itemStyle: { color: '#5470c6' }
      },
      {
        name: '平均睡眠时长(小时)',
        type: 'bar',
        data: data.avgSleepHours.map(h => parseFloat(h)),
        itemStyle: { color: '#91cc75' }
      },
      {
        name: '平均饮水量',
        type: 'bar',
        data: data.avgWaterCount,
        itemStyle: { color: '#fac858' }
      },
      {
        name: '平均完成率(%)',
        type: 'line',
        yAxisIndex: 1,
        data: data.avgCompletionRate,
        itemStyle: { color: '#ee6666' },
        lineStyle: { width: 3 }
      }
    ]
  }
})

// 表格数据
const tableData = computed(() => {
  if (!chartData.value || !chartData.value.categories) return []
  
  const { categories, data } = chartData.value
  return categories.map((category, index) => ({
    category,
    userCount: data.userCount[index] || 0,
    avgSteps: data.avgSteps[index] || 0,
    avgSleepHours: parseFloat(data.avgSleepHours[index]) || 0,
    avgWaterCount: data.avgWaterCount[index] || 0,
    avgCompletionRate: data.avgCompletionRate[index] || 0
  }))
})

// 加载数据
const loadData = async () => {
  loading.value = true
  try {
    const data = await getUserDimension(dimension.value, period.value)
    // 响应拦截器已经处理了返回格式，直接使用data
    chartData.value = data
  } catch (error) {
    console.error('加载数据失败：', error)
    ElMessage.error(error.message || '加载数据失败')
  } finally {
    loading.value = false
  }
}

// 维度切换
const handleDimensionChange = () => {
  loadData()
}

// 周期切换
const handlePeriodChange = () => {
  loadData()
}

// 下载图表PNG
const downloadChart = () => {
  if (!chartRef.value) return
  
  try {
    const url = chartRef.value.downloadChart()
    if (url) {
      const link = document.createElement('a')
      link.href = url
      link.download = `用户维度分析_${dimension.value}_${new Date().getTime()}.png`
      link.click()
      ElMessage.success('图表下载成功')
    }
  } catch (error) {
    console.error('下载图表失败：', error)
    ElMessage.error('下载图表失败')
  }
}

// 导出Excel
const exportExcel = () => {
  if (!chartData.value || tableData.value.length === 0) {
    ElMessage.warning('暂无数据可导出')
    return
  }

  try {
    // 准备Excel数据
    const headers = ['分类', '用户数', '平均步数', '平均睡眠时长(小时)', '平均饮水量', '平均完成率(%)']
    const rows = tableData.value.map(row => [
      row.category,
      row.userCount,
      row.avgSteps,
      row.avgSleepHours,
      row.avgWaterCount,
      row.avgCompletionRate.toFixed(2)
    ])

    const wsData = [headers, ...rows]
    const ws = XLSX.utils.aoa_to_sheet(wsData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '用户维度分析')

    // 设置列宽
    ws['!cols'] = [
      { wch: 15 },
      { wch: 12 },
      { wch: 12 },
      { wch: 18 },
      { wch: 15 },
      { wch: 15 }
    ]

    // 导出文件
    const dimensionName = {
      gender: '性别',
      age: '年龄',
      healthStatus: '健康状态'
    }[dimension.value]
    const fileName = `用户维度分析_${dimensionName}_${new Date().toISOString().slice(0, 10)}.xlsx`
    XLSX.writeFile(wb, fileName)
    ElMessage.success('Excel导出成功')
  } catch (error) {
    console.error('导出Excel失败：', error)
    ElMessage.error('导出Excel失败，请检查是否安装了xlsx库')
  }
}

// 格式化数值
const formatValue = (value, unit) => {
  if (value === null || value === undefined) return '-'
  if (typeof value === 'string' && value.includes('.')) {
    return `${parseFloat(value).toFixed(1)}${unit}`
  }
  return `${value}${unit}`
}

// 获取进度条颜色
const getProgressColor = (percentage) => {
  if (percentage >= 80) return '#67c23a'
  if (percentage >= 60) return '#e6a23c'
  return '#f56c6c'
}

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.user-dimension-container {
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

.filter-card {
  margin-bottom: 20px;
}

.filter-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 20px;
}

.filter-item {
  display: flex;
  align-items: center;
  gap: 10px;
}

.filter-label {
  font-size: 14px;
  color: #606266;
  white-space: nowrap;
}

.chart-card,
.table-card {
  margin-bottom: 20px;
}

.chart-header,
.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.chart-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.chart-title h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.chart-icon {
  font-size: 20px;
  color: #409eff;
}

.download-btn {
  color: #409eff;
}

.chart-content {
  padding: 10px 0;
}

.table-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}
</style>

