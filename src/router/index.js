/**
 * Vue Router路由配置
 * 包含7大模块的路由映射
 */

import { createRouter, createWebHistory } from 'vue-router'
import Layout from '@/layout/Index.vue'

// 路由配置
const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: {
      title: '登录',
      requiresAuth: false // 不需要登录
    }
  },
  {
    path: '/profile',
    component: Layout,
    children: [
      {
        path: '',
        name: 'Profile',
        component: () => import('@/views/Profile.vue'),
        meta: {
          title: '个人信息',
          requiresAuth: true
        }
      }
    ]
  },
  {
    path: '/change-password',
    component: Layout,
    children: [
      {
        path: '',
        name: 'ChangePassword',
        component: () => import('@/views/ChangePassword.vue'),
        meta: {
          title: '修改密码',
          requiresAuth: true
        }
      }
    ]
  },
  {
    path: '/',
    component: Layout,
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/Dashboard.vue'),
        meta: {
          title: '控制台',
          icon: 'DataBoard',
          requiresAuth: true
        }
      }
    ]
  },
  {
    path: '/users',
    component: Layout,
    redirect: '/users/list',
    meta: {
      title: '用户管理',
      icon: 'User',
      requiresAuth: true
    },
    children: [
      {
        path: 'list',
        name: 'UserList',
        component: () => import('@/views/users/List.vue'),
        meta: {
          title: '用户列表',
          requiresAuth: true
        }
      },
      {
        path: 'tags',
        name: 'UserTags',
        component: () => import('@/views/users/Tags.vue'),
        meta: {
          title: '用户标签管理',
          requiresAuth: true
        }
      },
      {
        path: 'detail/:id',
        name: 'UserDetail',
        component: () => import('@/views/users/Detail.vue'),
        meta: {
          title: '用户详情',
          requiresAuth: true
        }
      }
    ]
  },
  {
    path: '/rules',
    component: Layout,
    redirect: '/rules/config',
    meta: {
      title: '健康规则管理',
      icon: 'Document',
      requiresAuth: true
    },
    children: [
      {
        path: 'config',
        name: 'RuleConfig',
        component: () => import('@/views/rules/Config.vue'),
        meta: {
          title: '基础规则配置',
          requiresAuth: true
        }
      },
      {
        path: 'import',
        name: 'HealthRuleImport',
        component: () => import('@/views/HealthRule/ImportIndex.vue'),
        meta: {
          title: '卫健委指标导入',
          requiresAuth: true
        }
      },
      {
        path: 'rule-config',
        name: 'HealthRuleConfig',
        component: () => import('@/views/HealthRule/RuleConfig.vue'),
        meta: {
          title: '规则配置与版本管理',
          requiresAuth: true
        }
      },
      {
        path: 'templates',
        name: 'RuleTemplates',
        component: () => import('@/views/rules/Templates.vue'),
        meta: {
          title: '规则模板管理',
          requiresAuth: true
        }
      },
      {
        path: 'statistics',
        name: 'RuleStatistics',
        component: () => import('@/views/rules/Statistics.vue'),
        meta: {
          title: '规则效果统计',
          requiresAuth: true
        }
      },
      {
        path: 'rule-detail/:id',
        name: 'HealthRuleDetail',
        component: () => import('@/views/HealthRule/RuleDetail.vue'),
        meta: {
          title: '规则详情',
          requiresAuth: true
        }
      }
    ]
  },
  {
    path: '/content',
    component: Layout,
    redirect: '/content/list',
    meta: {
      title: '内容管理',
      icon: 'Document',
      requiresAuth: true
    },
    children: [
      {
        path: 'list',
        name: 'ContentList',
        component: () => import('@/views/content/List.vue'),
        meta: {
          title: '健康知识维护',
          requiresAuth: true
        }
      },
      {
        path: 'edit',
        name: 'ContentEdit',
        component: () => import('@/views/content/Edit.vue'),
        meta: {
          title: '内容编辑',
          requiresAuth: true
        }
      },
      {
        path: 'push',
        name: 'ContentPush',
        component: () => import('@/views/content/Push.vue'),
        meta: {
          title: '文章推送',
          requiresAuth: true
        }
      },
      {
        path: 'calendar',
        name: 'ContentCalendar',
        component: () => import('@/views/content/Calendar.vue'),
        meta: {
          title: '运营日历',
          requiresAuth: true
        }
      }
    ]
  },
  {
    path: '/statistics',
    component: Layout,
    redirect: '/statistics/global-indicators',
    meta: {
      title: '数据统计分析',
      icon: 'DataAnalysis',
      requiresAuth: true
    },
    children: [
      {
        path: 'global-indicators',
        name: 'GlobalIndicators',
        component: () => import('@/views/statistics/GlobalIndicators.vue'),
        meta: {
          title: '全局指标分析',
          requiresAuth: true
        }
      },
      {
        path: 'user-dimension',
        name: 'UserDimension',
        component: () => import('@/views/statistics/UserDimension.vue'),
        meta: {
          title: '用户维度分析',
          requiresAuth: true
        }
      },
      {
        path: 'function-usage',
        name: 'FunctionUsage',
        component: () => import('@/views/statistics/FunctionUsage.vue'),
        meta: {
          title: '功能使用分析',
          requiresAuth: true
        }
      },
      {
        path: 'overview',
        name: 'StatisticsOverview',
        component: () => import('@/views/statistics/Overview.vue'),
        meta: {
          title: '数据概览',
          requiresAuth: true
        }
      }
    ]
  },
  {
    path: '/ai',
    component: Layout,
    redirect: '/ai/sync-knowledge',
    meta: {
      title: 'AI模块辅助管理',
      icon: 'ChatLineRound',
      requiresAuth: true
    },
    children: [
      {
        path: 'sync-knowledge',
        name: 'AISyncKnowledge',
        component: () => import('@/views/ai/SyncKnowledge.vue'),
        meta: {
          title: '知识库管理',
          requiresAuth: true
        }
      },
      {
        path: 'qa-log-config',
        name: 'AIQaLogAndReportConfig',
        component: () => import('@/views/ai/QaLogAndReportConfig.vue'),
        meta: {
          title: '问答日志与模板配置',
          requiresAuth: true
        }
      },
      {
        path: 'report-manage',
        name: 'AIReportManage',
        component: () => import('@/views/ai/ReportManage.vue'),
        meta: {
          title: '报告管理',
          requiresAuth: true
        }
      }
    ]
  },
  {
    path: '/system',
    component: Layout,
    redirect: '/system/config',
    meta: {
      title: '系统管理',
      icon: 'Setting',
      requiresAuth: true
    },
    children: [
      {
        path: 'config',
        name: 'SystemConfig',
        component: () => import('@/views/system/Config.vue'),
        meta: {
          title: '系统配置',
          requiresAuth: true
        }
      },
      {
        path: 'logs',
        name: 'SystemLogs',
        component: () => import('@/views/system/Logs.vue'),
        meta: {
          title: '系统日志',
          requiresAuth: true
        }
      },
      {
        path: 'backup',
        name: 'SystemBackup',
        component: () => import('@/views/system/Backup.vue'),
        meta: {
          title: '数据备份',
          requiresAuth: true
        }
      }
    ]
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/views/NotFound.vue'),
    meta: {
      title: '404',
      requiresAuth: false
    }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 路由守卫：检查登录状态
router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('token')
  
  // 明确判断是否需要认证（默认为true）
  const requiresAuth = to.meta && to.meta.requiresAuth !== false
  
  // 如果路由需要认证但没有token，跳转到登录页
  if (requiresAuth && !token) {
    next({
      path: '/login',
      query: { redirect: to.fullPath }
    })
    return
  }
  
  // 如果已登录但访问登录页，跳转到首页
  if (to.path === '/login' && token) {
    next('/')
    return
  }
  
  // 处理用户详情路由：如果ID无效，重定向到用户列表
  if (to.path.startsWith('/users/detail/')) {
    const userId = to.params.id
    if (!userId || userId === 'undefined' || userId === 'null' || isNaN(userId)) {
      next('/users/list')
      return
    }
  }
  
  // 确保 /users 路径正确重定向到 /users/list
  if (to.path === '/users') {
    next('/users/list')
    return
  }
  
  // 其他情况正常放行（确保导航不被阻止）
  next()
})

// 路由后置守卫：确保路由正确更新
router.afterEach((to, from) => {
  // 确保路由状态正确更新
  if (to.path !== from.path) {
    // 路由已成功切换
    console.log('路由切换成功：', from.path, '->', to.path)
  }
})

export default router

