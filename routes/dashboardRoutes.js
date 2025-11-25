/**
 * 控制台相关路由
 */

const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { verifyToken } = require('../middleware/auth');

// 获取核心指标数据（需要Token验证）
router.get('/indicators', verifyToken, dashboardController.getIndicators);

// 获取活跃度趋势数据（需要Token验证）
router.get('/trend', verifyToken, dashboardController.getTrend);

// 获取功能使用率数据（需要Token验证）
router.get('/usage', verifyToken, dashboardController.getUsage);

// 获取内容推送完成率（需要Token验证）
router.get('/push-rate', verifyToken, dashboardController.getPushRate);

// 获取健康数据记录率（需要Token验证）
router.get('/health-record-rate', verifyToken, dashboardController.getHealthRecordRate);

// 获取核心指标周期对比（需要Token验证）
router.get('/compare', verifyToken, dashboardController.getCompare);

module.exports = router;

