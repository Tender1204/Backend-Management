<template>
  <div class="dashboard-container">
    <!-- 顶部操作栏 -->
    <div class="dashboard-header">
      <div class="header-left">
        <h2 class="page-title">
          <el-icon class="title-icon"><DataBoard /></el-icon>
          数据看板
        </h2>
        <p class="page-subtitle">实时监控系统核心数据指标</p>
      </div>
      <div class="header-right">
        <el-radio-group v-model="currentPeriod" @change="handlePeriodChange" size="default" class="period-selector">
          <el-radio-button label="today">今日</el-radio-button>
          <el-radio-button label="week">本周</el-radio-button>
          <el-radio-button label="month">本月</el-radio-button>
        </el-radio-group>
        <el-button 
          type="primary" 
          :icon="Refresh" 
          @click="refreshData"
          :loading="loading"
          class="refresh-btn"
        >
          刷新数据
        </el-button>
      </div>
    </div>

    <!-- 核心指标卡片区（2行3列，共6个卡片） -->
    <div class="indicators-grid" v-if="indicatorsList.length > 0">
      <div 
        v-for="(indicator, index) in indicatorsList" 
        :key="index"
        class="indicator-card"
        :class="`card-${index + 1}`"
        @click="handleCardClick(indicator.link)"
      >
        <div class="card-bg"></div>
        <div class="card-content">
          <div class="card-header">
            <div class="card-label">{{ indicator.label }}</div>
            <div class="card-icon-wrapper">
              <el-icon :size="32" :color="getCardColor(index)">
                <component :is="getCardIcon(index)" />
              </el-icon>
            </div>
          </div>
          <div class="card-value">
            <span class="value-number">{{ formatValue(indicator.value, indicator.unit) }}</span>
            <span v-if="indicator.new !== undefined" class="value-new">
              <el-icon><ArrowUp /></el-icon>
              +{{ indicator.new }}
            </span>
          </div>
          <div v-if="indicator.status" class="card-status">
            <el-tag :type="indicator.status === 'success' ? 'success' : 'danger'" size="small" effect="dark">
              {{ indicator.value }}
            </el-tag>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 空状态提示 -->
    <div v-else-if="!loading" class="empty-indicators">
      <el-empty description="暂无指标数据，请刷新重试">
        <el-button type="primary" @click="loadData">刷新数据</el-button>
      </el-empty>
    </div>
    
    <!-- 加载中状态 -->
    <div v-else class="loading-indicators">
      <el-skeleton :rows="3" animated />
    </div>

    <!-- 图表区域：活跃度趋势 + 功能使用率 -->
    <div class="charts-row">
      <!-- 活跃度趋势折线图 -->
      <div class="chart-card trend-chart">
        <div class="chart-header">
          <div class="chart-title">
            <el-icon class="chart-icon"><DataAnalysis /></el-icon>
            <h3>用户活跃度趋势</h3>
          </div>
          <el-button 
            type="text" 
            :icon="Download" 
            @click="downloadChart('trendChart')"
            size="small"
            class="download-btn"
          >
            下载PNG
          </el-button>
        </div>
        <div class="chart-content">
          <ECharts 
            ref="trendChartRef"
            :option="trendOption"
            height="380px"
          />
        </div>
      </div>

      <!-- 功能使用率饼图 -->
      <div class="chart-card usage-chart">
        <div class="chart-header">
          <div class="chart-title">
            <el-icon class="chart-icon"><DataBoard /></el-icon>
            <h3>功能使用率分布</h3>
          </div>
          <el-button 
            type="text" 
            :icon="Download" 
            @click="downloadChart('usageChart')"
            size="small"
            class="download-btn"
          >
            下载PNG
          </el-button>
        </div>
        <div class="chart-content">
          <ECharts 
            ref="usageChartRef"
            :option="usageOption"
            height="380px"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { 
  Refresh, Download, User, DataBoard, Bell, ChatLineRound, Document, Setting,
  ArrowUp, DataAnalysis
} from '@element-plus/icons-vue'
import ECharts from '@/components/ECharts.vue'
import { 
  getIndicators, 
  getTrend, 
  getUsage
} from '@/api/dashboard'

const router = useRouter()

// 数据状态
const loading = ref(false)
const currentPeriod = ref('today')
const indicators = ref({})
const trendData = ref({ times: [], counts: [] })
const usageData = ref({ data: [] })

// 图表引用
const trendChartRef = ref(null)
const usageChartRef = ref(null)

// 指标列表（6个核心指标）
const indicatorsList = computed(() => {
  const list = []
  
  // 检查并添加核心指标（即使值为0也要显示）
  if (indicators.value && typeof indicators.value === 'object' && Object.keys(indicators.value).length > 0) {
    // 总用户数
    if ('totalUsers' in indicators.value && indicators.value.totalUsers !== undefined && indicators.value.totalUsers !== null) {
      list.push(indicators.value.totalUsers)
    }
    
    // 活跃用户数
    if ('activeUsers' in indicators.value && indicators.value.activeUsers !== undefined && indicators.value.activeUsers !== null) {
      list.push(indicators.value.activeUsers)
    }
    
    // 提醒触发率
    if ('reminderRate' in indicators.value && indicators.value.reminderRate !== undefined && indicators.value.reminderRate !== null) {
      list.push(indicators.value.reminderRate)
    }
    
    // AI问答次数
    if ('aiQaCount' in indicators.value && indicators.value.aiQaCount !== undefined && indicators.value.aiQaCount !== null) {
      list.push(indicators.value.aiQaCount)
    }
    
    // 知识库内容数
    if ('knowledgeCount' in indicators.value && indicators.value.knowledgeCount !== undefined && indicators.value.knowledgeCount !== null) {
      list.push(indicators.value.knowledgeCount)
    }
    
    // 系统运行状态
    if ('systemStatus' in indicators.value && indicators.value.systemStatus !== undefined && indicators.value.systemStatus !== null) {
      list.push(indicators.value.systemStatus)
    }
  }
  
  console.log('计算指标列表，当前indicators.value：', indicators.value)
  console.log('计算指标列表，最终list长度：', list.length)
  console.log('计算指标列表，最终list：', list)
  
  return list
})

// 活跃度趋势图配置
const trendOption = computed(() => ({
  backgroundColor: 'transparent',
  title: {
    show: false
  },
  tooltip: {
    trigger: 'axis',
    axisPointer: {
      type: 'cross',
      label: {
        backgroundColor: '#6a7985'
      }
    },
    backgroundColor: 'rgba(50, 50, 50, 0.9)',
    borderColor: '#409EFF',
    borderWidth: 1,
    textStyle: {
      color: '#fff'
    },
    formatter: function(params) {
      let result = params[0].name + '<br/>'
      params.forEach(item => {
        result += `${item.marker}${item.seriesName}: <strong>${item.value}</strong> 人<br/>`
      })
      return result
    }
  },
  grid: {
    left: '3%',
    right: '4%',
    bottom: '3%',
    top: '10%',
    containLabel: true
  },
  xAxis: {
    type: 'category',
    boundaryGap: false,
    data: trendData.value.times || [],
    axisLine: {
      lineStyle: {
        color: '#e0e0e0'
      }
    },
    axisLabel: {
      color: '#666',
      rotate: currentPeriod.value === 'today' ? 45 : 0
    }
  },
  yAxis: {
    type: 'value',
    name: '活跃用户数',
    nameTextStyle: {
      color: '#666'
    },
    axisLine: {
      lineStyle: {
        color: '#e0e0e0'
      }
    },
    axisLabel: {
      color: '#666'
    },
    splitLine: {
      lineStyle: {
        color: '#f0f0f0',
        type: 'dashed'
      }
    }
  },
  series: [
    {
      name: '活跃用户数',
      type: 'line',
      smooth: true,
      data: trendData.value.counts || [],
      areaStyle: {
        color: {
          type: 'linear',
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(64, 158, 255, 0.4)' },
            { offset: 1, color: 'rgba(64, 158, 255, 0.05)' }
          ]
        }
      },
      itemStyle: {
        color: '#409EFF',
        borderWidth: 2,
        borderColor: '#fff'
      },
      lineStyle: {
        width: 3,
        shadowBlur: 10,
        shadowColor: 'rgba(64, 158, 255, 0.5)'
      },
      emphasis: {
        focus: 'series',
        itemStyle: {
          shadowBlur: 20,
          shadowColor: 'rgba(64, 158, 255, 0.8)'
        }
      }
    }
  ]
}))

// 功能使用率饼图配置（环形图）
const usageOption = computed(() => ({
  backgroundColor: 'transparent',
  title: {
    show: false
  },
  tooltip: {
    trigger: 'item',
    backgroundColor: 'rgba(50, 50, 50, 0.9)',
    borderColor: '#409EFF',
    borderWidth: 1,
    textStyle: {
      color: '#fff'
    },
    formatter: '{a} <br/>{b}: <strong>{c}</strong> 次 ({d}%)'
  },
  legend: {
    orient: 'vertical',
    left: 'left',
    top: 'middle',
    textStyle: {
      color: '#666'
    }
  },
  series: [
    {
      name: '使用次数',
      type: 'pie',
      radius: ['45%', '75%'],
      center: ['60%', '50%'],
      avoidLabelOverlap: false,
      itemStyle: {
        borderRadius: 10,
        borderColor: '#fff',
        borderWidth: 2,
        shadowBlur: 10,
        shadowColor: 'rgba(0, 0, 0, 0.2)'
      },
      label: {
        show: true,
        formatter: '{d}%',
        fontSize: 12,
        fontWeight: 'bold'
      },
      labelLine: {
        show: false
      },
      emphasis: {
        label: {
          show: true,
          fontSize: 14,
          fontWeight: 'bold'
        },
        itemStyle: {
          shadowBlur: 20,
          shadowOffsetX: 0,
          shadowColor: 'rgba(0, 0, 0, 0.5)'
        }
      },
      data: usageData.value.data || []
    }
  ]
}))


// 格式化数值显示
const formatValue = (value, unit) => {
  if (typeof value === 'number') {
    if (value >= 10000) {
      return (value / 10000).toFixed(1) + '万' + unit
    } else if (value >= 1000) {
      return (value / 1000).toFixed(1) + 'k' + unit
    }
    return value + unit
  }
  return value + unit
}

// 获取卡片图标
const getCardIcon = (index) => {
  const icons = [
    User, User, Bell, ChatLineRound, Document, Setting
  ]
  return icons[index] || DataBoard
}

// 获取卡片颜色
const getCardColor = (index) => {
  const colors = [
    '#409EFF', '#67C23A', '#E6A23C', '#F56C6C', '#909399', '#409EFF'
  ]
  return colors[index] || '#409EFF'
}

// 加载数据
const loadData = async () => {
  loading.value = true
  try {
    // 并行请求所有数据，使用 Promise.allSettled 确保部分失败不影响其他数据
    const results = await Promise.allSettled([
      getIndicators(currentPeriod.value),
      getTrend(currentPeriod.value),
      getUsage(currentPeriod.value)
    ])
    
    // 处理指标数据
    if (results[0].status === 'fulfilled') {
      // 确保返回的数据是对象格式
      const data = results[0].value
      console.log('获取到的指标数据（原始）：', data)
      console.log('数据类型：', typeof data)
      console.log('是否为对象：', data && typeof data === 'object')
      
      if (data && typeof data === 'object') {
        indicators.value = data
        console.log('指标数据已设置：', indicators.value)
        console.log('指标数据keys：', Object.keys(indicators.value))
        console.log('totalUsers存在：', 'totalUsers' in indicators.value)
        console.log('totalUsers值：', indicators.value.totalUsers)
      } else {
        console.warn('指标数据格式不正确：', data)
        indicators.value = {}
      }
    } else {
      console.error('获取指标数据失败：', results[0].reason)
      console.error('失败详情：', results[0].reason?.response?.data || results[0].reason?.message)
      indicators.value = {}
      ElMessage.error('获取指标数据失败：' + (results[0].reason?.message || '未知错误'))
    }
    
    // 处理趋势数据
    if (results[1].status === 'fulfilled') {
      trendData.value = results[1].value || { times: [], counts: [] }
    } else {
      console.error('获取趋势数据失败：', results[1].reason)
      trendData.value = { times: [], counts: [] }
    }
    
    // 处理使用率数据
    if (results[2].status === 'fulfilled') {
      usageData.value = results[2].value || { data: [] }
    } else {
      console.error('获取使用率数据失败：', results[2].reason)
      usageData.value = { data: [] }
    }
    
    // 检查是否有数据加载失败
    const failedCount = results.filter(r => r.status === 'rejected').length
    if (failedCount > 0 && failedCount < results.length) {
      ElMessage.warning('部分数据加载失败，请刷新重试')
    }
    
  } catch (error) {
    console.error('加载数据失败：', error)
    ElMessage.error('加载数据失败，请稍后重试')
  } finally {
    loading.value = false
  }
}

// 周期切换
const handlePeriodChange = () => {
  loadData()
}

// 刷新数据
const refreshData = () => {
  loadData()
  ElMessage.success('数据已刷新')
}

// 卡片点击跳转
const handleCardClick = (link) => {
  if (!link) {
    console.warn('卡片链接为空，无法跳转')
    return
  }
  
  console.log('卡片点击，链接：', link)
  
  try {
    // 解析链接，处理查询参数
    const [path, queryString] = link.split('?')
    const query = {}
    
    if (queryString) {
      queryString.split('&').forEach(param => {
        const [key, value] = param.split('=')
        if (key && value) {
          query[key] = decodeURIComponent(value)
        }
      })
    }
    
    const targetPath = path || link
    console.log('准备跳转到路径：', targetPath)
    
    // 使用 Vue Router 进行跳转
    router.push({
      path: targetPath,
      query: Object.keys(query).length > 0 ? query : undefined
    }).then(() => {
      console.log('路由跳转成功：', targetPath)
    }).catch(err => {
      // 处理路由重复导航错误
      if (err.name !== 'NavigationDuplicated') {
        console.error('路由跳转失败：', err)
        console.error('错误详情：', err.message)
        // 如果路由跳转失败，尝试使用 replace
        router.replace({
          path: targetPath,
          query: Object.keys(query).length > 0 ? query : undefined
        }).then(() => {
          console.log('路由替换成功：', targetPath)
        }).catch(replaceErr => {
          console.error('路由替换失败：', replaceErr)
          // 如果 replace 也失败，使用 window.location 作为后备方案
          window.location.href = link
        })
      } else {
        console.log('路由重复导航，已忽略')
      }
    })
  } catch (error) {
    console.error('处理卡片点击失败：', error)
    // 如果解析失败，直接使用 window.location
    window.location.href = link
  }
}

// 下载图表为PNG
const downloadChart = (chartName) => {
  const chartMap = {
    trendChart: trendChartRef,
    usageChart: usageChartRef
  }
  
  const chartRef = chartMap[chartName]?.value
  if (chartRef) {
    const url = chartRef.downloadChart()
    if (url) {
      const link = document.createElement('a')
      link.href = url
      link.download = `${chartName}_${new Date().getTime()}.png`
      link.click()
      ElMessage.success('图表下载成功')
    } else {
      ElMessage.warning('图表未加载完成')
    }
  }
}

// 页面加载时获取数据
onMounted(() => {
  loadData()
})
</script>

<style scoped>
.dashboard-container {
  padding: 20px;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  min-height: calc(100vh - 60px);
}

/* 顶部操作栏 */
.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding: 24px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(102, 126, 234, 0.3);
  color: #fff;
}

.header-left {
  flex: 1;
}

.page-title {
  margin: 0 0 8px 0;
  font-size: 28px;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 12px;
  color: #fff;
}

.title-icon {
  font-size: 32px;
}

.page-subtitle {
  margin: 0;
  font-size: 14px;
  opacity: 0.9;
  color: rgba(255, 255, 255, 0.9);
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.period-selector {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  padding: 4px;
}

.period-selector :deep(.el-radio-button__inner) {
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.8);
  padding: 8px 16px;
}

.period-selector :deep(.el-radio-button__orig-radio:checked + .el-radio-button__inner) {
  background: rgba(255, 255, 255, 0.3);
  color: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.refresh-btn {
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: #fff;
  backdrop-filter: blur(10px);
}

.refresh-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}

/* 指标卡片网格（2行3列） */
.indicators-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  margin-bottom: 24px;
}

.indicator-card {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.05);
}

.indicator-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 4px;
  height: 100%;
  background: var(--card-color, #409EFF);
  transition: width 0.3s;
}

.indicator-card:hover {
  transform: translateY(-8px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
}

.indicator-card:hover::before {
  width: 100%;
  opacity: 0.1;
}

.card-bg {
  position: absolute;
  top: 0;
  right: 0;
  width: 120px;
  height: 120px;
  background: radial-gradient(circle, rgba(64, 158, 255, 0.1) 0%, transparent 70%);
  border-radius: 50%;
  transform: translate(30%, -30%);
  pointer-events: none;
}

.card-content {
  position: relative;
  z-index: 1;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.card-label {
  font-size: 14px;
  color: #909399;
  font-weight: 500;
}

.card-icon-wrapper {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(64, 158, 255, 0.1) 0%, rgba(64, 158, 255, 0.05) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
}

.card-value {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 12px;
}

.value-number {
  font-size: 32px;
  font-weight: 700;
  color: #303133;
  line-height: 1;
}

.value-new {
  font-size: 14px;
  color: #67C23A;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 4px;
  background: rgba(103, 194, 58, 0.1);
  padding: 4px 8px;
  border-radius: 4px;
}

.card-status {
  margin-top: 8px;
}


/* 图表行 */
.charts-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
  margin-bottom: 20px;
}


.chart-card {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  transition: all 0.3s;
  border: 1px solid rgba(0, 0, 0, 0.05);
}

.chart-card:hover {
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
  transform: translateY(-2px);
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 2px solid #f0f2f5;
}

.chart-title {
  display: flex;
  align-items: center;
  gap: 12px;
}

.chart-icon {
  font-size: 24px;
  color: #409EFF;
}

.chart-title h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}

.download-btn {
  color: #409EFF;
}

.download-btn:hover {
  color: #66B1FF;
}

.chart-content {
  width: 100%;
}

/* 响应式布局 */
@media (max-width: 1400px) {
  .indicators-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 1200px) {
  .charts-row {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .indicators-grid {
    grid-template-columns: 1fr;
  }
  
  .dashboard-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }
  
  .header-right {
    width: 100%;
    justify-content: space-between;
  }
}

/* 卡片特殊样式 */
.card-1 {
  --card-color: #409EFF;
}

.card-2 {
  --card-color: #67C23A;
}

.card-3 {
  --card-color: #E6A23C;
}

.card-4 {
  --card-color: #F56C6C;
}

.card-5 {
  --card-color: #909399;
}

.card-6 {
  --card-color: #409EFF;
}


/* 空状态和加载状态 */
.empty-indicators {
  padding: 60px 20px;
  text-align: center;
  background: #fff;
  border-radius: 12px;
  margin-bottom: 24px;
}

.loading-indicators {
  padding: 40px 20px;
  background: #fff;
  border-radius: 12px;
  margin-bottom: 24px;
}
</style>
