<template>
  <div class="rule-detail-container">
    <div class="page-header">
      <el-button :icon="ArrowLeft" @click="handleBack">返回</el-button>
      <h2>规则详情</h2>
    </div>

    <el-tabs v-model="activeTab">
      <!-- 基础信息 -->
      <el-tab-pane label="基础信息" name="basic">
        <el-card>
          <el-descriptions :column="2" border v-loading="loading">
            <el-descriptions-item label="规则名称">
              {{ ruleDetail.ruleName || '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="指标名称">
              {{ ruleDetail.indicatorName || '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="指标分类">
              {{ ruleDetail.category || '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="阈值">
              {{ ruleDetail.thresholdValue || '-' }} {{ ruleDetail.thresholdUnit || '' }}
            </el-descriptions-item>
            <el-descriptions-item label="生效方式">
              <el-tag :type="ruleDetail.effectWay === 1 ? 'success' : 'warning'">
                {{ ruleDetail.effectWay === 1 ? '即时生效' : (ruleDetail.effectWay === 2 ? '定时生效' : '-') }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="生效时间">
              {{ ruleDetail.effectTime || '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="来源链接" :span="2">
              <el-link
                v-if="ruleDetail.sourceUrl"
                :href="ruleDetail.sourceUrl"
                target="_blank"
                type="primary"
              >
                <el-icon><Link /></el-icon>
                {{ ruleDetail.sourceUrl }}
              </el-link>
              <span v-else style="color: #909399">自定义规则</span>
            </el-descriptions-item>
            <el-descriptions-item label="权威解释" :span="2">
              <div v-if="ruleDetail.authorityExplanation" v-html="ruleDetail.authorityExplanation" class="rich-text-content"></div>
              <span v-else style="color: #909399">无</span>
            </el-descriptions-item>
          </el-descriptions>
        </el-card>
      </el-tab-pane>

      <!-- 版本变更记录 -->
      <el-tab-pane label="版本变更记录" name="versions">
        <el-card>
          <el-table :data="versionList" stripe>
            <el-table-column type="index" label="序号" width="80" />
            <el-table-column prop="versionNumber" label="版本号" width="120" />
            <el-table-column prop="thresholdValue" label="阈值" width="150">
              <template #default="{ row }">
                {{ row.thresholdValue }} {{ row.thresholdUnit || '' }}
              </template>
            </el-table-column>
            <el-table-column prop="effectStatus" label="生效状态" width="120">
              <template #default="{ row }">
                <el-tag :type="getEffectStatusColor(row.effectStatus)">
                  {{ getEffectStatusName(row.effectStatus) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="变更内容对比" min-width="200">
              <template #default="{ row, $index }">
                <div v-if="$index > 0" class="change-diff">
                  <span v-if="row.changeDetail" class="diff-item">
                    <span class="diff-delete">- {{ getPreviousVersion($index)?.thresholdValue }}</span>
                    <span class="diff-add">+ {{ row.thresholdValue }}</span>
                  </span>
                </div>
                <span v-else style="color: #909399">初始版本</span>
              </template>
            </el-table-column>
            <el-table-column prop="createdAt" label="创建时间" width="180" />
            <el-table-column label="操作" width="120">
              <template #default="{ row }">
                <el-button type="primary" link size="small" @click="handleRollback(row)">
                  回滚
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>

      <!-- 关联模板 -->
      <el-tab-pane label="关联模板" name="templates">
        <el-card>
          <el-table :data="templateList" stripe>
            <el-table-column type="index" label="序号" width="80" />
            <el-table-column prop="templateName" label="模板名称" />
            <el-table-column prop="status" label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="row.status === 1 ? 'success' : 'danger'">
                  {{ row.status === 1 ? '启用' : '禁用' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="userCount" label="分配用户数" width="120" align="center">
              <template #default="{ row }">
                <el-tag type="info">{{ row.userCount || 0 }} 人</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="150">
              <template #default="{ row }">
                <el-button type="primary" link size="small" @click="handleViewTemplate(row)">
                  查看模板
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, Link } from '@element-plus/icons-vue'
import { rollbackVersion, getRuleDetail, getRuleVersions, getRuleTemplatesByVersion } from '@/api/healthRule'

const route = useRoute()
const router = useRouter()

const activeTab = ref('basic')
const ruleId = ref(null)
const loading = ref(false)

const ruleDetail = reactive({
  ruleName: '',
  indicatorName: '',
  category: '',
  thresholdValue: '',
  thresholdUnit: '',
  authorityExplanation: '',
  effectWay: 1,
  effectTime: null,
  sourceUrl: ''
})

const versionList = ref([])
const templateList = ref([])

// 获取生效状态名称
const getEffectStatusName = (status) => {
  const map = { 0: '未生效', 1: '已生效', 2: '已过期' }
  return map[status] || '未知'
}

// 获取生效状态颜色
const getEffectStatusColor = (status) => {
  const map = { 0: 'info', 1: 'success', 2: 'danger' }
  return map[status] || ''
}

// 获取上一个版本
const getPreviousVersion = (index) => {
  return versionList.value[index - 1] || null
}

// 加载规则详情
const loadDetail = async () => {
  try {
    loading.value = true
    ruleId.value = route.params.id || route.params.ruleId
    if (!ruleId.value) {
      ElMessage.error('规则ID不存在')
      return
    }
    
    // 获取规则基本信息
    const detailResult = await getRuleDetail(ruleId.value)
    console.log('规则详情查询结果：', detailResult)
    
    if (detailResult && detailResult.data) {
      const data = detailResult.data
      // 确保所有字段都有默认值
      Object.assign(ruleDetail, {
        ruleName: data.ruleName || data.rule_name || '',
        indicatorName: data.indicatorName || data.indicator_name || '',
        category: data.category || '',
        thresholdValue: data.thresholdValue || data.threshold_value || '',
        thresholdUnit: data.thresholdUnit || data.threshold_unit || '',
        authorityExplanation: data.authorityExplanation || data.authority_explanation || '',
        effectWay: data.effectWay !== undefined ? data.effectWay : (data.effect_way !== undefined ? data.effect_way : 1),
        effectTime: data.effectTime || data.effect_time || null,
        sourceUrl: data.sourceUrl || data.source_url || ''
      })
      console.log('规则详情数据：', ruleDetail)
    } else if (detailResult && !detailResult.data) {
      // 如果返回的数据不在data字段中，直接使用result
      const data = detailResult
      Object.assign(ruleDetail, {
        ruleName: data.ruleName || data.rule_name || '',
        indicatorName: data.indicatorName || data.indicator_name || '',
        category: data.category || '',
        thresholdValue: data.thresholdValue || data.threshold_value || '',
        thresholdUnit: data.thresholdUnit || data.threshold_unit || '',
        authorityExplanation: data.authorityExplanation || data.authority_explanation || '',
        effectWay: data.effectWay !== undefined ? data.effectWay : (data.effect_way !== undefined ? data.effect_way : 1),
        effectTime: data.effectTime || data.effect_time || null,
        sourceUrl: data.sourceUrl || data.source_url || ''
      })
    } else {
      ElMessage.warning('未获取到规则详情数据')
    }
    
    // 加载版本列表
    try {
      const versionResult = await getRuleVersions(ruleId.value)
      console.log('版本列表查询结果：', versionResult)
      if (versionResult && versionResult.data) {
        versionList.value = Array.isArray(versionResult.data) ? versionResult.data : []
      } else if (versionResult && Array.isArray(versionResult)) {
        versionList.value = versionResult
      } else {
        versionList.value = []
      }
      console.log('版本列表数据：', versionList.value)
    } catch (err) {
      console.warn('加载版本列表失败：', err)
      versionList.value = []
    }
    
    // 加载关联模板（如果有版本）
    if (versionList.value.length > 0) {
      try {
        const firstVersion = versionList.value[0]
        const versionId = firstVersion.versionId || firstVersion.version_id
        if (versionId) {
          const templateResult = await getRuleTemplatesByVersion(versionId)
          console.log('模板列表查询结果：', templateResult)
          if (templateResult && templateResult.data) {
            templateList.value = Array.isArray(templateResult.data) ? templateResult.data : []
          } else if (templateResult && Array.isArray(templateResult)) {
            templateList.value = templateResult
          } else {
            templateList.value = []
          }
          console.log('模板列表数据：', templateList.value)
        }
      } catch (err) {
        console.warn('加载模板列表失败：', err)
        templateList.value = []
      }
    }
  } catch (err) {
    console.error('加载规则详情失败：', err)
    if (err.response && err.response.data) {
      ElMessage.error(err.response.data.message || '加载规则详情失败')
    } else if (err.message) {
      ElMessage.error(`加载规则详情失败：${err.message}`)
    } else {
      ElMessage.error('加载规则详情失败')
    }
  } finally {
    loading.value = false
  }
}

// 回滚
const handleRollback = async (version) => {
  try {
    await ElMessageBox.prompt('请输入管理员密码确认回滚', '安全确认', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      inputType: 'password'
    })
    
    await rollbackVersion({
      ruleId: ruleId.value,
      targetVersionId: version.versionId
    })
    
    ElMessage.success('回滚成功')
    loadDetail()
  } catch (err) {
    if (err !== 'cancel' && err.message) {
      ElMessage.error(err.message)
    }
  }
}

// 查看模板
const handleViewTemplate = (template) => {
  router.push(`/rules/templates`)
}

// 返回
const handleBack = () => {
  router.back()
}

onMounted(() => {
  loadDetail()
})
</script>

<style scoped>
.rule-detail-container {
  padding: 20px;
  background: #fff;
  min-height: calc(100vh - 60px);
}

.page-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
}

.page-header h2 {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  color: #303133;
}

.rich-text-content {
  line-height: 1.6;
}

.change-diff {
  font-family: monospace;
  font-size: 12px;
}

.diff-item {
  display: block;
  margin: 4px 0;
}

.diff-delete {
  color: #f56c6c;
  text-decoration: line-through;
}

.diff-add {
  color: #67c23a;
  margin-left: 8px;
}
</style>

