<template>
  <div class="function-usage-container">
    <div class="page-header">
      <h2>功能使用分析</h2>
      <p class="page-desc">查询各功能（提醒/AI问答/数据记录）的使用率、留存率</p>
    </div>

    <!-- 筛选器 -->
    <el-card class="filter-card">
      <div class="filter-row">
        <div class="filter-item">
          <span class="filter-label">功能选择：</span>
          <el-radio-group v-model="functionName" @change="handleFunctionChange" size="default">
            <el-radio-button label="all">全部功能</el-radio-button>
            <el-radio-button label="reminder">提醒功能</el-radio-button>
            <el-radio-button label="aiQa">AI问答</el-radio-button>
            <el-radio-button label="dataRecord">数据记录</el-radio-button>
          </el-radio-group>
        </div>
        <div class="filter-item">
          <span class="filter-label">统计周期：</span>
          <el-radio-group v-model="period" @change="handlePeriodChange" size="default">
            <el-radio-button label="day">按日</el-radio-button>
            <el-radio-button label="week">按周</el-radio-button>
            <el-radio-button label="month">按月</el-radio-button>
          </el-radio-group>
        </div>
        <div class="filter-item">
          <el-button type="primary" :icon="Refresh" @click="loadData" :loading="loading">
            刷新数据
          </el-button>
        </div>
      </div>
    </el-card>

    <!-- 图表区域 -->
    <div class="charts-row">
      <!-- 使用率饼图 -->
      <el-card class="chart-card pie-chart">
        <div class="chart-header">
          <div class="chart-title">
            <el-icon class="chart-icon"><DataAnalysis /></el-icon>
            <h3>功能使用率</h3>
          </div>
          <el-button 
            type="text" 
            :icon="Download" 
            @click="downloadPieChart"
            size="small"
            class="download-btn"
          >
            下载PNG
          </el-button>
        </div>
        <div class="chart-content">
          <ECharts 
            ref="pieChartRef"
            :option="pieChartOption"
            height="400px"
          />
        </div>
      </el-card>

      <!-- 留存率折线图 -->
      <el-card class="chart-card line-chart">
        <div class="chart-header">
          <div class="chart-title">
            <el-icon class="chart-icon"><DataAnalysis /></el-icon>
            <h3>留存率趋势</h3>
          </div>
          <el-button 
            type="text" 
            :icon="Download" 
            @click="downloadLineChart"
            size="small"
            class="download-btn"
          >
            下载PNG
          </el-button>
        </div>
        <div class="chart-content">
          <ECharts 
            ref="lineChartRef"
            :option="lineChartOption"
            height="400px"
          />
        </div>
      </el-card>
    </div>

    <!-- 数据表格 -->
    <el-card class="table-card">
      <div class="table-header">
        <h3>使用率数据</h3>
      </div>
      <el-table 
        :data="usageTableData" 
        border 
        stripe
        v-loading="loading"
        style="width: 100%"
      >
        <el-table-column prop="name" label="功能名称" width="200" align="center" />
        <el-table-column prop="value" label="使用率" align="center">
          <template #default="{ row }">
            <el-progress 
              :percentage="row.value" 
              :color="getProgressColor(row.value)"
              :stroke-width="12"
              :show-text="true"
            />
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="120" align="center">
          <template #default="{ row }">
            <el-tag :type="row.value >= 50 ? 'success' : row.value >= 30 ? 'warning' : 'danger'">
              {{ row.value >= 50 ? '良好' : row.value >= 30 ? '一般' : '待提升' }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 留存率数据表格 -->
    <el-card class="table-card">
      <div class="table-header">
        <h3>留存率趋势数据</h3>
        <el-button type="success" :icon="Download" @click="exportExcel" size="small">
          导出Excel
        </el-button>
      </div>
      <el-table 
        :data="retentionTableData" 
        border 
        stripe
        v-loading="loading"
        style="width: 100%"
      >
        <el-table-column prop="date" label="日期" width="150" align="center" />
        <el-table-column prop="rate" label="留存率" align="center">
          <template #default="{ row }">
            <el-progress 
              :percentage="row.rate" 
              :color="getProgressColor(row.rate)"
              :stroke-width="12"
              :show-text="true"
            />
          </template>
        </el-table-column>
        <el-table-column prop="status" label="趋势" width="120" align="center">
          <template #default="{ row, $index }">
            <el-icon 
              v-if="$index > 0 && row.rate > retentionTableData[$index - 1].rate"
              color="#67c23a"
            >
              <ArrowUp />
            </el-icon>
            <el-icon 
              v-else-if="$index > 0 && row.rate < retentionTableData[$index - 1].rate"
              color="#f56c6c"
            >
              <ArrowDown />
            </el-icon>
            <el-icon v-else color="#909399">
              <Minus />
            </el-icon>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Refresh, Download, DataAnalysis, ArrowUp, ArrowDown, Minus } from '@element-plus/icons-vue'
import { getFunctionUsage } from '@/api/stat'
import ECharts from '@/components/ECharts.vue'
import * as XLSX from 'xlsx'

const functionName = ref('all')
const period = ref('month')
const loading = ref(false)
const pieChartRef = ref(null)
const lineChartRef = ref(null)
const chartData = ref(null)

// 使用率饼图配置
const pieChartOption = computed(() => {
  if (!chartData.value || !chartData.value.usageRate || chartData.value.usageRate.length === 0) {
    return {
      title: {
        text: '暂无数据',
        left: 'center',
        top: 'middle',
        textStyle: { color: '#999' }
      }
    }
  }

  const colors = ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272', '#fc8452', '#9a60b4']
  
  return {
    title: {
      text: '功能使用率占比',
      left: 'center',
      textStyle: { fontSize: 16, fontWeight: 'bold' }
    },
    tooltip: {
      trigger: 'item',
      formatter: '{a} <br/>{b}: {c}% ({d}%)'
    },
    legend: {
      orient: 'vertical',
      left: 'left',
      top: 'middle'
    },
    series: [
      {
        name: '使用率',
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['60%', '50%'],
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
        data: chartData.value.usageRate.map((item, index) => ({
          ...item,
          itemStyle: {
            color: colors[index % colors.length]
          }
        }))
      }
    ]
  }
})

// 留存率折线图配置
const lineChartOption = computed(() => {
  if (!chartData.value || !chartData.value.retentionRate || !chartData.value.retentionRate.dates) {
    return {
      title: {
        text: '暂无数据',
        left: 'center',
        top: 'middle',
        textStyle: { color: '#999' }
      }
    }
  }

  const { dates, rates } = chartData.value.retentionRate

  return {
    title: {
      text: '留存率趋势',
      left: 'center',
      textStyle: { fontSize: 16, fontWeight: 'bold' }
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
      formatter: (params) => {
        const param = params[0]
        return `${param.axisValue}<br/>${param.seriesName}: ${param.value}%`
      }
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
      boundaryGap: false,
      data: dates,
      axisLabel: {
        rotate: period.value === 'day' ? 45 : 0
      }
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        formatter: '{value}%'
      },
      max: 100
    },
    series: [
      {
        name: '留存率',
        type: 'line',
        data: rates,
        smooth: true,
        lineStyle: {
          color: '#5470c6',
          width: 3
        },
        itemStyle: {
          color: '#5470c6'
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: '#5470c680' },
              { offset: 1, color: '#5470c610' }
            ]
          }
        },
        markLine: {
          data: [
            { yAxis: 50, name: '基准线(50%)' },
            { yAxis: 80, name: '目标线(80%)' }
          ],
          lineStyle: {
            color: '#f56c6c',
            type: 'dashed'
          }
        }
      }
    ]
  }
})

// 使用率表格数据
const usageTableData = computed(() => {
  if (!chartData.value || !chartData.value.usageRate) return []
  return chartData.value.usageRate.map(item => ({
    name: item.name,
    value: item.value,
    status: item.value >= 50 ? '良好' : item.value >= 30 ? '一般' : '待提升'
  }))
})

// 留存率表格数据
const retentionTableData = computed(() => {
  if (!chartData.value || !chartData.value.retentionRate) return []
  const { dates, rates } = chartData.value.retentionRate
  return dates.map((date, index) => ({
    date,
    rate: rates[index] || 0
  }))
})

// 加载数据
const loadData = async () => {
  loading.value = true
  try {
    const data = await getFunctionUsage(period.value, functionName.value)
    // 响应拦截器已经处理了返回格式，直接使用data
    chartData.value = data
  } catch (error) {
    console.error('加载数据失败：', error)
    ElMessage.error(error.message || '加载数据失败')
  } finally {
    loading.value = false
  }
}

// 功能切换
const handleFunctionChange = () => {
  loadData()
}

// 周期切换
const handlePeriodChange = () => {
  loadData()
}

// 下载饼图PNG
const downloadPieChart = () => {
  if (!pieChartRef.value) return
  
  try {
    const url = pieChartRef.value.downloadChart()
    if (url) {
      const link = document.createElement('a')
      link.href = url
      link.download = `功能使用率_${functionName.value}_${new Date().getTime()}.png`
      link.click()
      ElMessage.success('图表下载成功')
    }
  } catch (error) {
    console.error('下载图表失败：', error)
    ElMessage.error('下载图表失败')
  }
}

// 下载折线图PNG
const downloadLineChart = () => {
  if (!lineChartRef.value) return
  
  try {
    const url = lineChartRef.value.downloadChart()
    if (url) {
      const link = document.createElement('a')
      link.href = url
      link.download = `留存率趋势_${period.value}_${new Date().getTime()}.png`
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
  if (!chartData.value || retentionTableData.value.length === 0) {
    ElMessage.warning('暂无数据可导出')
    return
  }

  try {
    // 准备Excel数据 - 使用率数据
    const usageHeaders = ['功能名称', '使用率(%)']
    const usageRows = usageTableData.value.map(row => [row.name, row.value])
    
    // 留存率数据
    const retentionHeaders = ['日期', '留存率(%)']
    const retentionRows = retentionTableData.value.map(row => [row.date, row.rate])

    const wb = XLSX.utils.book_new()
    
    // 使用率工作表
    const usageWs = XLSX.utils.aoa_to_sheet([usageHeaders, ...usageRows])
    usageWs['!cols'] = [{ wch: 20 }, { wch: 15 }]
    XLSX.utils.book_append_sheet(wb, usageWs, '使用率数据')
    
    // 留存率工作表
    const retentionWs = XLSX.utils.aoa_to_sheet([retentionHeaders, ...retentionRows])
    retentionWs['!cols'] = [{ wch: 15 }, { wch: 15 }]
    XLSX.utils.book_append_sheet(wb, retentionWs, '留存率趋势')

    // 导出文件
    const functionNameMap = {
      all: '全部功能',
      reminder: '提醒功能',
      aiQa: 'AI问答',
      dataRecord: '数据记录'
    }
    const fileName = `功能使用分析_${functionNameMap[functionName.value]}_${new Date().toISOString().slice(0, 10)}.xlsx`
    XLSX.writeFile(wb, fileName)
    ElMessage.success('Excel导出成功')
  } catch (error) {
    console.error('导出Excel失败：', error)
    ElMessage.error('导出Excel失败，请检查是否安装了xlsx库')
  }
}

// 获取进度条颜色
const getProgressColor = (percentage) => {
  if (percentage >= 80) return '#67c23a'
  if (percentage >= 60) return '#e6a23c'
  if (percentage >= 40) return '#f56c6c'
  return '#909399'
}

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.function-usage-container {
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

.charts-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 20px;
}

.chart-card {
  margin-bottom: 0;
}

.chart-header {
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

.table-card {
  margin-bottom: 20px;
}

.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.table-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

@media (max-width: 1200px) {
  .charts-row {
    grid-template-columns: 1fr;
  }
}
</style>

