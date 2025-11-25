<template>
  <div class="rule-config-container">
    <div class="page-header">
      <div class="header-left">
        <h2>
          <el-icon><Setting /></el-icon>
          规则配置与版本管理
        </h2>
        <p class="page-desc">管理健康规则配置，查看版本历史，关联模板</p>
      </div>
      <div class="header-right">
        <el-button type="danger" :icon="Delete" @click="handleBatchDelete" :disabled="selectedRules.length === 0">
          批量删除
        </el-button>
        <el-button type="success" :icon="DocumentCopy" @click="handleBatchBind">批量关联</el-button>
        <el-button type="info" :icon="Document" @click="handleShowLogs">操作日志</el-button>
      </div>
    </div>

    <!-- 筛选表单 -->
    <el-card class="filter-card">
      <el-form :inline="true">
        <el-form-item label="指标分类">
          <el-select v-model="filterForm.category" placeholder="全部" clearable style="width: 150px">
            <el-option
              v-for="cat in categories"
              :key="cat"
              :label="cat"
              :value="cat"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="filterForm.status" placeholder="全部" clearable style="width: 150px">
            <el-option label="启用" :value="1" />
            <el-option label="禁用" :value="0" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="handleSearch">查询</el-button>
          <el-button :icon="Refresh" @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 规则表格 -->
    <el-card class="table-card">
      <div style="margin-bottom: 10px">
        <span style="color: #909399; font-size: 14px">
          共 {{ total }} 条规则
          <span v-if="selectedRules.length > 0" style="margin-left: 10px; color: #409EFF">
            （已选择 {{ selectedRules.length }} 条）
          </span>
        </span>
        <el-button 
          v-if="selectedRules.length > 0" 
          type="text" 
          size="small" 
          @click="clearSelection"
          style="margin-left: 10px; color: #909399"
        >
          清空选择
        </el-button>
      </div>
      <el-table
        ref="tableRef"
        v-loading="loading"
        :data="ruleList"
        stripe
        row-key="ruleId"
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="55" :reserve-selection="true" />
        <el-table-column type="index" label="序号" width="80" :index="getIndex" />
        <el-table-column prop="ruleName" label="规则名称" width="150" />
        <el-table-column prop="indicatorName" label="指标名称" width="150" />
        <el-table-column prop="category" label="指标分类" width="120" />
        <el-table-column prop="thresholdValue" label="阈值" width="120">
          <template #default="{ row }">
            {{ row.thresholdValue }} {{ row.thresholdUnit || '' }}
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-switch
              v-model="row.status"
              :active-value="1"
              :inactive-value="0"
              active-color="#409EFF"
              inactive-color="#C0CCDA"
              @change="handleStatusChange(row)"
            />
          </template>
        </el-table-column>
        <el-table-column prop="effectWay" label="生效方式" width="120">
          <template #default="{ row }">
            <el-tag :type="row.effectWay === 1 ? 'success' : row.effectWay === 2 ? 'warning' : 'danger'">
              {{ row.effectWay === 1 ? '即时生效' : row.effectWay === 2 ? '定时生效' : row.effectWay === 3 ? '停止生效' : '未知' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="templates" label="关联模板" width="200">
          <template #default="{ row }">
            <div v-if="row.templates && row.templates.length > 0" style="display: flex; flex-wrap: wrap; gap: 4px;">
              <el-tag
                v-for="template in row.templates"
                :key="template.id"
                size="small"
                closable
                @close="handleUnbindTemplate(row, template)"
                style="margin-right: 4px"
              >
                {{ template.name }}
              </el-tag>
            </div>
            <span v-else style="color: #909399">未关联</span>
          </template>
        </el-table-column>
        <el-table-column prop="sourceUrl" label="来源" width="150">
          <template #default="{ row }">
            <el-link
              v-if="row.sourceUrl"
              :href="row.sourceUrl"
              target="_blank"
              type="primary"
            >
              <el-icon><Link /></el-icon>
              卫健委
            </el-link>
            <span v-else style="color: #909399">自定义</span>
          </template>
        </el-table-column>
        <el-table-column prop="authorityExplanation" label="权威解释" show-overflow-tooltip>
          <template #default="{ row }">
            <el-tooltip
              v-if="row.authorityExplanation"
              :content="row.authorityExplanation"
              placement="top"
            >
              <div class="text-ellipsis">{{ row.authorityExplanation }}</div>
            </el-tooltip>
            <span v-else style="color: #909399">无</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="320" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="handleViewDetail(row)">
              详情
            </el-button>
            <el-button type="info" link size="small" @click="handleViewVersions(row)">
              版本
            </el-button>
            <el-button type="success" link size="small" :icon="DocumentCopy" @click="handleCopy(row)">
              复制
            </el-button>
            <el-button type="primary" link size="small" @click="handleEdit(row)">
              编辑
            </el-button>
            <el-button type="danger" link size="small" @click="handleDelete(row)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      <div style="margin-top: 20px; text-align: right">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="total"
          layout="total, sizes, prev, pager, next, jumper"
          @current-change="handlePageChange"
          @size-change="handleSizeChange"
        />
      </div>
    </el-card>

    <!-- 版本历史表格 -->
    <el-card class="version-card" style="margin-top: 20px">
      <template #header>
        <div class="card-header">
          <span>版本历史</span>
        </div>
      </template>
      <el-table
        v-loading="versionLoading"
        :data="versionList"
        stripe
      >
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
        <el-table-column prop="effectTime" label="生效时间" width="180" />
        <el-table-column prop="createdAt" label="创建时间" width="180" />
        <el-table-column label="操作" width="250">
          <template #default="{ row }">
            <el-button 
              v-if="row.effectStatus === 1" 
              type="warning" 
              link 
              size="small" 
              @click="handleExpireVersion(row)"
            >
              过期
            </el-button>
            <el-button type="primary" link size="small" @click="handleRollback(row)">
              回滚
            </el-button>
            <el-button type="info" link size="small" @click="handleViewVersionLog(row)">
              操作日志
            </el-button>
            <el-button type="success" link size="small" @click="handleViewTemplates(row)">
              查看关联模板
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 操作日志弹窗 -->
    <OperateLogDialog v-model="logDialogVisible" />

    <!-- 编辑规则弹窗 -->
    <el-dialog v-model="editDialogVisible" title="编辑规则" width="600px">
      <el-form :model="editForm" label-width="120px" ref="editFormRef" :rules="addFormRules">
        <el-form-item label="规则名称" prop="ruleName">
          <el-input v-model="editForm.ruleName" placeholder="请输入规则名称（可选，默认使用指标名称）" />
        </el-form-item>
        <el-form-item label="指标名称" prop="indicatorName" required>
          <el-input v-model="editForm.indicatorName" placeholder="请输入指标名称" />
        </el-form-item>
        <el-form-item label="指标分类" prop="category">
          <el-select v-model="editForm.category" placeholder="请选择分类" style="width: 100%">
            <el-option
              v-for="cat in categories"
              :key="cat"
              :label="cat"
              :value="cat"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="阈值" prop="thresholdValue" required>
          <el-input
            v-model="editForm.thresholdValue"
            placeholder="请输入阈值"
            style="width: 200px"
          />
          <el-input
            v-model="editForm.thresholdUnit"
            placeholder="单位"
            style="width: 100px; margin-left: 8px"
          />
        </el-form-item>
        <el-form-item label="权威解释" prop="authorityExplanation">
          <el-input
            v-model="editForm.authorityExplanation"
            type="textarea"
            :rows="4"
            placeholder="请输入权威解释"
          />
        </el-form-item>
        <el-form-item label="生效方式" prop="effectWay">
          <el-radio-group v-model="editForm.effectWay">
            <el-radio :label="1">即时生效</el-radio>
            <el-radio :label="2">定时生效</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="editForm.effectWay === 2" label="生效时间" prop="effectTime">
          <el-date-picker
            v-model="editForm.effectTime"
            type="datetime"
            placeholder="选择生效时间"
            style="width: 100%"
            format="YYYY-MM-DD HH:mm:ss"
            value-format="YYYY-MM-DD HH:mm:ss"
          />
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-radio-group v-model="editForm.status">
            <el-radio :label="1">启用</el-radio>
            <el-radio :label="0">禁用</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleConfirmEdit">确定</el-button>
      </template>
    </el-dialog>

    <!-- 批量关联弹窗 -->
    <el-dialog v-model="bindDialogVisible" title="批量关联模板" width="600px">
      <el-form label-width="100px">
        <el-form-item label="操作类型">
          <el-radio-group v-model="bindForm.operateType">
            <el-radio label="bind">关联</el-radio>
            <el-radio label="unbind">解除关联</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="选择模板">
          <el-select
            v-model="bindForm.templateIds"
            multiple
            placeholder="请选择模板"
            style="width: 100%"
          >
            <el-option
              v-for="template in templateList"
              :key="template.id"
              :label="template.templateName"
              :value="template.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-alert type="info" :closable="false">
            将{{ bindForm.operateType === 'bind' ? '关联' : '解除关联' }} {{ selectedRules.length }} 个规则
          </el-alert>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="bindDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleConfirmBind" :loading="binding">
          确定
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Setting, Plus, Search, Refresh, DocumentCopy, Document, Link, Delete } from '@element-plus/icons-vue'
import { getCategories, bindTemplate, rollbackVersion, updateHealthRule, getHealthRuleList, deleteHealthRule, batchDeleteHealthRule, getRuleVersions, expireVersion } from '@/api/healthRule'
import { getTemplateList } from '@/api/rule'
import OperateLogDialog from '@/components/HealthRule/OperateLogDialog.vue'

const router = useRouter()

const loading = ref(false)
const versionLoading = ref(false)
const binding = ref(false)
const logDialogVisible = ref(false)
const bindDialogVisible = ref(false)

const filterForm = reactive({
  category: null,
  status: null // 改为状态筛选
})

const categories = ref([])
const ruleList = ref([])
const versionList = ref([])
const templateList = ref([])
const selectedRules = ref([])
const tableRef = ref(null)

// 分页相关
const currentPage = ref(1)
const pageSize = ref(20)
const total = ref(0)

const bindForm = reactive({
  operateType: 'bind',
  templateIds: []
})

// 表单验证规则
const addFormRules = {
  indicatorName: [
    { required: true, message: '请输入指标名称', trigger: 'blur' }
  ],
  thresholdValue: [
    { required: true, message: '请输入阈值', trigger: 'blur' }
  ]
}

// 状态切换
const handleStatusChange = async (row) => {
  const oldStatus = row.status === 1 ? 0 : 1 // 保存原状态
  const newStatus = row.status
  try {
    // 如果禁用规则，需要将生效方式改为停止生效（3）
    // 如果启用规则且当前是停止生效，恢复为即时生效（1）
    const updateData = {
      ruleId: row.ruleId,
      status: newStatus
    }
    
    if (newStatus === 0) {
      // 禁用时，生效方式改为停止生效
      updateData.effectWay = 3
    } else if (newStatus === 1 && row.effectWay === 3) {
      // 启用时，如果当前是停止生效，恢复为即时生效
      updateData.effectWay = 1
    }
    
    const result = await updateHealthRule(updateData)
    console.log('状态更新成功：', result)
    ElMessage.success(newStatus === 1 ? '规则已启用' : '规则已禁用')
    // 刷新数据，确保状态同步
    await loadData()
  } catch (err) {
    // 恢复原状态
    row.status = oldStatus
    console.error('状态更新失败：', err)
    if (err.response && err.response.data) {
      const errorMsg = err.response.data.message || err.response.data.error || '状态更新失败'
      ElMessage.error(errorMsg)
    } else if (err.message) {
      ElMessage.error(err.message)
    } else {
      ElMessage.error('状态更新失败，请稍后重试')
    }
  }
}

// 加载数据
const loadData = async () => {
  try {
    loading.value = true
    const params = {
      page: currentPage.value,
      limit: pageSize.value
    }
    
    if (filterForm.category) {
      params.category = filterForm.category
    }
    
    if (filterForm.status !== null && filterForm.status !== undefined) {
      params.status = filterForm.status
    }
    
    const result = await getHealthRuleList(params)
    
    if (result && result.data) {
      ruleList.value = result.data.list || []
      total.value = result.data.total || 0
    } else if (result && result.list) {
      ruleList.value = result.list
      total.value = result.total || result.list.length
    } else {
      ruleList.value = []
      total.value = 0
    }
    
    // 恢复当前页的选中状态（支持跨页选择）
    await nextTick()
    if (tableRef.value && selectedRules.value.length > 0) {
      const selectedIds = selectedRules.value.map(r => r.ruleId)
      ruleList.value.forEach(row => {
        if (selectedIds.includes(row.ruleId)) {
          tableRef.value.toggleRowSelection(row, true)
        } else {
          tableRef.value.toggleRowSelection(row, false)
        }
      })
    }
    
    // 加载版本历史（取第一条规则的版本）
    if (ruleList.value.length > 0) {
      loadVersionList(ruleList.value[0].ruleId)
    }
  } catch (err) {
    console.error('加载规则列表失败：', err)
    ruleList.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

// 分页变化
const handlePageChange = (page) => {
  currentPage.value = page
  loadData()
}

const handleSizeChange = (size) => {
  pageSize.value = size
  currentPage.value = 1
  loadData()
}

// 加载版本历史
const loadVersionList = async (ruleId) => {
  if (!ruleId) return
  
  try {
    versionLoading.value = true
    const result = await getRuleVersions(ruleId)
    console.log('版本列表API返回结果：', result)
    
    // 响应拦截器已经返回了data，所以result就是数据数组
    let versions = []
    if (Array.isArray(result)) {
      versions = result
    } else if (result && result.data) {
      versions = result.data
    } else if (result && Array.isArray(result.list)) {
      versions = result.list
    }
    
    console.log('解析后的版本列表：', versions)
    
    if (versions && versions.length > 0) {
      // 为每个版本添加ruleId，方便后续操作
      versionList.value = versions.map(v => ({
        ...v,
        ruleId: ruleId
      }))
      console.log('设置版本列表：', versionList.value)
    } else {
      versionList.value = []
      console.log('版本列表为空')
    }
  } catch (err) {
    console.error('加载版本历史失败：', err)
    versionList.value = []
  } finally {
    versionLoading.value = false
  }
}

// 查询
const handleSearch = () => {
  loadData()
}

// 重置
const handleReset = () => {
  filterForm.category = null
  filterForm.status = null
  currentPage.value = 1
  // 重置筛选时，清空选择
  selectedRules.value = []
  loadData()
}

// 查看版本
const handleViewVersions = (row) => {
  // 加载该规则的版本列表
  loadVersionList(row.ruleId)
  // 滚动到版本历史区域
  setTimeout(() => {
    const versionCard = document.querySelector('.version-card')
    if (versionCard) {
      versionCard.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, 100)
}

// 复制
const handleCopy = (row) => {
  // 打开复制对话框
}

// 删除
const handleDelete = async (row) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除规则"${row.ruleName || row.indicatorName}"吗？删除后无法恢复！`,
      '危险操作',
      {
        confirmButtonText: '确定删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    await deleteHealthRule(row.ruleId)
    ElMessage.success('删除成功')
    
    // 删除后清空选择，重新开始计数
    selectedRules.value = []
    // 清空表格选择状态
    if (tableRef.value) {
      tableRef.value.clearSelection()
    }
    
    // 如果不在第一页且当前页没有数据了，跳转回第一页
    if (currentPage.value > 1 && ruleList.value.length === 1) {
      currentPage.value = 1
    }
    
    loadData()
  } catch (err) {
    if (err !== 'cancel') {
      console.error('删除失败：', err)
      let errorMsg = ''
      
      // 提取错误消息
      if (err.response && err.response.data) {
        errorMsg = err.response.data.message || err.response.data.error || err.message || '删除失败'
      } else if (err.message) {
        errorMsg = err.message
      } else {
        errorMsg = '删除失败'
      }
      
      // 如果是版本相关的错误，提供查看版本和过期版本的选项
      if (errorMsg.includes('生效的版本') || errorMsg.includes('版本')) {
        try {
          // 加载该规则的版本列表
          const versionsResult = await getRuleVersions(row.ruleId)
          console.log('加载的版本列表：', versionsResult)
          
          // 响应拦截器已经返回了data，所以versionsResult就是数据数组
          let versions = []
          if (Array.isArray(versionsResult)) {
            versions = versionsResult
          } else if (versionsResult && versionsResult.data) {
            versions = versionsResult.data
          } else if (versionsResult && Array.isArray(versionsResult.list)) {
            versions = versionsResult.list
          }
          
          if (versions && versions.length > 0) {
            const activeVersions = versions.filter(v => v.effectStatus === 1)
            console.log('生效的版本：', activeVersions)
            
            if (activeVersions.length > 0) {
              const versionNumbers = activeVersions.map(v => v.versionNumber).join('、')
              await ElMessageBox.confirm(
                `该规则有 ${activeVersions.length} 个生效的版本，需要先过期这些版本才能删除。\n\n生效版本：${versionNumbers}\n\n是否现在查看并过期这些版本？`,
                '需要过期版本',
                {
                  confirmButtonText: '查看版本',
                  cancelButtonText: '取消',
                  type: 'warning',
                  dangerouslyUseHTMLString: false
                }
              )
              // 加载该规则的版本列表到版本历史表格
              await loadVersionList(row.ruleId)
              // 滚动到版本历史区域
              await nextTick()
              setTimeout(() => {
                const versionCard = document.querySelector('.version-card')
                if (versionCard) {
                  versionCard.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }
              }, 200)
              return
            }
          }
        } catch (versionErr) {
          console.error('加载版本列表失败：', versionErr)
          // 即使加载版本失败，也显示错误消息
          ElMessage.error(errorMsg)
        }
      } else {
        ElMessage.error(errorMsg)
      }
    }
  }
}

// 批量删除
const handleBatchDelete = async () => {
  if (selectedRules.value.length === 0) {
    ElMessage.warning('请先选择要删除的规则')
    return
  }
  
  try {
    await ElMessageBox.confirm(
      `确定要删除选中的 ${selectedRules.value.length} 条规则吗？删除后无法恢复！`,
      '危险操作',
      {
        confirmButtonText: '确定删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    // 确保ruleId是有效的数字
    const ruleIds = selectedRules.value
      .map(r => r.ruleId)
      .filter(id => id !== null && id !== undefined && !isNaN(id))
      .map(id => Number(id))
    
    if (ruleIds.length === 0) {
      ElMessage.error('没有有效的规则ID')
      return
    }
    
    console.log('批量删除规则ID：', ruleIds)
    
    const result = await batchDeleteHealthRule(ruleIds)
    console.log('批量删除结果：', result)
    
    if (result && result.data) {
      const { success, failed } = result.data
      if (failed && failed.length > 0) {
        // 显示失败原因
        const failedReasons = failed.map(f => f.reason || '未知错误').join('、')
        ElMessage.warning(`删除完成：成功 ${success.length} 条，失败 ${failed.length} 条。失败原因：${failedReasons}`)
        console.warn('删除失败的规则：', failed)
      } else {
        ElMessage.success(`成功删除 ${success.length} 条规则`)
      }
    } else {
      ElMessage.success(`成功删除 ${ruleIds.length} 条规则`)
    }
    
    // 删除后立即清空选择，重新开始计数
    selectedRules.value = []
    // 清空表格选择状态
    if (tableRef.value) {
      tableRef.value.clearSelection()
    }
    // 删除后跳转回第一页
    currentPage.value = 1
    // 刷新数据
    await loadData()
  } catch (err) {
    if (err !== 'cancel' && err !== 'close') {
      console.error('批量删除失败：', err)
      if (err.response && err.response.data) {
        const errorMsg = err.response.data.message || err.response.data.error || '批量删除失败'
        ElMessage.error(`批量删除失败：${errorMsg}`)
      } else if (err.message) {
        ElMessage.error(`批量删除失败：${err.message}`)
      } else {
        ElMessage.error('批量删除失败，请稍后重试')
      }
    }
  }
}

// 过期版本
const handleExpireVersion = async (version) => {
  try {
    await ElMessageBox.confirm(
      `确定要过期版本"${version.versionNumber}"吗？过期后该版本将不再生效。`,
      '确认操作',
      {
        confirmButtonText: '确定过期',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    // 从版本对象中获取ruleId
    const ruleId = version.ruleId
    if (!ruleId) {
      ElMessage.warning('无法找到对应的规则')
      return
    }
    
    // 确保versionId存在
    const versionId = version.versionId || version.version_id
    if (!versionId) {
      ElMessage.warning('版本ID不存在')
      return
    }
    
    await expireVersion(ruleId, versionId)
    ElMessage.success('版本已过期')
    
    // 刷新版本列表
    loadVersionList(ruleId)
    // 刷新规则列表
    loadData()
  } catch (err) {
    if (err !== 'cancel') {
      console.error('过期版本失败：', err)
      if (err.response && err.response.data) {
        const errorMsg = err.response.data.message || err.response.data.error || '过期版本失败'
        ElMessage.error(errorMsg)
      } else {
        ElMessage.error('过期版本失败，请稍后重试')
      }
    }
  }
}

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

// 格式化日期
const formatDate = (dateStr) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN', { 
    year: 'numeric', 
    month: '2-digit', 
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// 序号计算（考虑分页）
const getIndex = (index) => {
  return (currentPage.value - 1) * pageSize.value + index + 1
}

// 清空选择
const clearSelection = () => {
  selectedRules.value = []
  if (tableRef.value) {
    tableRef.value.clearSelection()
  }
}

// 选择变化（支持跨页选择）
const handleSelectionChange = (selection) => {
  // 获取当前页的所有规则ID
  const currentPageRuleIds = ruleList.value.map(r => r.ruleId)
  
  // 移除当前页之前选择的规则（如果它们不在当前页）
  const otherPageRules = selectedRules.value.filter(r => 
    !currentPageRuleIds.includes(r.ruleId)
  )
  
  // 合并其他页的选择和当前页的选择，并去重
  const allSelected = [...otherPageRules, ...selection]
  const uniqueSelected = []
  const seenIds = new Set()
  
  for (const rule of allSelected) {
    if (rule.ruleId && !seenIds.has(rule.ruleId)) {
      seenIds.add(rule.ruleId)
      uniqueSelected.push(rule)
    }
  }
  
  selectedRules.value = uniqueSelected
  
  console.log('已选择规则：', selectedRules.value.length, '条（跨页累计，已去重）')
}

// 取消关联模板
const handleUnbindTemplate = async (row, template) => {
  try {
    await ElMessageBox.confirm(
      `确定要取消规则"${row.ruleName || row.indicatorName}"与模板"${template.name}"的关联吗？`,
      '确认操作',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    await bindTemplate({
      operateType: 'unbind',
      ruleIds: [row.ruleId],
      templateIds: [template.id]
    })
    
    ElMessage.success('取消关联成功')
    // 刷新数据
    loadData()
  } catch (err) {
    if (err !== 'cancel') {
      console.error('取消关联失败：', err)
      if (err.response && err.response.data) {
        const errorMsg = err.response.data.message || err.response.data.error || '取消关联失败'
        ElMessage.error(errorMsg)
      } else {
        ElMessage.error('取消关联失败，请稍后重试')
      }
    }
  }
}

// 查看详情
const handleViewDetail = (row) => {
  if (!row || !row.ruleId) {
    ElMessage.warning('规则信息不完整')
    return
  }
  // 跳转到详情页，使用规则ID作为参数
  router.push({
    name: 'HealthRuleDetail',
    params: { id: row.ruleId }
  })
}

// 编辑规则对话框
const editDialogVisible = ref(false)
const editFormRef = ref(null)
const editForm = reactive({
  ruleId: null,
  ruleName: '',
  indicatorName: '',
  category: '',
  thresholdValue: '',
  thresholdUnit: '',
  authorityExplanation: '',
  effectWay: 1,
  effectTime: null,
  status: 1 // 新增状态字段
})

// 编辑
const handleEdit = (row) => {
  if (!row || !row.ruleId) {
    ElMessage.warning('规则信息不完整')
    return
  }
  // 填充表单数据
  Object.assign(editForm, {
    ruleId: row.ruleId,
    ruleName: row.ruleName || '',
    indicatorName: row.indicatorName || '',
    category: row.category || '',
    thresholdValue: row.thresholdValue || '',
    thresholdUnit: row.thresholdUnit || '',
    authorityExplanation: row.authorityExplanation || '',
    effectWay: row.effectWay || 1,
    effectTime: row.effectTime || null,
    status: row.status !== undefined ? row.status : 1
  })
  editDialogVisible.value = true
}

// 确认编辑
const handleConfirmEdit = async () => {
  try {
    await editFormRef.value.validate()
    
    if (!editForm.indicatorName || !editForm.thresholdValue) {
      ElMessage.warning('请填写指标名称和阈值')
      return
    }
    
    const result = await updateHealthRule({
      ruleId: editForm.ruleId,
      ruleName: editForm.ruleName || editForm.indicatorName,
      indicatorName: editForm.indicatorName,
      category: editForm.category,
      thresholdValue: editForm.thresholdValue,
      thresholdUnit: editForm.thresholdUnit,
      authorityExplanation: editForm.authorityExplanation,
      effectWay: editForm.effectWay,
      effectTime: editForm.effectTime
    })
    
    ElMessage.success('更新成功')
    editDialogVisible.value = false
    setTimeout(() => {
      loadData()
    }, 500)
  } catch (err) {
    if (err !== false) {
      console.error('更新失败：', err)
      if (err.response && err.response.data) {
        const errorMsg = err.response.data.message || err.response.data.error || '更新失败'
        ElMessage.error(errorMsg)
      } else if (err.message) {
        ElMessage.error(err.message)
      } else {
        ElMessage.error('更新失败，请稍后重试')
      }
    }
  }
}

// 批量关联
const handleBatchBind = () => {
  if (selectedRules.value.length === 0) {
    ElMessage.warning('请先选择规则')
    return
  }
  bindDialogVisible.value = true
}

// 确认批量关联
const handleConfirmBind = async () => {
  if (!bindForm.templateIds || bindForm.templateIds.length === 0) {
    ElMessage.warning('请选择模板')
    return
  }
  
  try {
    binding.value = true
    const result = await bindTemplate({
      operateType: bindForm.operateType,
      ruleIds: selectedRules.value.map(r => r.ruleId),
      templateIds: bindForm.templateIds
    })
    
    ElMessage.success(`${bindForm.operateType === 'bind' ? '关联' : '解除关联'}成功`)
    bindDialogVisible.value = false
    // 清空选择
    selectedRules.value = []
    // 刷新数据以显示关联的模板
    loadData()
  } catch (err) {
    if (err.message) {
      ElMessage.error(err.message)
    }
  } finally {
    binding.value = false
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
      ruleId: version.ruleId,
      targetVersionId: version.versionId
    })
    
    ElMessage.success('回滚成功')
    loadData()
  } catch (err) {
    if (err !== 'cancel' && err.message) {
      ElMessage.error(err.message)
    }
  }
}

// 查看操作日志
const handleViewVersionLog = () => {
  logDialogVisible.value = true
}

// 显示操作日志
const handleShowLogs = () => {
  logDialogVisible.value = true
}

// 查看关联模板
const handleViewTemplates = (version) => {
  // 打开关联模板弹窗
}

onMounted(() => {
  getCategories().then(result => {
    // 处理返回的数据格式
    if (result && result.data) {
      categories.value = Array.isArray(result.data) ? result.data : []
    } else if (Array.isArray(result)) {
      categories.value = result
    } else {
      categories.value = []
    }
  }).catch(err => {
    console.error('获取分类失败：', err)
    categories.value = []
  })
  getTemplateList().then(result => {
    // 处理返回的数据格式
    if (result && result.data) {
      templateList.value = Array.isArray(result.data) ? result.data : []
    } else if (Array.isArray(result)) {
      templateList.value = result
    } else {
      templateList.value = []
    }
  }).catch(err => {
    console.error('获取模板列表失败：', err)
    templateList.value = []
  })
  loadData()
})

// 监听页面可见性变化，当页面重新可见时刷新数据（用于Excel导入后返回页面时刷新）
const handleVisibilityChange = () => {
  if (!document.hidden) {
    loadData()
  }
}

// 监听storage事件，用于跨标签页通信和当前标签页的导入通知
const handleStorageChange = (e) => {
  if (e.key === 'healthRuleImported' && e.newValue) {
    loadData()
    localStorage.removeItem('healthRuleImported')
  }
}

onMounted(() => {
  document.addEventListener('visibilitychange', handleVisibilityChange)
  window.addEventListener('storage', handleStorageChange)
})

onUnmounted(() => {
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  window.removeEventListener('storage', handleStorageChange)
})
</script>

<style scoped>
.rule-config-container {
  padding: 20px;
  background: #fff;
  min-height: calc(100vh - 60px);
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
}

.header-left h2 {
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

.table-card {
  margin-bottom: 20px;
}

.text-ellipsis {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>

