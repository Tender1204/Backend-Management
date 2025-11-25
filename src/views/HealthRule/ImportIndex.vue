<template>
  <div class="import-container">
    <div class="page-header">
      <h2>
        <el-icon><Upload /></el-icon>
        卫健委指标导入
      </h2>
      <p class="page-desc">导入卫健委权威健康指标，支持Excel批量导入和手动录入</p>
    </div>

    <!-- 顶部操作栏 -->
    <el-card class="toolbar-card">
      <el-form :inline="true">
        <el-form-item label="导入模式">
          <el-select v-model="importMode" style="width: 150px">
            <el-option label="增量更新" value="increment" />
            <el-option label="全量覆盖" value="full" />
          </el-select>
        </el-form-item>
        <el-form-item label="版本说明">
          <el-input
            v-model="versionDesc"
            placeholder="请输入版本说明（可选）"
            style="width: 300px"
            maxlength="200"
            show-word-limit
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Download" @click="handleDownloadTemplate">
            下载模板
          </el-button>
          <el-button type="success" :icon="Refresh" @click="handleSyncDict">
            同步标准字典
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-row :gutter="20">
      <!-- 左侧：手动录入 -->
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>手动录入</span>
            </div>
          </template>
          <el-form :model="manualForm" label-width="120px" ref="manualFormRef">
            <el-form-item label="指标名称" prop="indicatorName" required>
              <el-input
                v-model="manualForm.indicatorName"
                placeholder="请输入指标名称"
                @blur="handleIndicatorNameBlur"
              />
            </el-form-item>
            <el-form-item label="指标分类" prop="category">
              <el-select
                v-model="manualForm.category"
                placeholder="请选择分类"
                style="width: 100%"
                @change="handleCategoryChange"
              >
                <el-option
                  v-for="cat in categories"
                  :key="cat"
                  :label="cat"
                  :value="cat"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="推荐阈值" prop="recommendThreshold">
              <el-input
                v-model="manualForm.recommendThreshold"
                placeholder="自动填充（可编辑）"
                :disabled="!manualForm.recommendThreshold"
              />
              <el-link
                v-if="manualForm.sourceUrl"
                :href="manualForm.sourceUrl"
                target="_blank"
                type="primary"
                style="margin-left: 8px"
              >
                查看官网
              </el-link>
            </el-form-item>
            <el-form-item label="阈值" prop="thresholdValue" required>
              <el-input
                v-model="manualForm.thresholdValue"
                placeholder="请输入阈值"
                style="width: 200px"
              />
              <el-input
                v-model="manualForm.thresholdUnit"
                placeholder="单位"
                style="width: 100px; margin-left: 8px"
              />
            </el-form-item>
            <el-form-item label="权威解释" prop="authorityExplanation">
              <el-input
                v-model="manualForm.authorityExplanation"
                type="textarea"
                :rows="4"
                placeholder="请输入权威解释"
              />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="handleManualSubmit" :loading="submitting">
                提交
              </el-button>
              <el-button @click="handleManualReset">重置</el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>

      <!-- 右侧：Excel上传 -->
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>Excel上传</span>
            </div>
          </template>
          <el-upload
            ref="uploadRef"
            :auto-upload="false"
            :on-change="handleFileChange"
            :file-list="fileList"
            accept=".xlsx,.xls"
            drag
          >
            <el-icon class="el-icon--upload"><upload-filled /></el-icon>
            <div class="el-upload__text">
              将文件拖到此处，或<em>点击上传</em>
            </div>
            <template #tip>
              <div class="el-upload__tip">
                只能上传Excel文件，且不超过10MB
              </div>
            </template>
          </el-upload>

          <!-- 数据预览表格（带分页） -->
          <div v-if="previewData.length > 0" class="preview-table">
            <el-table 
              :data="paginatedPreviewData" 
              stripe 
              max-height="300" 
              style="margin-top: 20px"
            >
              <el-table-column type="index" label="序号" width="60" :index="(index) => (previewPage - 1) * previewPageSize + index + 1" />
              <el-table-column prop="indicatorName" label="指标名称" width="150" />
              <el-table-column prop="thresholdValue" label="阈值" width="100" />
              <el-table-column prop="thresholdUnit" label="单位" width="80" />
              <el-table-column prop="category" label="分类" width="120" />
              <el-table-column label="状态" width="100">
                <template #default="{ row }">
                  <el-tag
                    :type="row.status === 'error' ? 'danger' : row.status === 'warning' ? 'warning' : 'success'"
                    size="small"
                  >
                    {{ row.statusText }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="reason" label="原因" show-overflow-tooltip />
            </el-table>
            <div style="margin-top: 10px; text-align: right">
              <el-pagination
                v-model:current-page="previewPage"
                v-model:page-size="previewPageSize"
                :page-sizes="[10, 20, 50, 100]"
                :total="previewData.length"
                layout="total, sizes, prev, pager, next, jumper"
                small
              />
            </div>
          </div>

          <div v-if="fileList.length > 0 || previewData.length > 0" style="margin-top: 20px">
            <el-button type="primary" @click="handleUploadSubmit" :loading="uploading" :disabled="previewData.length === 0">
              确认导入
            </el-button>
            <el-button @click="handleClearFile">清除</el-button>
            <span v-if="previewData.length > 0" style="margin-left: 10px; color: #909399; font-size: 12px">
              共 {{ previewData.length }} 条数据，请确认后点击"确认导入"
            </span>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 导入历史 -->
    <el-card style="margin-top: 20px">
      <template #header>
        <div class="card-header">
          <span>导入历史</span>
          <div>
            <el-button 
              type="danger" 
              link 
              :icon="Delete" 
              @click="handleBatchDeleteHistory" 
              :disabled="selectedHistory.length === 0"
              style="margin-right: 10px"
            >
              批量删除
            </el-button>
            <el-button type="primary" link :icon="Refresh" @click="loadImportHistory">
              刷新
            </el-button>
          </div>
        </div>
      </template>
      <el-table 
        v-loading="historyLoading" 
        :data="importHistory" 
        stripe
        @selection-change="handleHistorySelectionChange"
      >
        <el-table-column type="selection" width="55" />
        <el-table-column type="index" label="序号" width="80" />
        <el-table-column prop="versionDesc" label="版本说明" width="200" />
        <el-table-column prop="importMode" label="导入模式" width="120">
          <template #default="{ row }">
            <el-tag :type="row.importMode === 'full' ? 'danger' : 'success'">
              {{ row.importMode === 'full' ? '全量覆盖' : '增量更新' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="total" label="总数" width="80" />
        <el-table-column prop="success" label="成功" width="80" />
        <el-table-column prop="failed" label="失败" width="80" />
        <el-table-column prop="adminName" label="操作人" width="120" />
        <el-table-column prop="createdAt" label="操作时间" width="180" />
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="handleViewDetail(row)">
              查看详情
            </el-button>
            <el-button type="danger" link size="small" @click="handleDeleteHistory(row)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 导入详情弹窗 -->
    <el-dialog v-model="detailDialogVisible" title="导入详情" width="800px">
      <el-tabs v-model="activeTab">
        <el-tab-pane label="成功列表" name="success">
          <el-table :data="detailData.success" stripe max-height="400">
            <el-table-column prop="indicatorName" label="指标名称" />
            <el-table-column prop="ruleId" label="规则ID" />
            <el-table-column label="警告">
              <template #default="{ row }">
                <el-tag v-if="row.warning" type="warning" size="small">
                  {{ row.warning.message }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
        <el-tab-pane label="失败列表" name="failed">
          <el-table :data="detailData.failed" stripe max-height="400">
            <el-table-column prop="indicatorName" label="指标名称" />
            <el-table-column prop="reason" label="失败原因" />
          </el-table>
        </el-tab-pane>
        <el-tab-pane label="警告列表" name="warnings">
          <el-table :data="detailData.warnings" stripe max-height="400">
            <el-table-column prop="indicatorName" label="指标名称" />
            <el-table-column prop="message" label="警告信息" />
            <el-table-column prop="recommendValue" label="推荐值" />
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Upload, Download, Refresh, UploadFilled, Delete } from '@element-plus/icons-vue'
import {
  importHealthRule,
  importHealthRuleByExcel,
  parseExcel,
  downloadTemplate,
  getCategories,
  syncDict,
  getOperateLogs,
  deleteOperateLog,
  batchDeleteOperateLog
} from '@/api/healthRule'
import * as XLSX from 'xlsx'

const importMode = ref('increment')
const versionDesc = ref('')

// 预览数据分页
const previewPage = ref(1)
const previewPageSize = ref(20)
const paginatedPreviewData = computed(() => {
  const start = (previewPage.value - 1) * previewPageSize.value
  const end = start + previewPageSize.value
  return previewData.value.slice(start, end)
})
const submitting = ref(false)
const uploading = ref(false)
const historyLoading = ref(false)
const detailDialogVisible = ref(false)
const activeTab = ref('success')

const categories = ref([])
const fileList = ref([])
const previewData = ref([])
const importHistory = ref([])
const selectedHistory = ref([])
const detailData = reactive({
  success: [],
  failed: [],
  warnings: []
})

const manualFormRef = ref(null)
const uploadRef = ref(null)

const manualForm = reactive({
  indicatorName: '',
  category: '',
  recommendThreshold: '',
  sourceUrl: '',
  thresholdValue: '',
  thresholdUnit: '',
  authorityExplanation: ''
})

// 指标名称失焦，自动查询标准字典
const handleIndicatorNameBlur = async () => {
  if (!manualForm.indicatorName) return
  
  try {
    // 这里应该调用查询标准字典的接口
    // 暂时使用模拟数据
    const dict = await findDictByIndicatorName(manualForm.indicatorName)
    if (dict) {
      manualForm.recommendThreshold = dict.recommendThreshold
      manualForm.sourceUrl = dict.sourceUrl
    }
  } catch (err) {
    console.error('查询标准字典失败：', err)
  }
}

// 查找标准字典（模拟，实际应调用API）
const findDictByIndicatorName = async (indicatorName) => {
  // 这里应该调用后端API查询标准字典
  // 暂时返回null
  return null
}

// 分类变化
const handleCategoryChange = () => {
  // 可以根据分类自动填充一些默认值
}

// 手动提交
const handleManualSubmit = async () => {
  try {
    await manualFormRef.value.validate()
    
    submitting.value = true
    const result = await importHealthRule({
      importMode: importMode.value,
      rules: [{
        indicatorName: manualForm.indicatorName,
        category: manualForm.category,
        thresholdValue: manualForm.thresholdValue,
        thresholdUnit: manualForm.thresholdUnit,
        authorityExplanation: manualForm.authorityExplanation
      }],
      versionDesc: versionDesc.value || '手动录入'
    })
    
    // 处理返回结果
    if (result && result.data) {
      const data = result.data
      if (data.success > 0) {
        ElMessage.success(`导入成功：成功 ${data.success} 条，失败 ${data.failed || 0} 条`)
        handleManualReset()
        // 延迟刷新，确保数据库已写入
        setTimeout(() => {
          loadImportHistory()
          // 通知规则列表页面刷新
          localStorage.setItem('healthRuleImported', Date.now().toString())
          window.dispatchEvent(new Event('storage'))
        }, 1000)
      } else {
        ElMessage.warning(`导入失败：${data.failed || 0} 条失败`)
      }
    } else {
      ElMessage.success('导入成功')
      handleManualReset()
      setTimeout(() => {
        loadImportHistory()
        // 通知规则列表页面刷新
        localStorage.setItem('healthRuleImported', Date.now().toString())
        window.dispatchEvent(new Event('storage'))
      }, 1000)
    }
  } catch (err) {
    console.error('导入失败：', err)
    if (err.response && err.response.data && err.response.data.message) {
      ElMessage.error(err.response.data.message)
    } else if (err.message) {
      ElMessage.error(err.message)
    } else {
      ElMessage.error('导入失败，请稍后重试')
    }
  } finally {
    submitting.value = false
  }
}

// 重置手动表单
const handleManualReset = () => {
  manualFormRef.value?.resetFields()
  Object.assign(manualForm, {
    indicatorName: '',
    category: '',
    recommendThreshold: '',
    sourceUrl: '',
    thresholdValue: '',
    thresholdUnit: '',
    authorityExplanation: ''
  })
}

// 文件变化
const handleFileChange = async (file) => {
  try {
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json(worksheet)
        
        // 解析并预览数据
        previewData.value = jsonData.map((row, index) => {
          const item = {
            indicatorName: row['指标名称'] || row.indicatorName || '',
            thresholdValue: row['阈值'] || row.thresholdValue || '',
            thresholdUnit: row['单位'] || row.thresholdUnit || '',
            category: row['分类'] || row.category || '',
            status: 'success',
            statusText: '正常',
            reason: ''
          }
          
          // 校验数据
          if (!item.indicatorName) {
            item.status = 'error'
            item.statusText = '异常'
            item.reason = '指标名称不能为空'
          } else if (!item.thresholdValue) {
            item.status = 'error'
            item.statusText = '异常'
            item.reason = '阈值不能为空'
          }
          
          return item
        })
      } catch (err) {
        ElMessage.error('Excel解析失败：' + err.message)
      }
    }
    reader.readAsArrayBuffer(file.raw)
  } catch (err) {
    ElMessage.error('文件读取失败：' + err.message)
  }
}

// 上传提交
const handleUploadSubmit = async () => {
  if (fileList.value.length === 0 && previewData.value.length === 0) {
    ElMessage.warning('请先选择文件或等待数据预览')
    return
  }
  
  // 全量导入需要密码确认
  if (importMode.value === 'full') {
    try {
      await ElMessageBox.prompt('请输入管理员密码确认全量导入', '安全确认', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        inputType: 'password'
      })
    } catch {
      return
    }
  }
  
  try {
    uploading.value = true
    
    // 优先使用预览数据（更可靠）
    if (previewData.value.length > 0) {
      // 过滤掉异常数据
      const validData = previewData.value.filter(item => item.status !== 'error')
      
      if (validData.length === 0) {
        ElMessage.warning('没有有效数据可以导入，请检查Excel文件')
        return
      }
      
      const result = await importHealthRule({
        importMode: importMode.value,
        rules: validData.map(item => ({
          indicatorName: item.indicatorName,
          category: item.category || '其他',
          thresholdValue: item.thresholdValue,
          thresholdUnit: item.thresholdUnit || '',
          authorityExplanation: item.authorityExplanation || ''
        })),
        versionDesc: versionDesc.value || 'Excel导入'
      })
      
      if (result && result.data) {
        const data = result.data
        ElMessage.success(`导入完成：成功 ${data.success || 0} 条，失败 ${data.failed || 0} 条`)
        handleClearFile()
        // 立即刷新导入历史
        await loadImportHistory()
        // 延迟再次刷新，确保数据库已写入
        setTimeout(() => {
          loadImportHistory()
          // 通知规则列表页面刷新（使用localStorage作为跨页面通信）
          localStorage.setItem('healthRuleImported', Date.now().toString())
          // 触发storage事件（当前标签页）
          window.dispatchEvent(new Event('storage'))
        }, 1500)
      } else {
        ElMessage.success('导入完成')
        handleClearFile()
        setTimeout(() => {
          loadImportHistory()
          // 通知规则列表页面刷新
          localStorage.setItem('healthRuleImported', Date.now().toString())
          window.dispatchEvent(new Event('storage'))
        }, 1500)
      }
    } else if (fileList.value.length > 0) {
      // 使用文件上传方式
      const formData = new FormData()
      formData.append('file', fileList.value[0].raw)
      formData.append('importMode', importMode.value)
      formData.append('versionDesc', versionDesc.value)
      
      const result = await importHealthRuleByExcel(formData, importMode.value, versionDesc.value)
      
      if (result && result.data) {
        const data = result.data
        ElMessage.success(`导入完成：成功 ${data.success || 0} 条，失败 ${data.failed || 0} 条`)
      } else {
        ElMessage.success('导入完成')
      }
      handleClearFile()
      // 立即刷新导入历史
      await loadImportHistory()
      // 延迟再次刷新，确保数据库已写入
      setTimeout(() => {
        loadImportHistory()
        // 通知规则列表页面刷新
        localStorage.setItem('healthRuleImported', Date.now().toString())
        window.dispatchEvent(new Event('storage'))
      }, 1500)
    }
  } catch (err) {
    console.error('导入失败：', err)
    if (err.response && err.response.data) {
      const errorMsg = err.response.data.message || err.response.data.error || '导入失败'
      ElMessage.error(errorMsg)
    } else if (err.message) {
      ElMessage.error(err.message)
    } else {
      ElMessage.error('导入失败，请稍后重试')
    }
  } finally {
    uploading.value = false
  }
}

// 清除文件
const handleClearFile = () => {
  fileList.value = []
  previewData.value = []
  previewPage.value = 1 // 重置分页
  previewPageSize.value = 20 // 重置分页大小
  uploadRef.value?.clearFiles()
}

// 下载模板
const handleDownloadTemplate = async () => {
  try {
    const response = await downloadTemplate()
    // 检查响应类型
    let blob
    if (response instanceof Blob) {
      blob = response
    } else if (response.data instanceof Blob) {
      blob = response.data
    } else {
      throw new Error('响应格式错误')
    }
    
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = '卫健委指标导入模板.xlsx'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
    ElMessage.success('模板下载成功')
  } catch (err) {
    console.error('模板下载失败：', err)
    if (err.response && err.response.data) {
      const errorMsg = err.response.data.message || err.response.data.error || '模板下载失败'
      ElMessage.error(errorMsg)
    } else {
      ElMessage.error('模板下载失败：' + (err.message || '未知错误'))
    }
  }
}

// 同步标准字典
const handleSyncDict = async () => {
  try {
    await ElMessageBox.confirm('确定要同步标准字典吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    
    // 这里应该调用同步接口
    ElMessage.success('同步成功')
  } catch {
    // 用户取消
  }
}

// 加载导入历史
const loadImportHistory = async () => {
  try {
    historyLoading.value = true
    const result = await getOperateLogs({
      operateType: 'import',
      page: 1,
      limit: 20
    })
    
    console.log('导入历史查询结果：', result)
    
    // 处理返回的数据格式
    let logs = []
    if (result && result.data) {
      logs = result.data.list || []
    } else if (result && result.list) {
      logs = result.list
    } else if (Array.isArray(result)) {
      logs = result
    }
    
    console.log('解析后的日志列表：', logs)
    
    // 格式化数据，添加导入详情
    importHistory.value = logs.map(log => {
      let changeDetail = {}
      try {
        if (log.changeDetail) {
          changeDetail = typeof log.changeDetail === 'string' 
            ? JSON.parse(log.changeDetail) 
            : log.changeDetail
        } else if (log.change_detail) {
          changeDetail = typeof log.change_detail === 'string' 
            ? JSON.parse(log.change_detail) 
            : log.change_detail
        }
      } catch (e) {
        console.warn('解析changeDetail失败：', e, log.changeDetail || log.change_detail)
        changeDetail = {}
      }
      
      // 确保details结构正确
      let details = {
        success: [],
        failed: [],
        warnings: []
      }
      
      if (changeDetail.details) {
        details = {
          success: Array.isArray(changeDetail.details.success) ? changeDetail.details.success : [],
          failed: Array.isArray(changeDetail.details.failed) ? changeDetail.details.failed : [],
          warnings: Array.isArray(changeDetail.details.warnings) ? changeDetail.details.warnings : []
        }
      }
      
      return {
        ...log,
        versionDesc: changeDetail.versionDesc || changeDetail.version_desc || '',
        importMode: changeDetail.importMode || changeDetail.import_mode || 'increment',
        total: changeDetail.total || 0,
        success: changeDetail.success || 0,
        failed: changeDetail.failed || 0,
        warnings: changeDetail.warnings || 0,
        details: details,
        changeDetail: changeDetail // 保留原始changeDetail用于详情查看
      }
    })
    
    console.log('格式化后的导入历史：', importHistory.value)
  } catch (err) {
    console.error('加载导入历史失败：', err)
    // 即使失败也不影响页面使用，使用空数组
    importHistory.value = []
  } finally {
    historyLoading.value = false
  }
}

// 查看详情
const handleViewDetail = (row) => {
  console.log('查看详情，row数据：', row)
  
  // 重置详情数据
  detailData.success = []
  detailData.failed = []
  detailData.warnings = []
  
  // 优先从details获取
  if (row.details && (row.details.success || row.details.failed || row.details.warnings)) {
    detailData.success = Array.isArray(row.details.success) ? row.details.success : []
    detailData.failed = Array.isArray(row.details.failed) ? row.details.failed : []
    detailData.warnings = Array.isArray(row.details.warnings) ? row.details.warnings : []
  } else {
    // 尝试从changeDetail中解析
    try {
      let changeDetail = {}
      if (row.changeDetail) {
        changeDetail = typeof row.changeDetail === 'string' 
          ? JSON.parse(row.changeDetail) 
          : (row.changeDetail || {})
      } else if (row.change_detail) {
        changeDetail = typeof row.change_detail === 'string' 
          ? JSON.parse(row.change_detail) 
          : (row.change_detail || {})
      }
      
      console.log('解析后的changeDetail：', changeDetail)
      
      if (changeDetail.details) {
        // 从details对象中获取
        detailData.success = Array.isArray(changeDetail.details.success) ? changeDetail.details.success : []
        detailData.failed = Array.isArray(changeDetail.details.failed) ? changeDetail.details.failed : []
        detailData.warnings = Array.isArray(changeDetail.details.warnings) ? changeDetail.details.warnings : []
      } else {
        // 如果没有details，尝试从顶层获取
        detailData.success = Array.isArray(changeDetail.success) ? changeDetail.success : []
        detailData.failed = Array.isArray(changeDetail.failed) ? changeDetail.failed : []
        detailData.warnings = Array.isArray(changeDetail.warnings) ? changeDetail.warnings : []
      }
    } catch (e) {
      console.error('解析changeDetail失败：', e)
      detailData.success = []
      detailData.failed = []
      detailData.warnings = []
    }
  }
  
  console.log('详情数据：', detailData)
  console.log('成功数据数量：', detailData.success.length)
  console.log('失败数据数量：', detailData.failed.length)
  console.log('警告数据数量：', detailData.warnings.length)
  
  // 如果所有数据都为空，显示提示
  if (detailData.success.length === 0 && detailData.failed.length === 0 && detailData.warnings.length === 0) {
    ElMessage.warning('该导入记录没有详情数据')
    return
  }
  
  detailDialogVisible.value = true
  // 默认显示成功列表
  activeTab.value = 'success'
}

// 选择变化
const handleHistorySelectionChange = (selection) => {
  selectedHistory.value = selection
}

// 删除单个导入历史
const handleDeleteHistory = async (row) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除这条导入历史记录吗？删除后无法恢复！`,
      '危险操作',
      {
        confirmButtonText: '确定删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    await deleteOperateLog(row.logId)
    
    ElMessage.success('删除成功')
    // 从已选择列表中移除已删除的记录
    selectedHistory.value = selectedHistory.value.filter(h => h.logId !== row.logId)
    loadImportHistory()
  } catch (err) {
    if (err !== 'cancel') {
      console.error('删除导入历史失败：', err)
      if (err.response && err.response.data) {
        const errorMsg = err.response.data.message || err.response.data.error || '删除失败'
        ElMessage.error(errorMsg)
      } else {
        ElMessage.error('删除失败，请稍后重试')
      }
    }
  }
}

// 批量删除导入历史
const handleBatchDeleteHistory = async () => {
  if (selectedHistory.value.length === 0) {
    ElMessage.warning('请先选择要删除的记录')
    return
  }
  
  try {
    await ElMessageBox.confirm(
      `确定要删除选中的 ${selectedHistory.value.length} 条导入历史记录吗？删除后无法恢复！`,
      '危险操作',
      {
        confirmButtonText: '确定删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    const logIds = selectedHistory.value.map(h => h.logId).filter(id => id !== null && id !== undefined)
    
    if (logIds.length === 0) {
      ElMessage.warning('没有有效的记录ID')
      return
    }
    
    const result = await batchDeleteOperateLog(logIds)
    
    if (result && result.data) {
      const { success, failed } = result.data
      if (failed && failed.length > 0) {
        ElMessage.warning(`删除完成：成功 ${success.length} 条，失败 ${failed.length} 条`)
      } else {
        ElMessage.success(`成功删除 ${success.length} 条记录`)
      }
    } else {
      ElMessage.success(`成功删除 ${logIds.length} 条记录`)
    }
    
    selectedHistory.value = []
    // 删除后跳转回第一页（如果有分页）
    loadImportHistory()
  } catch (err) {
    if (err !== 'cancel') {
      console.error('批量删除导入历史失败：', err)
      if (err.response && err.response.data) {
        const errorMsg = err.response.data.message || err.response.data.error || '批量删除失败'
        ElMessage.error(errorMsg)
      } else {
        ElMessage.error('批量删除失败，请稍后重试')
      }
    }
  }
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
    // 即使失败也不影响页面使用，使用空数组
    categories.value = []
  })
  loadImportHistory()
})
</script>

<style scoped>
.import-container {
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

.toolbar-card {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.preview-table {
  margin-top: 20px;
}
</style>

