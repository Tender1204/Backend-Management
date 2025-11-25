<template>
  <div class="global-indicators-container">
    <div class="page-header">
      <h2>全局指标分析</h2>
      <p class="page-desc">查看总用户数、活跃用户数、AI问答次数等核心指标的趋势数据</p>
    </div>

    <!-- 筛选器 -->
    <el-card class="filter-card">
      <div class="filter-row">
        <div class="filter-item">
          <span class="filter-label">统计周期：</span>
          <el-radio-group v-model="period" @change="handlePeriodChange" size="default">
            <el-radio-button label="day">按日</el-radio-button>
            <el-radio-button label="week">按周</el-radio-button>
            <el-radio-button label="month">按月</el-radio-button>
          </el-radio-group>
        </div>
        <div class="filter-item">
          <span class="filter-label">指标选择：</span>
          <el-checkbox-group v-model="selectedIndicators" @change="handleIndicatorChange">
            <el-checkbox label="totalUsers">总用户数</el-checkbox>
            <el-checkbox label="activeUsers">活跃用户数</el-checkbox>
            <el-checkbox label="newUsers">新增用户数</el-checkbox>
            <el-checkbox label="aiQaCount">AI问答次数</el-checkbox>
          </el-checkbox-group>
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

    <!-- 多折线图 -->
    <el-card class="chart-card">
      <div class="chart-header">
        <div class="chart-title">
          <el-icon class="chart-icon"><DataAnalysis /></el-icon>
          <h3>指标趋势图</h3>
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
        <el-table-column prop="date" label="日期" width="150" align="center" />
        <el-table-column 
          v-for="indicator in activeIndicators" 
          :key="indicator.key"
          :prop="indicator.key" 
          :label="indicator.label"
          align="center"
        >
          <template #default="{ row }">
            {{ formatValue(row[indicator.key], indicator.unit) }}
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Refresh, Download, DataAnalysis } from '@element-plus/icons-vue'
import { getGlobalIndicators } from '@/api/stat'
import ECharts from '@/components/ECharts.vue'
import * as XLSX from 'xlsx'

const period = ref('day')
const selectedIndicators = ref(['totalUsers', 'activeUsers', 'aiQaCount'])
const loading = ref(false)
const chartRef = ref(null)
const chartData = ref(null)

// 指标配置
const indicatorConfig = {
  totalUsers: { label: '总用户数', unit: '人', color: '#5470c6' },
  activeUsers: { label: '活跃用户数', unit: '人', color: '#91cc75' },
  newUsers: { label: '新增用户数', unit: '人', color: '#fac858' },
  aiQaCount: { label: 'AI问答次数', unit: '次', color: '#ee6666' }
}

// 活跃的指标列表
const activeIndicators = computed(() => {
  return selectedIndicators.value.map(key => ({
    key,
    ...indicatorConfig[key]
  }))
})

// 图表配置
const chartOption = computed(() => {
  if (!chartData.value) {
    return {
      title: {
        text: '暂无数据',
        left: 'center',
        top: 'middle',
        textStyle: { color: '#999' }
      }
    }
  }

  const { dates, indicators } = chartData.value
  const series = []
  const legend = []

  activeIndicators.value.forEach(indicator => {
    const data = indicators[indicator.key]?.values || []
    if (data.length > 0) {
      series.push({
        name: indicator.label,
        type: 'line',
        data: data,
        smooth: true,
        lineStyle: {
          color: indicator.color
        },
        itemStyle: {
          color: indicator.color
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: indicator.color + '80' },
              { offset: 1, color: indicator.color + '10' }
            ]
          }
        }
      })
      legend.push(indicator.label)
    }
  })

  return {
    title: {
      text: '全局指标趋势分析',
      left: 'center',
      textStyle: { fontSize: 16, fontWeight: 'bold' }
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' }
    },
    legend: {
      data: legend,
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
      boundaryGap: false,
      data: dates,
      axisLabel: {
        rotate: period.value === 'day' ? 45 : 0
      }
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        formatter: '{value}'
      }
    },
    series: series
  }
})

// 表格数据
const tableData = computed(() => {
  if (!chartData.value) return []
  
  const { dates, indicators } = chartData.value
  return dates.map((date, index) => {
    const row = { date }
    activeIndicators.value.forEach(indicator => {
      const values = indicators[indicator.key]?.values || []
      row[indicator.key] = values[index] || 0
    })
    return row
  })
})

// 加载数据
const loadData = async () => {
  loading.value = true
  try {
    const indicators = selectedIndicators.value.join(',')
    const data = await getGlobalIndicators(period.value, indicators)
    // 响应拦截器已经处理了返回格式，直接使用data
    chartData.value = data
  } catch (error) {
    console.error('加载数据失败：', error)
    ElMessage.error(error.message || '加载数据失败')
  } finally {
    loading.value = false
  }
}

// 周期切换
const handlePeriodChange = () => {
  loadData()
}

// 指标切换
const handleIndicatorChange = () => {
  if (selectedIndicators.value.length === 0) {
    ElMessage.warning('请至少选择一个指标')
    selectedIndicators.value = ['totalUsers']
    return
  }
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
      link.download = `全局指标分析_${period.value}_${new Date().getTime()}.png`
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
    const headers = ['日期', ...activeIndicators.value.map(i => i.label)]
    const rows = tableData.value.map(row => {
      const rowData = [row.date]
      activeIndicators.value.forEach(indicator => {
        rowData.push(row[indicator.key] || 0)
      })
      return rowData
    })

    const wsData = [headers, ...rows]
    const ws = XLSX.utils.aoa_to_sheet(wsData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '全局指标分析')

    // 设置列宽
    const colWidths = [
      { wch: 15 }, // 日期列
      ...activeIndicators.value.map(() => ({ wch: 15 }))
    ]
    ws['!cols'] = colWidths

    // 导出文件
    const fileName = `全局指标分析_${period.value}_${new Date().toISOString().slice(0, 10)}.xlsx`
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
  return `${value}${unit}`
}

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.global-indicators-container {
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

