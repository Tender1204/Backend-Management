<template>
  <div class="pagination-container">
    <el-pagination
      v-model:current-page="currentPage"
      v-model:page-size="pageSize"
      :page-sizes="pageSizes"
      :total="total"
      :layout="layout"
      @size-change="handleSizeChange"
      @current-change="handleCurrentChange"
    />
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  total: {
    type: Number,
    required: true,
    default: 0
  },
  page: {
    type: Number,
    default: 1
  },
  limit: {
    type: Number,
    default: 10
  },
  pageSizes: {
    type: Array,
    default: () => [10, 20, 50, 100]
  },
  layout: {
    type: String,
    default: 'total, sizes, prev, pager, next, jumper'
  }
})

const emit = defineEmits(['update:page', 'update:limit', 'change'])

const currentPage = ref(props.page)
const pageSize = ref(props.limit)

// 监听props变化
watch(() => props.page, (val) => {
  currentPage.value = val
})

watch(() => props.limit, (val) => {
  pageSize.value = val
})

// 每页条数改变
const handleSizeChange = (val) => {
  pageSize.value = val
  emit('update:limit', val)
  emit('change', {
    page: currentPage.value,
    limit: val
  })
}

// 当前页改变
const handleCurrentChange = (val) => {
  currentPage.value = val
  emit('update:page', val)
  emit('change', {
    page: val,
    limit: pageSize.value
  })
}
</script>

<style scoped>
.pagination-container {
  display: flex;
  justify-content: flex-end;
  margin-top: 20px;
  padding: 20px 0;
}
</style>

