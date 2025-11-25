<template>
  <div class="user-detail-container">
    <div class="page-header">
      <el-button :icon="ArrowLeft" @click="handleBack">返回</el-button>
      <h2>用户详情</h2>
    </div>

    <el-card v-loading="loading">
      <el-tabs v-model="activeTab">
        <!-- 基础信息 -->
        <el-tab-pane label="基础信息" name="basic">
          <div class="detail-content">
            <el-descriptions :column="2" border>
              <el-descriptions-item label="用户ID">{{ userSequenceNumber !== null ? userSequenceNumber : userInfo.id }}</el-descriptions-item>
              <el-descriptions-item label="账号状态">
                <el-tag :type="userInfo.status === 1 ? 'success' : 'danger'">
                  {{ userInfo.status === 1 ? '启用' : '冻结' }}
                </el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="昵称">{{ userInfo.nickname || '未设置' }}</el-descriptions-item>
              <el-descriptions-item label="头像">
                <el-avatar :size="60" :src="userInfo.avatar">
                  <el-icon><User /></el-icon>
                </el-avatar>
              </el-descriptions-item>
              <el-descriptions-item label="性别">
                {{ userInfo.gender === 1 ? '男' : userInfo.gender === 2 ? '女' : '未知' }}
              </el-descriptions-item>
              <el-descriptions-item label="生日">{{ userInfo.birthday || '未设置' }}</el-descriptions-item>
              <el-descriptions-item label="身高">{{ userInfo.height ? userInfo.height + ' cm' : '未设置' }}</el-descriptions-item>
              <el-descriptions-item label="体重">{{ userInfo.weight ? userInfo.weight + ' kg' : '未设置' }}</el-descriptions-item>
              <el-descriptions-item label="手机号">{{ userInfo.phone || '未设置' }}</el-descriptions-item>
              <el-descriptions-item label="邮箱">{{ userInfo.email || '未设置' }}</el-descriptions-item>
              <el-descriptions-item label="注册时间">{{ userInfo.register_time }}</el-descriptions-item>
              <el-descriptions-item label="最后活跃">{{ userInfo.last_active_time || '从未活跃' }}</el-descriptions-item>
              <el-descriptions-item label="标签" :span="2">
                <el-tag
                  v-for="tag in userInfo.tags"
                  :key="tag.id"
                  :color="tag.color"
                  style="margin-right: 8px"
                >
                  {{ tag.tag_name }}
                </el-tag>
                <span v-if="!userInfo.tags || userInfo.tags.length === 0" class="text-muted">无标签</span>
              </el-descriptions-item>
              <el-descriptions-item label="健康记录数" :span="2">
                {{ userInfo.healthRecords?.total_records || 0 }} 条
                <span v-if="userInfo.healthRecords?.last_record_time" class="text-muted">
                  （最后记录：{{ userInfo.healthRecords.last_record_time }}）
                </span>
              </el-descriptions-item>
            </el-descriptions>
          </div>
        </el-tab-pane>

        <!-- 行为数据 -->
        <el-tab-pane label="行为数据" name="behavior">
          <div class="detail-content">
            <div class="chart-section">
              <h3>近30天活跃趋势</h3>
              <ECharts
                ref="activityChartRef"
                :option="activityOption"
                height="400px"
              />
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft, User } from '@element-plus/icons-vue'
import { getUserDetail } from '@/api/user'
import ECharts from '@/components/ECharts.vue'

const route = useRoute()
const router = useRouter()

// 数据状态
const loading = ref(false)
const userInfo = ref({})
const activeTab = ref('basic')
const activityChartRef = ref(null)
const userSequenceNumber = ref(null)

// 活跃趋势图配置
const activityOption = computed(() => ({
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
    data: userInfo.value.activityTrend?.dates || [],
    axisLine: {
      lineStyle: {
        color: '#e0e0e0'
      }
    },
    axisLabel: {
      color: '#666',
      rotate: 45
    }
  },
  yAxis: {
    type: 'value',
    name: '活跃次数',
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
      name: '活跃次数',
      type: 'line',
      smooth: true,
      data: userInfo.value.activityTrend?.counts || [],
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

// 加载数据
const loadData = async () => {
  const userId = route.params.id
  // 验证用户ID是否有效
  if (!userId || userId === 'undefined' || userId === 'null' || isNaN(parseInt(userId))) {
    router.push('/users/list')
    return
  }
  
  loading.value = true
  try {
    const data = await getUserDetail(parseInt(userId))
    userInfo.value = data
    
    // 计算用户序号：查询所有用户，找到当前用户在列表中的位置
    try {
      const { getUserList } = await import('@/api/user')
      const allUsersData = await getUserList({ page: 1, limit: 1000 })
      if (allUsersData && allUsersData.list) {
        const userIndex = allUsersData.list.findIndex(u => u.id === parseInt(userId))
        if (userIndex !== -1) {
          userSequenceNumber.value = userIndex + 1
        } else {
          userSequenceNumber.value = null
        }
      }
    } catch (seqError) {
      console.error('计算用户序号失败：', seqError)
      userSequenceNumber.value = null
    }
  } catch (error) {
    console.error('加载数据失败：', error)
    // 只有在确实查询失败时才提示错误
    const errorMessage = error.message || error.toString() || ''
    if (errorMessage.includes('用户不存在') || errorMessage.includes('404')) {
      ElMessage.error('用户不存在')
    } else {
      ElMessage.error('加载数据失败')
    }
    router.push('/users/list')
  } finally {
    loading.value = false
  }
}

// 返回
const handleBack = () => {
  router.back()
}

// 初始化
onMounted(() => {
  loadData()
})
</script>

<style scoped>
.user-detail-container {
  padding: 20px;
  background: #f0f2f5;
  min-height: calc(100vh - 60px);
}

.page-header {
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
}

.page-header h2 {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  color: #303133;
}

.detail-content {
  padding: 20px;
}

.chart-section {
  margin-top: 20px;
}

.chart-section h3 {
  margin: 0 0 20px 0;
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}

.text-muted {
  color: #909399;
  font-size: 12px;
}
</style>

