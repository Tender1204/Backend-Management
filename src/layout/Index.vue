<template>
  <div class="layout-container">
    <!-- 左侧菜单 -->
    <Menu />
    
    <!-- 右侧内容区 -->
    <div class="main-container">
      <!-- 顶部导航栏 -->
      <Header />
      
      <!-- 内容区域 -->
      <div class="content-wrapper">
        <router-view :key="$route.fullPath" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { useRoute } from 'vue-router'
import Menu from './Menu.vue'
import Header from './Header.vue'

const route = useRoute()
</script>

<style scoped>
.layout-container {
  display: flex;
  width: 100%;
  height: 100vh;
  overflow: hidden;
}

.main-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background-color: #f0f2f5;
}

.content-wrapper {
  flex: 1;
  padding: 0;
  overflow-y: auto;
  background-color: #f0f2f5;
  margin: 0;
  position: relative;
}
</style>

