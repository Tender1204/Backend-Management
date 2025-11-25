<template>
  <div class="content-edit-container">
    <div class="page-header">
      <h2>
        <el-icon><Document /></el-icon>
        {{ isEdit ? '编辑内容' : '新增内容' }}
      </h2>
      <p class="page-desc">{{ isEdit ? '修改健康科普内容信息' : '创建新的健康科普内容' }}</p>
    </div>

    <el-card>
      <el-form
        ref="formRef"
        :model="formData"
        :rules="formRules"
        label-width="100px"
        class="content-form"
      >
        <el-form-item label="标题" prop="title">
          <el-input
            v-model="formData.title"
            placeholder="请输入内容标题"
            maxlength="200"
            show-word-limit
            style="width: 600px"
          />
        </el-form-item>

        <el-form-item label="分类" prop="categoryId">
          <el-select
            v-model="formData.categoryId"
            placeholder="请选择分类"
            style="width: 300px"
          >
            <el-option
              v-for="category in categories"
              :key="category.id"
              :label="category.category_name"
              :value="category.id"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="标签" prop="tagIds">
          <el-select
            ref="tagSelectRef"
            v-model="formData.tagIds"
            multiple
            placeholder="请选择标签（可多选）"
            style="width: 600px"
            @change="handleTagChange"
            @visible-change="handleTagVisibleChange"
          >
            <el-option
              v-for="tag in tags"
              :key="tag.id"
              :label="tag.tag_name"
              :value="tag.id"
            />
            <template #tag="{ item, close }">
              <el-tag
                v-if="item && item.value"
                closable
                @close="close"
                style="margin-right: 4px; margin-bottom: 2px"
                type="info"
                effect="plain"
              >
                {{ item.label }}
              </el-tag>
            </template>
          </el-select>
        </el-form-item>

        <el-form-item label="封面图片" prop="coverImage">
          <el-input
            v-model="formData.coverImage"
            placeholder="请输入封面图片URL"
            style="width: 600px"
          />
          <div class="form-tip">支持图片URL链接</div>
        </el-form-item>

        <el-form-item label="摘要" prop="summary">
          <el-input
            v-model="formData.summary"
            type="textarea"
            :rows="3"
            placeholder="请输入内容摘要"
            maxlength="500"
            show-word-limit
            style="width: 600px"
          />
        </el-form-item>

        <el-form-item label="正文内容" prop="content">
          <div style="width: 100%; max-width: 900px">
            <!-- 富文本编辑器：需要安装 @vueup/vue-quill -->
            <!-- 安装命令：npm install @vueup/vue-quill quill -->
            <!-- 
            <QuillEditor
              v-model:content="formData.content"
              contentType="html"
              theme="snow"
              :toolbar="editorToolbar"
              style="height: 400px; margin-bottom: 50px"
            />
            -->
            <!-- 临时使用文本域，实际项目中请使用上面的QuillEditor -->
            <el-input
              v-model="formData.content"
              type="textarea"
              :rows="15"
              placeholder="请输入正文内容（支持HTML格式）"
              style="width: 100%"
            />
            <div class="form-tip">
              提示：当前使用文本域，实际项目中请安装 @vueup/vue-quill 并启用富文本编辑器
            </div>
          </div>
        </el-form-item>

        <el-form-item label="上架状态" prop="publishStatus">
          <el-radio-group v-model="formData.publishStatus">
            <el-radio :label="0">草稿</el-radio>
            <el-radio :label="1">已发布</el-radio>
            <el-radio :label="2">已下架</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item>
          <el-button type="primary" :icon="Check" @click="handleSubmit" :loading="submitting">
            {{ isEdit ? '保存' : '创建' }}
          </el-button>
          <el-button :icon="Close" @click="handleCancel">取消</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Document, Check, Close } from '@element-plus/icons-vue'
// 富文本编辑器：需要安装 @vueup/vue-quill 和 quill
// npm install @vueup/vue-quill quill
// 如果使用其他编辑器，请相应调整导入
// 这里使用简化的文本域，实际项目中请安装并配置富文本编辑器
import {
  getContentDetail,
  createContent,
  updateContent,
  getCategories
} from '@/api/content'
import { getTagList } from '@/api/user'

const router = useRouter()
const route = useRoute()

// 数据
const formRef = ref(null)
const tagSelectRef = ref(null)
const submitting = ref(false)
const categories = ref([])
const tags = ref([])
const contentId = computed(() => route.query.id)

const isEdit = computed(() => !!contentId.value)

const formData = reactive({
  title: '',
  categoryId: '',
  tagIds: [],
  coverImage: '',
  summary: '',
  content: '',
  publishStatus: 0
})

const formRules = {
  title: [
    { required: true, message: '请输入标题', trigger: 'blur' },
    { max: 200, message: '标题长度不能超过200个字符', trigger: 'blur' }
  ],
  categoryId: [
    { required: true, message: '请选择分类', trigger: 'change' }
  ],
  content: [
    { required: true, message: '请输入正文内容', trigger: 'blur' }
  ]
}

// 富文本编辑器工具栏配置（使用 @vueup/vue-quill 时）
const editorToolbar = [
  ['bold', 'italic', 'underline', 'strike'],
  ['blockquote', 'code-block'],
  [{ 'header': 1 }, { 'header': 2 }],
  [{ 'list': 'ordered' }, { 'list': 'bullet' }],
  [{ 'script': 'sub' }, { 'script': 'super' }],
  [{ 'indent': '-1' }, { 'indent': '+1' }],
  [{ 'direction': 'rtl' }],
  [{ 'size': ['small', false, 'large', 'huge'] }],
  [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
  [{ 'color': [] }, { 'background': [] }],
  [{ 'font': [] }],
  [{ 'align': [] }],
  ['clean'],
  ['link', 'image', 'video']
]

// 获取分类列表
const fetchCategories = async () => {
  try {
    const data = await getCategories()
    categories.value = data
  } catch (error) {
    console.error('获取分类列表失败：', error)
  }
}

// 获取标签列表
const fetchTags = async () => {
  try {
    const data = await getTagList()
    tags.value = data
  } catch (error) {
    console.error('获取标签列表失败：', error)
  }
}

// 获取内容详情
const fetchContentDetail = async () => {
  if (!contentId.value) return
  
  try {
    const data = await getContentDetail(contentId.value)
    formData.title = data.title || ''
    formData.categoryId = data.category_id || ''
    formData.tagIds = data.tag_ids || []
    formData.coverImage = data.cover_image || ''
    formData.summary = data.summary || ''
    formData.content = data.content || ''
    formData.publishStatus = data.publish_status || 0
  } catch (error) {
    console.error('获取内容详情失败：', error)
    ElMessage.error('获取内容详情失败')
    router.push('/content/list')
  }
}

// 提交
const handleSubmit = async () => {
  if (!formRef.value) return
  
  try {
    await formRef.value.validate()
    
    submitting.value = true
    
    const submitData = {
      title: formData.title,
      categoryId: formData.categoryId,
      tagIds: formData.tagIds,
      coverImage: formData.coverImage,
      summary: formData.summary,
      content: formData.content,
      publishStatus: formData.publishStatus
    }
    
    if (isEdit.value) {
      await updateContent(contentId.value, submitData)
      ElMessage.success('保存成功')
    } else {
      await createContent(submitData)
      ElMessage.success('创建成功')
    }
    
    router.push('/content/list')
  } catch (error) {
    if (error !== false) {
      console.error('提交失败：', error)
    }
  } finally {
    submitting.value = false
  }
}

// 标签选择变化（选择后自动收起下拉框）
const handleTagChange = () => {
  // 延迟一下，让选择操作完成后再收起
  nextTick(() => {
    if (tagSelectRef.value) {
      // 收起下拉框
      tagSelectRef.value.blur()
    }
  })
}

// 标签下拉框显示/隐藏变化
const handleTagVisibleChange = (visible) => {
  // 可以在这里添加其他逻辑
}

// 取消
const handleCancel = () => {
  router.push('/content/list')
}

// 初始化
onMounted(() => {
  fetchCategories()
  fetchTags()
  if (isEdit.value) {
    fetchContentDetail()
  }
})
</script>

<style scoped>
.content-edit-container {
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

.content-form {
  max-width: 1000px;
}

.form-tip {
  margin-top: 4px;
  color: #909399;
  font-size: 12px;
}

/* 富文本编辑器样式（使用 @vueup/vue-quill 时） */
/* :deep(.ql-editor) {
  min-height: 300px;
} */
</style>

