<template>
  <div class="rule-list-container">
    <div class="page-header">
      <h2>健康规则管理</h2>
      <p class="page-desc">配置饮水、饮食、运动、睡眠等健康规则，按标签分配模板</p>
    </div>
    <el-card>
      <div class="menu-cards">
        <el-row :gutter="20">
          <el-col :span="8">
            <el-card class="menu-card" shadow="hover" @click="goToPage('/rules/config')">
              <div class="card-content">
                <el-icon :size="48" color="#409EFF"><Setting /></el-icon>
                <h3>基础规则配置</h3>
                <p>配置饮水、饮食、运动、睡眠等健康规则的阈值参数</p>
              </div>
            </el-card>
          </el-col>
          <el-col :span="8">
            <el-card class="menu-card" shadow="hover" @click="goToPage('/rules/templates')">
              <div class="card-content">
                <el-icon :size="48" color="#67C23A"><Document /></el-icon>
                <h3>规则模板管理</h3>
                <p>管理健康规则模板，按标签分配给用户</p>
              </div>
            </el-card>
          </el-col>
          <el-col :span="8">
            <el-card class="menu-card" shadow="hover" @click="goToPage('/rules/statistics')">
              <div class="card-content">
                <el-icon :size="48" color="#E6A23C"><DataAnalysis /></el-icon>
                <h3>规则效果统计</h3>
                <p>统计各规则的触发次数、用户执行率等数据</p>
              </div>
            </el-card>
          </el-col>
        </el-row>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { Document, Setting, DataAnalysis } from '@element-plus/icons-vue'

const router = useRouter()

const goToPage = (path) => {
  router.push(path)
}
</script>

<style scoped>
.rule-list-container {
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
}

.page-desc {
  margin: 0;
  color: #909399;
  font-size: 14px;
}

.menu-cards {
  padding: 20px 0;
}

.menu-card {
  cursor: pointer;
  transition: all 0.3s;
  height: 200px;
}

.menu-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
}

.card-content {
  text-align: center;
  padding: 20px;
}

.card-content h3 {
  margin: 16px 0 8px 0;
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}

.card-content p {
  margin: 0;
  color: #909399;
  font-size: 14px;
  line-height: 1.6;
}
</style>

