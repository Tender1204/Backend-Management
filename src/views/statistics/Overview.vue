<template>
  <div class="statistics-overview-container">
    <div class="page-header">
      <h2>数据统计分析</h2>
      <p class="page-desc">分析用户行为数据，查看功能使用率统计</p>
    </div>
    
    <div class="statistics-cards">
      <el-row :gutter="20">
        <el-col :span="8">
          <el-card class="stat-card" @click="navigateTo('/statistics/global-indicators')" shadow="hover">
            <div class="card-content">
              <div class="card-icon">
                <el-icon :size="48" color="#409eff"><DataAnalysis /></el-icon>
              </div>
              <h3>全局指标分析</h3>
              <p>查看总用户数、活跃用户数、AI问答次数等核心指标的趋势数据</p>
              <el-button type="primary" style="margin-top: 15px;">进入分析</el-button>
            </div>
          </el-card>
        </el-col>
        
        <el-col :span="8">
          <el-card class="stat-card" @click="navigateTo('/statistics/user-dimension')" shadow="hover">
            <div class="card-content">
              <div class="card-icon">
                <el-icon :size="48" color="#67c23a"><User /></el-icon>
              </div>
              <h3>用户维度分析</h3>
              <p>按标签（性别/年龄/健康状态）拆分健康数据（平均步数/睡眠时长等）</p>
              <el-button type="success" style="margin-top: 15px;">进入分析</el-button>
            </div>
          </el-card>
        </el-col>
        
        <el-col :span="8">
          <el-card class="stat-card" @click="navigateTo('/statistics/function-usage')" shadow="hover">
            <div class="card-content">
              <div class="card-icon">
                <el-icon :size="48" color="#e6a23c"><Document /></el-icon>
              </div>
              <h3>功能使用分析</h3>
              <p>查询各功能（提醒/AI问答/数据记录）的使用率、留存率</p>
              <el-button type="warning" style="margin-top: 15px;">进入分析</el-button>
            </div>
          </el-card>
        </el-col>
      </el-row>
    </div>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { DataAnalysis, User, Document } from '@element-plus/icons-vue'

const router = useRouter()

const navigateTo = (path) => {
  router.push(path)
}
</script>

<style scoped>
.statistics-overview-container {
  padding: 20px;
  background: #f5f7fa;
  min-height: calc(100vh - 60px);
}

.page-header {
  margin-bottom: 30px;
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

.statistics-cards {
  margin-top: 20px;
}

.stat-card {
  cursor: pointer;
  transition: all 0.3s;
  height: 100%;
}

.stat-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1) !important;
}

.card-content {
  text-align: center;
  padding: 20px;
}

.card-icon {
  margin-bottom: 20px;
}

.card-content h3 {
  margin: 0 0 15px 0;
  font-size: 20px;
  font-weight: 600;
  color: #303133;
}

.card-content p {
  margin: 0;
  color: #606266;
  font-size: 14px;
  line-height: 1.6;
  min-height: 60px;
}
</style>

