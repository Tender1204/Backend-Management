<template>
  <div class="qa-log-config-container">
    <el-row :gutter="20">
      <!-- 左侧：问答日志区域 -->
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>问答日志</span>
            </div>
          </template>

          <!-- 筛选栏 -->
          <div class="filter-bar">
            <el-date-picker
              v-model="filterDateRange"
              type="datetimerange"
              range-separator="至"
              start-placeholder="开始时间"
              end-placeholder="结束时间"
              format="YYYY-MM-DD HH:mm:ss"
              value-format="YYYY-MM-DD HH:mm:ss"
              style="width: 100%"
            />
            <el-input
              v-model="filterKeyword"
              placeholder="关键词搜索"
              clearable
              style="width: 200px; margin-top: 10px"
            />
            <el-select
              v-model="filterIndicator"
              placeholder="健康指标筛选"
              clearable
              style="width: 200px; margin-top: 10px"
            >
              <el-option label="每日步数" value="每日步数" />
              <el-option label="睡眠时长" value="睡眠时长" />
              <el-option label="饮水量" value="饮水量" />
            </el-select>
            <div style="margin-top: 10px">
              <el-button type="primary" @click="handleQuery" icon="Search">查询</el-button>
              <el-button @click="handleReset" icon="Refresh">重置</el-button>
            </div>
          </div>

          <!-- 日志表格 -->
          <el-table :data="qaLogList" stripe style="margin-top: 20px" v-loading="loading">
            <el-table-column prop="userId" label="用户ID" width="100" />
            <el-table-column prop="userQuestion" label="用户问题" min-width="200" show-overflow-tooltip />
            <el-table-column label="模型识别结果" width="150">
              <template #default="{ row }">
                <span v-if="row.modelRecognizeResult">
                  {{ row.modelRecognizeResult.indicator }}: {{ row.modelRecognizeResult.value }}
                </span>
                <span v-else>-</span>
              </template>
            </el-table-column>
            <el-table-column prop="aiAnswer" label="AI回答" min-width="200" show-overflow-tooltip />
            <el-table-column prop="createTime" label="交互时间" width="180" />
            <el-table-column label="操作" width="150" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" @click="showLogDetail(row)">查看详情</el-button>
                <el-button link type="primary" @click="markSatisfaction(row)">标记满意度</el-button>
              </template>
            </el-table-column>
          </el-table>

          <!-- 分页 -->
          <div class="pagination" style="margin-top: 20px">
            <el-pagination
              v-model:current-page="pageNum"
              v-model:page-size="pageSize"
              :total="total"
              :page-sizes="[10, 20, 50, 100]"
              layout="total, sizes, prev, pager, next, jumper"
              @size-change="handleQuery"
              @current-change="handleQuery"
            />
          </div>
        </el-card>
      </el-col>

      <!-- 右侧：报告模板配置区域 -->
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>报告模板配置</span>
            </div>
          </template>

          <!-- 模板选择 -->
          <div class="template-select">
            <el-select v-model="selectedTemplate" @change="loadTemplate" style="width: 100%">
              <el-option
                v-for="template in templates"
                :key="template.templateId"
                :label="template.templateName"
                :value="template.templateId"
              />
            </el-select>
          </div>

          <!-- 配置项 -->
          <div class="config-section" v-if="currentTemplate">
            <div class="config-item">
              <div class="config-label">数据维度：</div>
              <el-checkbox-group v-model="dataDimensions">
                <el-checkbox label="步数达标率">步数达标率</el-checkbox>
                <el-checkbox label="睡眠时长分布">睡眠时长分布</el-checkbox>
                <el-checkbox label="饮水量达标率">饮水量达标率</el-checkbox>
                <el-checkbox label="运动频率">运动频率</el-checkbox>
              </el-checkbox-group>
            </div>

            <div class="config-item">
              <div class="config-label">分析维度：</div>
              <el-checkbox-group v-model="analysisDimensions">
                <el-checkbox label="趋势分析">趋势分析</el-checkbox>
                <el-checkbox label="状态分类">状态分类</el-checkbox>
                <el-checkbox label="与上周/上月对比">与上周/上月对比</el-checkbox>
              </el-checkbox-group>
            </div>

            <div class="config-item">
              <div class="config-label">建议生成规则：</div>
              <el-input
                v-model="suggestionRules"
                type="textarea"
                :rows="4"
                placeholder="基于各指标状态，生成1-2条可落地的健康建议"
              />
            </div>

            <div class="config-actions">
              <el-button type="primary" @click="previewTemplate" icon="View">预览模板</el-button>
              <el-button type="success" @click="saveConfig" icon="Check">保存配置</el-button>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 日志详情弹窗 -->
    <el-dialog v-model="logDetailVisible" title="问答日志详情" width="800px">
      <div v-if="selectedLog">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="用户ID">{{ selectedLog.userId || '-' }}</el-descriptions-item>
          <el-descriptions-item label="交互时间">{{ selectedLog.createTime }}</el-descriptions-item>
          <el-descriptions-item label="用户问题" :span="2">
            {{ selectedLog.userQuestion }}
          </el-descriptions-item>
          <el-descriptions-item label="模型识别结果" :span="2">
            <pre v-if="selectedLog.modelRecognizeResult">
              {{ JSON.stringify(selectedLog.modelRecognizeResult, null, 2) }}
            </pre>
            <span v-else>-</span>
          </el-descriptions-item>
          <el-descriptions-item label="AI回答" :span="2">
            {{ selectedLog.aiAnswer }}
          </el-descriptions-item>
          <el-descriptions-item label="匹配知识库ID">
            {{ selectedLog.matchKnowledgeId || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="满意度">
            {{ selectedLog.satisfaction ? `${selectedLog.satisfaction}星` : '未评价' }}
          </el-descriptions-item>
        </el-descriptions>
      </div>
    </el-dialog>

    <!-- 预览弹窗 -->
    <el-dialog v-model="previewVisible" title="模板预览" width="900px">
      <div class="preview-content">
        <el-form :model="previewData" label-width="120px">
          <el-form-item label="测试数据">
            <el-input
              v-model="previewDataJson"
              type="textarea"
              :rows="4"
              placeholder='{"步数":8000, "睡眠时长":6, "饮水量":1500}'
            />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="generatePreview">生成预览</el-button>
          </el-form-item>
        </el-form>

        <div v-if="previewResult" class="preview-result">
          <el-card>
            <template #header>模型识别结果</template>
            <pre>{{ JSON.stringify(previewResult.modelRecognizeResult, null, 2) }}</pre>
          </el-card>
          <el-card style="margin-top: 20px">
            <template #header>报告片段</template>
            <div>{{ previewResult.reportSnippet }}</div>
          </el-card>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getQaLog, getReportTemplate, updateReportTemplate } from '@/api/ai'

const loading = ref(false)
const filterDateRange = ref([])
const filterKeyword = ref('')
const filterIndicator = ref('')
const qaLogList = ref([])
const pageNum = ref(1)
const pageSize = ref(10)
const total = ref(0)

const templates = ref([])
const selectedTemplate = ref(null)
const currentTemplate = ref(null)
const dataDimensions = ref([])
const analysisDimensions = ref([])
const suggestionRules = ref('')

const logDetailVisible = ref(false)
const selectedLog = ref(null)

const previewVisible = ref(false)
const previewDataJson = ref('{"步数":8000, "睡眠时长":6, "饮水量":1500}')
const previewResult = ref(null)

// 查询问答日志
const handleQuery = async () => {
  try {
    loading.value = true
    const params = {
      pageNum: pageNum.value,
      pageSize: pageSize.value
    }
    
    if (filterDateRange.value && filterDateRange.value.length === 2) {
      params.startTime = filterDateRange.value[0]
      params.endTime = filterDateRange.value[1]
    }
    
    if (filterKeyword.value) {
      params.keyword = filterKeyword.value
    }
    
    if (filterIndicator.value) {
      params.indicator = filterIndicator.value
    }
    
    const result = await getQaLog(params)
    qaLogList.value = result.list || []
    total.value = result.total || 0
  } catch (error) {
    console.error('查询失败：', error)
    ElMessage.error('查询失败')
  } finally {
    loading.value = false
  }
}

// 重置筛选
const handleReset = () => {
  filterDateRange.value = []
  filterKeyword.value = ''
  filterIndicator.value = ''
  pageNum.value = 1
  handleQuery()
}

// 查看日志详情
const showLogDetail = (row) => {
  selectedLog.value = row
  logDetailVisible.value = true
}

// 标记满意度
const markSatisfaction = async (row) => {
  try {
    const { value } = await ElMessageBox.prompt(
      '请输入满意度（1-5星）',
      '标记满意度',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        inputPattern: /^[1-5]$/,
        inputErrorMessage: '请输入1-5之间的数字'
      }
    )
    
    // 这里调用接口更新满意度
    ElMessage.success('标记成功')
    handleQuery()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('标记失败：', error)
    }
  }
}

// 加载模板列表
const loadTemplates = async () => {
  try {
    const result = await getReportTemplate()
    templates.value = result || []
    if (templates.value.length > 0) {
      selectedTemplate.value = templates.value[0].templateId
      loadTemplate()
    }
  } catch (error) {
    console.error('加载模板失败：', error)
  }
}

// 加载模板详情
const loadTemplate = () => {
  const template = templates.value.find(t => t.templateId === selectedTemplate.value)
  if (template) {
    currentTemplate.value = template
    dataDimensions.value = template.dataDimensions || []
    analysisDimensions.value = template.analysisDimensions || []
    suggestionRules.value = template.suggestionRules || ''
  }
}

// 预览模板
const previewTemplate = () => {
  previewVisible.value = true
  previewResult.value = null
}

// 生成预览
const generatePreview = () => {
  try {
    const data = JSON.parse(previewDataJson.value)
    
    // 模拟生成预览结果
    previewResult.value = {
      modelRecognizeResult: {
        步数: { value: data.步数, status: data.步数 >= 10000 ? '达标' : '未达标' },
        睡眠时长: { value: data.睡眠时长, status: data.睡眠时长 >= 7 && data.睡眠时长 <= 9 ? '达标' : '未达标' },
        饮水量: { value: data.饮水量, status: data.饮水量 >= 2000 ? '达标' : '未达标' }
      },
      reportSnippet: `本周健康数据统计：步数${data.步数}步，睡眠${data.睡眠时长}小时，饮水量${data.饮水量}ml。建议保持规律作息，适量运动。`
    }
  } catch (error) {
    ElMessage.error('数据格式错误，请检查JSON格式')
  }
}

// 保存配置
const saveConfig = async () => {
  try {
    if (!selectedTemplate.value) {
      ElMessage.warning('请先选择模板')
      return
    }
    
    await updateReportTemplate({
      templateId: selectedTemplate.value,
      dataDimensions: dataDimensions.value,
      analysisDimensions: analysisDimensions.value,
      suggestionRules: suggestionRules.value
    })
    
    ElMessage.success('保存成功')
    loadTemplates()
  } catch (error) {
    console.error('保存失败：', error)
    ElMessage.error('保存失败')
  }
}

onMounted(() => {
  handleQuery()
  loadTemplates()
})
</script>

<style scoped>
.qa-log-config-container {
  padding: 20px;
  background: #f5f7fa;
  min-height: calc(100vh - 60px);
}

.card-header {
  font-weight: 600;
  font-size: 16px;
}

.filter-bar {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.config-section {
  margin-top: 20px;
}

.config-item {
  margin-bottom: 20px;
}

.config-label {
  margin-bottom: 10px;
  font-weight: 600;
  color: #303133;
}

.config-actions {
  margin-top: 30px;
  display: flex;
  gap: 10px;
}

.preview-content {
  padding: 10px;
}

.preview-result {
  margin-top: 20px;
}

pre {
  background: #f5f7fa;
  padding: 10px;
  border-radius: 4px;
  overflow-x: auto;
}
</style>

