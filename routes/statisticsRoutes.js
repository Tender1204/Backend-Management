/**
 * 数据统计分析相关路由
 */

const express = require('express');
const router = express.Router();
const statisticsController = require('../controllers/statisticsController');
const { verifyToken } = require('../middleware/auth');

// 全局指标分析（需要Token验证）
router.get('/global-indicators', verifyToken, statisticsController.getGlobalIndicators);

// 用户维度分析（需要Token验证）
router.get('/user-dimension', verifyToken, statisticsController.getUserDimension);

// 功能使用分析（需要Token验证）
router.get('/function-usage', verifyToken, statisticsController.getFunctionUsage);

module.exports = router;

