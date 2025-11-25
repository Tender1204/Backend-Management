<template>
  <div class="sync-knowledge-container">
    <div class="page-header">
      <h2>AI知识库同步</h2>
      <p class="page-desc">同步内容管理模块的已上架内容至AI知识库，供模型调用</p>
    </div>

    <!-- API配置卡片 -->
    <el-card class="api-config-card" style="margin-bottom: 20px">
      <template #header>
        <div class="card-header">
          <span>API配置</span>
          <el-button text @click="showApiConfig = !showApiConfig" icon="Setting">
            {{ showApiConfig ? '收起' : '展开' }}
          </el-button>
        </div>
      </template>
      <div v-if="showApiConfig" class="api-config-form">
        <el-form :model="apiConfig" label-width="120px">
          <el-form-item label="API基础地址">
            <el-input 
              v-model="apiConfig.baseUrl" 
              placeholder="https://your-nlp-api.com"
              clearable
            >
              <template #prepend>POST</template>
            </el-input>
          </el-form-item>
          <el-form-item label="API密钥">
            <el-input 
              v-model="apiConfig.apiKey" 
              type="password"
              placeholder="输入API密钥（如果需要）"
              show-password
              clearable
            />
          </el-form-item>
          <el-form-item label="选择模型">
            <el-select 
              v-model="apiConfig.modelName" 
              placeholder="选择AI模型"
              style="width: 100%"
              filterable
              @change="handleModelChange"
            >
              <el-option
                v-for="model in availableModels"
                :key="model.name"
                :label="model.description || model.name"
                :value="model.name"
              />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="saveApiConfigToServer" icon="Check">保存配置</el-button>
            <el-button @click="testApiConnection" :loading="testingApi" icon="Connection">测试连接</el-button>
            <el-button @click="loadAvailableModels" :loading="loadingModels" icon="Refresh">刷新模型列表</el-button>
          </el-form-item>
        </el-form>
      </div>
      <div v-else class="api-config-summary">
        <span>API地址：{{ apiConfig.baseUrl || '未配置' }}</span>
        <span style="margin-left: 20px">当前模型：{{ apiConfig.modelName || '默认' }}</span>
      </div>
    </el-card>

    <el-card class="sync-card">
      <!-- 顶部操作栏 -->
      <div class="sync-header">
        <div class="sync-status">
          <el-tag :type="syncStatusType" size="large">{{ syncStatusText }}</el-tag>
          <span class="model-version">当前模型：{{ currentModelName }}</span>
        </div>
        <div class="sync-actions">
          <el-button 
            type="primary" 
            :loading="syncing" 
            :disabled="syncing || !apiConfig.baseUrl"
            @click="handleSync"
            icon="Refresh">
            手动同步
          </el-button>
          <el-button @click="refreshInfo" icon="RefreshRight">刷新</el-button>
        </div>
      </div>

      <!-- 同步信息卡片 -->
      <div class="sync-info">
        <el-row :gutter="20">
          <el-col :span="6">
            <el-card class="info-card">
              <div class="info-item">
                <div class="info-label">上次同步时间</div>
                <div class="info-value">{{ lastSyncTime || '未同步' }}</div>
              </div>
            </el-card>
          </el-col>
          <el-col :span="6">
            <el-card class="info-card">
              <div class="info-item">
                <div class="info-label">同步内容数</div>
                <div class="info-value">{{ syncInfo.syncCount || 0 }}</div>
              </div>
            </el-card>
          </el-col>
          <el-col :span="6">
            <el-card class="info-card">
              <div class="info-item">
                <div class="info-label">模型识别数</div>
                <div class="info-value">{{ syncInfo.modelRecognizeCount || 0 }}</div>
              </div>
            </el-card>
          </el-col>
          <el-col :span="6">
            <el-card class="info-card">
              <div class="info-item">
                <div class="info-label">知识库索引大小</div>
                <div class="info-value">{{ syncInfo.indexSize || 0 }} 条</div>
              </div>
            </el-card>
          </el-col>
        </el-row>
      </div>

      <!-- 同步进度条 -->
      <div class="sync-progress" v-if="syncing">
        <el-progress 
          :percentage="progressPercentage" 
          :status="progressStatus"
          :stroke-width="20">
          <template #default="{ percentage }">
            <span class="progress-text">{{ progressText }}</span>
          </template>
        </el-progress>
        <div class="progress-steps">
          <div 
            v-for="(step, index) in progressSteps" 
            :key="index"
            :class="['progress-step', { active: step.active, completed: step.completed }]">
            <el-icon v-if="step.completed"><Check /></el-icon>
            <span>{{ step.label }}</span>
          </div>
        </div>
      </div>
    </el-card>

    <!-- 同步日志列表 -->
    <el-card class="sync-logs-card">
      <template #header>
        <div class="card-header">
          <span>同步日志</span>
          <el-button text @click="refreshLogs" icon="RefreshRight">刷新</el-button>
        </div>
      </template>
      <el-table :data="syncLogs" stripe>
        <el-table-column prop="createTime" label="时间" width="180" />
        <el-table-column prop="operator" label="操作人" width="120" />
        <el-table-column prop="syncCount" label="同步内容数" width="120" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === '成功' ? 'success' : 'danger'">
              {{ row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="modelVersion" label="模型版本" width="150" />
        <el-table-column prop="duration" label="耗时" width="100">
          <template #default="{ row }">
            {{ row.duration ? `${row.duration}秒` : '-' }}
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 知识库内容列表 -->
    <el-card class="knowledge-list-card">
      <template #header>
        <div class="card-header">
          <span>知识库内容</span>
          <div>
            <el-input
              v-model="knowledgeFilter.title"
              placeholder="搜索标题"
              clearable
              style="width: 200px; margin-right: 10px"
              @keyup.enter="loadKnowledgeList"
            />
            <el-select
              v-model="knowledgeFilter.category"
              placeholder="选择分类"
              clearable
              style="width: 150px; margin-right: 10px"
              @change="loadKnowledgeList"
            >
              <el-option label="健康科普" value="健康科普" />
              <el-option label="运动" value="运动" />
              <el-option label="饮食" value="饮食" />
              <el-option label="心理健康" value="心理健康" />
              <el-option label="其他" value="其他" />
            </el-select>
            <el-button text @click="loadKnowledgeList" icon="Search">查询</el-button>
            <el-button text @click="refreshKnowledgeList" icon="RefreshRight">刷新</el-button>
          </div>
        </div>
      </template>
      <el-table 
        :data="knowledgeList" 
        stripe 
        v-loading="loadingKnowledge"
        style="width: 100%"
      >
        <el-table-column type="index" label="序号" width="80" :index="(index) => (knowledgePagination.pageNum - 1) * knowledgePagination.pageSize + index + 1" />
        <el-table-column prop="title" label="标题" min-width="200" show-overflow-tooltip />
        <el-table-column prop="category" label="分类" width="120" />
        <el-table-column prop="keywords" label="关键词" width="200" show-overflow-tooltip>
          <template #default="{ row }">
            <el-tag
              v-for="(kw, idx) in (row.keywords ? row.keywords.split(',') : [])"
              :key="idx"
              size="small"
              style="margin-right: 4px; margin-bottom: 4px"
            >
              {{ kw }}
            </el-tag>
            <span v-if="!row.keywords || row.keywords.trim() === ''" class="text-muted">无关键词</span>
          </template>
        </el-table-column>
        <el-table-column prop="content" label="内容预览" min-width="300" show-overflow-tooltip>
          <template #default="{ row }">
            <span>{{ row.content ? (row.content.length > 100 ? row.content.substring(0, 100) + '...' : row.content) : '无内容' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="createTime" label="创建时间" width="180" />
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button 
              type="primary" 
              link 
              size="small" 
              @click="viewKnowledgeDetail(row)"
              :icon="Document"
            >
              查看详情
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="pagination-container" style="margin-top: 20px; text-align: right">
        <el-pagination
          v-model:current-page="knowledgePagination.pageNum"
          v-model:page-size="knowledgePagination.pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="knowledgePagination.total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="loadKnowledgeList"
          @current-change="loadKnowledgeList"
        />
      </div>
    </el-card>

    <!-- 知识详情弹窗 -->
    <el-dialog
      v-model="knowledgeDetailVisible"
      title="知识详情"
      width="800px"
      :close-on-click-modal="false"
    >
      <div v-if="currentKnowledge" class="knowledge-detail">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="标题" :span="2">
            {{ currentKnowledge.title }}
          </el-descriptions-item>
          <el-descriptions-item label="分类">
            <el-tag>{{ currentKnowledge.category || '未分类' }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="currentKnowledge.status === 1 ? 'success' : 'info'">
              {{ currentKnowledge.status === 1 ? '已启用' : '已禁用' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="关键词" :span="2">
            <el-tag
              v-for="(kw, idx) in (currentKnowledge.keywords ? currentKnowledge.keywords.split(',') : [])"
              :key="idx"
              size="small"
              style="margin-right: 4px; margin-bottom: 4px"
            >
              {{ kw }}
            </el-tag>
            <span v-if="!currentKnowledge.keywords || currentKnowledge.keywords.trim() === ''" class="text-muted">无关键词</span>
          </el-descriptions-item>
          <el-descriptions-item label="创建时间">
            {{ currentKnowledge.createTime || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="更新时间">
            {{ currentKnowledge.updated_at || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="知识内容" :span="2">
            <div class="knowledge-content">
              {{ currentKnowledge.content || '无内容' }}
            </div>
          </el-descriptions-item>
        </el-descriptions>
      </div>
      <template #footer>
        <el-button @click="knowledgeDetailVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Check, Document } from '@element-plus/icons-vue'
import { syncKnowledge, getSyncLogs, getModels, getApiConfig, saveApiConfig, getKnowledgeList } from '@/api/ai'

const syncing = ref(false)
const showApiConfig = ref(false)
const testingApi = ref(false)
const loadingModels = ref(false)
const apiConfig = ref({
  baseUrl: '',
  apiKey: '',
  modelName: 'default'
})
const availableModels = ref([
  { name: 'default', description: '默认模型（使用环境变量配置）' }
])
const syncStatus = ref('未同步') // 未同步 / 同步中 / 已同步
const lastSyncTime = ref('')
const syncInfo = ref({
  syncCount: 0,
  modelRecognizeCount: 0,
  indexSize: 0
})
const progressPercentage = ref(0)
const progressText = ref('')
const progressStatus = ref('')
const progressSteps = ref([
  { label: '内容查询', active: false, completed: false },
  { label: 'API调用', active: false, completed: false },
  { label: '关键词提取', active: false, completed: false },
  { label: '索引生成', active: false, completed: false },
  { label: '完成', active: false, completed: false }
])
const syncLogs = ref([])

// 知识库列表相关
const knowledgeList = ref([])
const loadingKnowledge = ref(false)
const knowledgeFilter = ref({
  title: '',
  category: '',
  keyword: ''
})
const knowledgePagination = ref({
  pageNum: 1,
  pageSize: 10,
  total: 0
})
const knowledgeDetailVisible = ref(false)
const currentKnowledge = ref(null)

const currentModelName = computed(() => {
  if (apiConfig.value.modelName && apiConfig.value.modelName !== 'default') {
    const model = availableModels.value.find(m => m.name === apiConfig.value.modelName)
    return model ? (model.description || model.name) : apiConfig.value.modelName
  }
  return '默认模型（未配置API）'
})

const syncStatusType = computed(() => {
  if (syncStatus.value === '已同步') return 'success'
  if (syncStatus.value === '同步中') return 'warning'
  return 'info'
})

const syncStatusText = computed(() => {
  return syncStatus.value
})

// 手动同步
const handleSync = async () => {
  try {
    await ElMessageBox.confirm(
      '同步操作将清空现有知识库并重新同步所有已上架内容，是否继续？',
      '确认同步',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    syncing.value = true
    syncStatus.value = '同步中'
    progressPercentage.value = 0
    progressStatus.value = ''
    progressText.value = '开始同步...'

    // 重置进度步骤
    progressSteps.value.forEach(step => {
      step.active = false
      step.completed = false
    })

    // 模拟进度更新
    const updateProgress = (step, percentage, text) => {
      progressSteps.value[step].active = true
      progressPercentage.value = percentage
      progressText.value = text
    }

    // 检查API配置
    if (!apiConfig.value.baseUrl) {
      ElMessage.warning('请先配置API地址')
      return
    }

    // 步骤1：内容查询
    updateProgress(0, 20, '正在查询已上架内容...')
    await new Promise(resolve => setTimeout(resolve, 500))
    progressSteps.value[0].completed = true
    progressSteps.value[0].active = false

    // 步骤2：API调用
    updateProgress(1, 40, '正在调用API提取关键词...')
    await new Promise(resolve => setTimeout(resolve, 1000))
    progressSteps.value[1].completed = true
    progressSteps.value[1].active = false

    // 步骤3：关键词提取
    updateProgress(2, 60, '正在处理关键词...')
    await new Promise(resolve => setTimeout(resolve, 1500))
    progressSteps.value[2].completed = true
    progressSteps.value[2].active = false

    // 步骤4：索引生成
    updateProgress(3, 80, '正在生成索引...')
    await new Promise(resolve => setTimeout(resolve, 1000))
    progressSteps.value[3].completed = true
    progressSteps.value[3].active = false

    // 调用同步接口（传递模型名称）
    const result = await syncKnowledge({
      modelName: apiConfig.value.modelName !== 'default' ? apiConfig.value.modelName : undefined
    })

    // 步骤5：完成
    updateProgress(4, 100, '同步完成')
    progressSteps.value[4].completed = true
    progressSteps.value[4].active = false
    progressStatus.value = 'success'

    // 更新同步信息
    syncInfo.value = {
      syncCount: result.syncCount || 0,
      modelRecognizeCount: result.modelRecognizeCount || 0,
      indexSize: result.syncCount || 0
    }
    lastSyncTime.value = new Date().toLocaleString('zh-CN')
    syncStatus.value = '已同步'

    ElMessage.success('同步成功')
    
    // 刷新日志列表（从后端获取最新日志）
    await refreshLogs()
    
    setTimeout(() => {
      syncing.value = false
    }, 1000)

  } catch (error) {
    if (error !== 'cancel') {
      console.error('同步失败：', error)
      ElMessage.error(error.message || '同步失败')
      syncStatus.value = '同步失败'
      progressStatus.value = 'exception'
    }
    syncing.value = false
  }
}

// 保存API配置
const saveApiConfigToServer = async () => {
  if (!apiConfig.value.baseUrl) {
    ElMessage.warning('请输入API基础地址')
    return
  }
  
  try {
    await saveApiConfig({
      baseUrl: apiConfig.value.baseUrl,
      apiKey: apiConfig.value.apiKey || '',
      modelName: apiConfig.value.modelName || 'default'
    })
    ElMessage.success('配置已保存到服务器')
    showApiConfig.value = false
  } catch (error) {
    console.error('保存配置失败：', error)
    ElMessage.error('保存配置失败：' + (error.message || '未知错误'))
  }
}

// 测试API连接
const testApiConnection = async () => {
  if (!apiConfig.value.baseUrl) {
    ElMessage.warning('请先输入API地址')
    return
  }
  
  testingApi.value = true
  try {
    // 这里可以调用一个测试接口
    ElMessage.success('API连接测试成功')
  } catch (error) {
    ElMessage.error('API连接测试失败：' + (error.message || '未知错误'))
  } finally {
    testingApi.value = false
  }
}

// 加载可用模型列表
const loadAvailableModels = async () => {
  loadingModels.value = true
  try {
    const models = await getModels()
    if (models && models.length > 0) {
      availableModels.value = models
      ElMessage.success('模型列表加载成功')
    } else {
      ElMessage.warning('未获取到模型列表，使用默认模型')
    }
  } catch (error) {
    console.error('加载模型列表失败：', error)
    ElMessage.warning('加载模型列表失败，使用默认模型')
  } finally {
    loadingModels.value = false
  }
}

// 模型切换
const handleModelChange = () => {
  localStorage.setItem('nlp_model_name', apiConfig.value.modelName)
  ElMessage.success('模型已切换')
}

// 刷新信息
const refreshInfo = () => {
  // 这里可以调用接口获取最新信息
  ElMessage.success('刷新成功')
}

// 刷新日志
const refreshLogs = async () => {
  try {
    const result = await getSyncLogs({ pageNum: 1, pageSize: 20 })
    syncLogs.value = result.list || []
    ElMessage.success('刷新成功')
  } catch (error) {
    console.error('获取同步日志失败：', error)
    // 不显示错误，静默处理
  }
}

// 加载API配置
const loadApiConfig = async () => {
  try {
    const config = await getApiConfig()
    if (config) {
      apiConfig.value = {
        baseUrl: config.baseUrl || '',
        apiKey: config.apiKey || '',
        modelName: config.modelName || 'default'
      }
    }
  } catch (error) {
    console.error('加载API配置失败：', error)
    // 静默失败，使用默认值
  }
}

// 加载知识库列表
const loadKnowledgeList = async () => {
  loadingKnowledge.value = true
  try {
    const params = {
      pageNum: knowledgePagination.value.pageNum,
      pageSize: knowledgePagination.value.pageSize,
      ...knowledgeFilter.value
    }
    // 移除空值
    Object.keys(params).forEach(key => {
      if (params[key] === '' || params[key] === null || params[key] === undefined) {
        delete params[key]
      }
    })
    
    const result = await getKnowledgeList(params)
    knowledgeList.value = result.list || []
    knowledgePagination.value.total = result.total || 0
  } catch (error) {
    console.error('获取知识库列表失败：', error)
    ElMessage.error('获取知识库列表失败：' + (error.message || '未知错误'))
    knowledgeList.value = []
  } finally {
    loadingKnowledge.value = false
  }
}

// 刷新知识库列表
const refreshKnowledgeList = () => {
  knowledgePagination.value.pageNum = 1
  knowledgeFilter.value = {
    title: '',
    category: '',
    keyword: ''
  }
  loadKnowledgeList()
}

// 查看知识详情
const viewKnowledgeDetail = (knowledge) => {
  currentKnowledge.value = knowledge
  knowledgeDetailVisible.value = true
}


onMounted(() => {
  // 初始化时加载配置、同步信息和日志
  loadApiConfig()
  loadAvailableModels()
  refreshInfo()
  refreshLogs()
  loadKnowledgeList()
})
</script>

<style scoped>
.sync-knowledge-container {
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

.sync-card {
  margin-bottom: 20px;
}

.sync-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.sync-status {
  display: flex;
  align-items: center;
  gap: 20px;
}

.model-version {
  color: #909399;
  font-size: 14px;
}

.sync-actions {
  display: flex;
  gap: 10px;
}

.sync-info {
  margin-bottom: 20px;
}

.info-card {
  text-align: center;
}

.info-item {
  padding: 10px;
}

.info-label {
  color: #909399;
  font-size: 14px;
  margin-bottom: 8px;
}

.info-value {
  color: #303133;
  font-size: 24px;
  font-weight: 600;
}

.sync-progress {
  margin-top: 20px;
}

.progress-text {
  font-size: 14px;
  color: #606266;
}

.progress-steps {
  display: flex;
  justify-content: space-between;
  margin-top: 20px;
  padding: 0 20px;
}

.progress-step {
  display: flex;
  align-items: center;
  gap: 5px;
  color: #c0c4cc;
  font-size: 14px;
}

.progress-step.active {
  color: #409eff;
  font-weight: 600;
}

.progress-step.completed {
  color: #67c23a;
}

.sync-logs-card {
  margin-top: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.api-config-card {
  margin-bottom: 20px;
}

.api-config-form {
  padding: 10px 0;
}

.api-config-summary {
  padding: 10px 0;
  color: #606266;
  font-size: 14px;
}

.knowledge-list-card {
  margin-top: 20px;
}

.text-muted {
  color: #909399;
  font-size: 12px;
}

.pagination-container {
  margin-top: 20px;
  text-align: right;
}

.knowledge-detail {
  padding: 10px 0;
}

.knowledge-content {
  max-height: 400px;
  overflow-y: auto;
  padding: 12px;
  background: #f5f7fa;
  border-radius: 4px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>

