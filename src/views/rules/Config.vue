<template>
  <div class="rule-config-container">
    <div class="page-header">
      <h2>
        <el-icon><Setting /></el-icon>
        基础规则配置
      </h2>
      <p class="page-desc">配置饮水、饮食、运动、睡眠等健康规则的阈值参数</p>
    </div>

    <el-card>
      <el-form :model="configForm" label-width="180px" :rules="rules" ref="configFormRef">
        <!-- 饮水规则 -->
        <el-divider content-position="left">
          <span style="font-size: 16px; font-weight: 600">💧 饮水规则</span>
        </el-divider>
        <el-form-item label="每日推荐量" prop="water.dailyTarget">
          <el-input-number
            v-model="configForm.water.dailyTarget"
            :min="500"
            :max="10000"
            :step="100"
            style="width: 200px"
          />
          <span style="margin-left: 8px; color: #909399">ml（毫升）</span>
        </el-form-item>
        <el-form-item label="提醒间隔" prop="water.reminderInterval">
          <el-input-number
            v-model="configForm.water.reminderInterval"
            :min="30"
            :max="480"
            :step="30"
            style="width: 200px"
          />
          <span style="margin-left: 8px; color: #909399">分钟</span>
        </el-form-item>

        <!-- 饮食规则 -->
        <el-divider content-position="left">
          <span style="font-size: 16px; font-weight: 600">🍎 饮食规则</span>
        </el-divider>
        <el-form-item label="热量目标" prop="diet.calorieTarget">
          <el-input-number
            v-model="configForm.diet.calorieTarget"
            :min="800"
            :max="5000"
            :step="100"
            style="width: 200px"
          />
          <span style="margin-left: 8px; color: #909399">kcal（千卡）</span>
        </el-form-item>

        <!-- 运动规则 -->
        <el-divider content-position="left">
          <span style="font-size: 16px; font-weight: 600">🏃 运动规则</span>
        </el-divider>
        <el-form-item label="步数目标" prop="exercise.stepTarget">
          <el-input-number
            v-model="configForm.exercise.stepTarget"
            :min="1000"
            :max="50000"
            :step="500"
            style="width: 200px"
          />
          <span style="margin-left: 8px; color: #909399">步</span>
        </el-form-item>
        <el-form-item label="久坐时长" prop="exercise.sedentaryDuration">
          <el-input-number
            v-model="configForm.exercise.sedentaryDuration"
            :min="30"
            :max="180"
            :step="15"
            style="width: 200px"
          />
          <span style="margin-left: 8px; color: #909399">分钟</span>
        </el-form-item>

        <!-- 睡眠规则 -->
        <el-divider content-position="left">
          <span style="font-size: 16px; font-weight: 600">😴 睡眠规则</span>
        </el-divider>
        <el-form-item label="推荐时长" prop="sleep.recommendedDuration">
          <el-input-number
            v-model="configForm.sleep.recommendedDuration"
            :min="360"
            :max="600"
            :step="30"
            style="width: 200px"
          />
          <span style="margin-left: 8px; color: #909399">分钟（{{ Math.floor(configForm.sleep.recommendedDuration / 60) }}小时）</span>
        </el-form-item>

        <!-- 生效方式 -->
        <el-divider content-position="left">
          <span style="font-size: 16px; font-weight: 600">生效设置</span>
        </el-divider>
        <el-form-item label="生效方式" prop="effectiveType">
          <el-radio-group v-model="effectiveType">
            <el-radio label="immediate">即时生效</el-radio>
            <el-radio label="scheduled">定时生效（次日0点）</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item>
          <el-button type="primary" :icon="Check" @click="handleSave" :loading="saving">
            保存配置
          </el-button>
          <el-button :icon="Refresh" @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Setting, Check, Refresh } from '@element-plus/icons-vue'
import { getRuleConfig, updateRuleConfig } from '@/api/rule'

const configFormRef = ref(null)
const saving = ref(false)
const effectiveType = ref('immediate')

const configForm = reactive({
  water: {
    dailyTarget: 2000,
    reminderInterval: 120
  },
  diet: {
    calorieTarget: 2000
  },
  exercise: {
    stepTarget: 10000,
    sedentaryDuration: 60
  },
  sleep: {
    recommendedDuration: 480
  }
})

const originalConfig = ref(null)

const rules = {
  'water.dailyTarget': [
    { required: true, message: '请输入每日推荐量', trigger: 'blur' },
    { type: 'number', min: 500, max: 10000, message: '范围：500-10000ml', trigger: 'blur' }
  ],
  'water.reminderInterval': [
    { required: true, message: '请输入提醒间隔', trigger: 'blur' },
    { type: 'number', min: 30, max: 480, message: '范围：30-480分钟', trigger: 'blur' }
  ],
  'diet.calorieTarget': [
    { required: true, message: '请输入热量目标', trigger: 'blur' },
    { type: 'number', min: 800, max: 5000, message: '范围：800-5000kcal', trigger: 'blur' }
  ],
  'exercise.stepTarget': [
    { required: true, message: '请输入步数目标', trigger: 'blur' },
    { type: 'number', min: 1000, max: 50000, message: '范围：1000-50000步', trigger: 'blur' }
  ],
  'exercise.sedentaryDuration': [
    { required: true, message: '请输入久坐时长', trigger: 'blur' },
    { type: 'number', min: 30, max: 180, message: '范围：30-180分钟', trigger: 'blur' }
  ],
  'sleep.recommendedDuration': [
    { required: true, message: '请输入推荐时长', trigger: 'blur' },
    { type: 'number', min: 360, max: 600, message: '范围：360-600分钟', trigger: 'blur' }
  ]
}

// 加载配置
const loadConfig = async () => {
  try {
    const data = await getRuleConfig()
    if (data) {
      Object.assign(configForm, data)
      originalConfig.value = JSON.parse(JSON.stringify(data))
    }
  } catch (err) {
    console.error('加载配置失败：', err)
  }
}

// 保存配置
const handleSave = async () => {
  try {
    await configFormRef.value.validate()
    
    saving.value = true
    const result = await updateRuleConfig({
      ...configForm,
      effectiveType: effectiveType.value
    })
    
    ElMessage.success(
      effectiveType.value === 'immediate' 
        ? '配置已立即生效' 
        : '配置将在次日0点生效'
    )
    
    // 更新原始配置
    originalConfig.value = JSON.parse(JSON.stringify(configForm))
  } catch (err) {
    if (err.message) {
      ElMessage.error(err.message)
    }
  } finally {
    saving.value = false
  }
}

// 重置配置
const handleReset = () => {
  if (originalConfig.value) {
    Object.assign(configForm, originalConfig.value)
  } else {
    // 重置为默认值
    configForm.water = { dailyTarget: 2000, reminderInterval: 120 }
    configForm.diet = { calorieTarget: 2000 }
    configForm.exercise = { stepTarget: 10000, sedentaryDuration: 60 }
    configForm.sleep = { recommendedDuration: 480 }
  }
  effectiveType.value = 'immediate'
  configFormRef.value?.clearValidate()
}

onMounted(() => {
  loadConfig()
})
</script>

<style scoped>
.rule-config-container {
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

:deep(.el-divider) {
  margin: 24px 0;
}

:deep(.el-form-item) {
  margin-bottom: 20px;
}
</style>

