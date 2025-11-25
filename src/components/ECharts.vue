<template>
  <div ref="chartContainer" :style="{ width: width, height: height }"></div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import * as echarts from 'echarts'

const props = defineProps({
  option: {
    type: Object,
    required: true,
    default: () => ({})
  },
  width: {
    type: String,
    default: '100%'
  },
  height: {
    type: String,
    default: '400px'
  }
})

const chartContainer = ref(null)
let chartInstance = null

// 初始化图表
const initChart = async () => {
  await nextTick()
  if (!chartContainer.value) return
  
  if (chartInstance) {
    chartInstance.dispose()
  }
  
  chartInstance = echarts.init(chartContainer.value)
  if (props.option && Object.keys(props.option).length > 0) {
    chartInstance.setOption(props.option, true)
  }
  
  // 响应式调整
  window.addEventListener('resize', handleResize)
}

// 处理窗口大小变化
const handleResize = () => {
  if (chartInstance) {
    chartInstance.resize()
  }
}

// 下载图表为PNG
const downloadChart = () => {
  if (chartInstance) {
    try {
      const url = chartInstance.getDataURL({
        type: 'png',
        pixelRatio: 2,
        backgroundColor: '#fff'
      })
      return url
    } catch (error) {
      console.error('下载图表失败：', error)
      return null
    }
  }
  return null
}

// 监听option变化
watch(() => props.option, (newOption) => {
  if (chartInstance && newOption && Object.keys(newOption).length > 0) {
    chartInstance.setOption(newOption, true)
  }
}, { deep: true, immediate: false })

onMounted(() => {
  initChart()
})

onBeforeUnmount(() => {
  if (chartInstance) {
    chartInstance.dispose()
    chartInstance = null
  }
  window.removeEventListener('resize', handleResize)
})

// 暴露方法供父组件调用
defineExpose({
  downloadChart,
  chart: () => chartInstance
})
</script>

