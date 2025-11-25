<template>
  <div class="statistics-container">
    <div class="page-header">
      <h2>
        <el-icon><DataAnalysis /></el-icon>
        规则效果统计
      </h2>
      <p class="page-desc">统计各规则的触发次数、用户执行率等数据</p>
    </div>

    <!-- 筛选表单 -->
    <el-card class="filter-card">
      <el-form :model="filterForm" :inline="true">
        <el-form-item label="规则类型">
          <el-select v-model="filterForm.ruleTypeId" placeholder="全部" clearable style="width: 150px">
            <el-option
              v-for="type in ruleTypes"
              :key="type.id"
              :label="type.typeName || type.type_name"
              :value="type.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="统计周期">
          <el-select v-model="filterForm.period" style="width: 150px">
            <el-option label="按日统计" value="day" />
            <el-option label="按周统计" value="week" />
            <el-option label="按月统计" value="month" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="handleSearch">查询</el-button>
          <el-button :icon="Refresh" @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 图表区域 -->
    <el-row :gutter="20" style="margin-bottom: 20px">
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>触发次数统计</span>
            </div>
          </template>
          <ECharts
            v-if="triggerChartData"
            :option="triggerChartOption"
            style="height: 300px"
          />
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>执行率趋势</span>
            </div>
          </template>
          <ECharts
            v-if="executionChartData"
            :option="executionChartOption"
            style="height: 300px"
          />
        </el-card>
      </el-col>
    </el-row>

    <!-- 数据表格 -->
    <el-card>
      <el-table
        v-loading="loading"
        :data="tableData"
        stripe
        style="width: 100%"
      >
        <el-table-column type="index" label="序号" width="80" />
        <el-table-column prop="timePeriod" label="时间周期" width="150" />
        <el-table-column prop="ruleTypeName" label="规则类型" width="120" />
        <el-table-column prop="triggerCount" label="触发次数" width="120" align="right">
          <template #default="{ row }">
            <el-tag type="info">{{ row.triggerCount }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="userCount" label="用户数" width="100" align="right" />
        <el-table-column prop="avgCompletionRate" label="平均完成率" width="120" align="right">
          <template #default="{ row }">
            <span :style="{ color: getRateColor(row.avgCompletionRate) }">
              {{ row.avgCompletionRate.toFixed(2) }}%
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="executionRate" label="执行率" width="120" align="right">
          <template #default="{ row }">
            <el-progress
              :percentage="parseFloat(row.executionRate)"
              :color="getProgressColor(parseFloat(row.executionRate))"
              :stroke-width="8"
            />
          </template>
        </el-table-column>
        <el-table-column prop="completedCount" label="完成数" width="100" align="right" />
        <el-table-column prop="totalCount" label="总数" width="100" align="right" />
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { DataAnalysis, Search, Refresh } from '@element-plus/icons-vue'
import { getRuleTypes, getRuleStatistics } from '@/api/rule'
import ECharts from '@/components/ECharts.vue'

const loading = ref(false)
const filterForm = reactive({
  ruleTypeId: null,
  period: 'day'
})

const ruleTypes = ref([])

const statisticsData = ref(null)
const tableData = ref([])
const triggerChartData = ref(null)
const executionChartData = ref(null)

// 触发次数图表配置
const triggerChartOption = computed(() => {
  if (!triggerChartData.value) return null

  const data = triggerChartData.value
  const categories = [...new Set(data.map(item => item.timePeriod))].sort()
  const seriesData = {}

  // 按规则类型分组
  data.forEach(item => {
    if (!seriesData[item.ruleTypeName]) {
      seriesData[item.ruleTypeName] = new Array(categories.length).fill(0)
    }
    const index = categories.indexOf(item.timePeriod)
    if (index !== -1) {
      seriesData[item.ruleTypeName][index] = item.triggerCount
    }
  })

  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow'
      }
    },
    legend: {
      data: Object.keys(seriesData)
    },
    xAxis: {
      type: 'category',
      data: categories
    },
    yAxis: {
      type: 'value',
      name: '触发次数'
    },
    series: Object.keys(seriesData).map(name => ({
      name,
      type: 'bar',
      data: seriesData[name]
    }))
  }
})

// 执行率图表配置
const executionChartOption = computed(() => {
  if (!executionChartData.value) return null

  const data = executionChartData.value
  const categories = [...new Set(data.map(item => item.timePeriod))].sort()
  const seriesData = {}

  // 按规则类型分组
  data.forEach(item => {
    if (!seriesData[item.ruleTypeName]) {
      seriesData[item.ruleTypeName] = new Array(categories.length).fill(0)
    }
    const index = categories.indexOf(item.timePeriod)
    if (index !== -1) {
      seriesData[item.ruleTypeName][index] = parseFloat(item.executionRate)
    }
  })

  return {
    tooltip: {
      trigger: 'axis'
    },
    legend: {
      data: Object.keys(seriesData)
    },
    xAxis: {
      type: 'category',
      data: categories
    },
    yAxis: {
      type: 'value',
      name: '执行率(%)',
      max: 100
    },
    series: Object.keys(seriesData).map(name => ({
      name,
      type: 'line',
      data: seriesData[name],
      smooth: true
    }))
  }
})

// 获取完成率颜色
const getRateColor = (rate) => {
  if (rate >= 80) return '#67c23a'
  if (rate >= 60) return '#e6a23c'
  return '#f56c6c'
}

// 获取进度条颜色
const getProgressColor = (percentage) => {
  if (percentage >= 80) return '#67c23a'
  if (percentage >= 60) return '#e6a23c'
  return '#f56c6c'
}

// 加载规则类型列表
const loadRuleTypes = async () => {
  try {
    const data = await getRuleTypes()
    ruleTypes.value = data || []
  } catch (err) {
    console.error('加载规则类型失败：', err)
  }
}

// 加载统计数据
const loadStatistics = async () => {
  try {
    loading.value = true
    const params = {
      period: filterForm.period
    }
    if (filterForm.ruleTypeId) {
      params.ruleTypeId = filterForm.ruleTypeId
    }
    
    const data = await getRuleStatistics(params)
    statisticsData.value = data
    
    if (data && data.statistics) {
      tableData.value = data.statistics
      triggerChartData.value = data.statistics
      executionChartData.value = data.statistics
    } else {
      tableData.value = []
      triggerChartData.value = null
      executionChartData.value = null
    }
  } catch (err) {
    console.error('加载统计数据失败：', err)
    tableData.value = []
    triggerChartData.value = null
    executionChartData.value = null
  } finally {
    loading.value = false
  }
}

// 查询
const handleSearch = () => {
  loadStatistics()
}

// 重置
const handleReset = () => {
  filterForm.ruleTypeId = null
  filterForm.period = 'day'
  loadStatistics()
}

onMounted(() => {
  loadRuleTypes()
  loadStatistics()
})
</script>

<style scoped>
.statistics-container {
  padding: 20px;
  background: #fff;
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

.card-header {
  font-weight: 600;
  font-size: 16px;
}
</style>

