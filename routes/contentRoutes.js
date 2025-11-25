/**
 * 内容管理相关路由
 */

const express = require('express');
const router = express.Router();
const contentController = require('../controllers/contentController');
const { verifyToken } = require('../middleware/auth');

// 内容CRUD路由
router.get('/list', verifyToken, contentController.getContentList);
router.get('/categories', verifyToken, contentController.getCategories);
router.get('/:id', verifyToken, contentController.getContentDetail);
router.post('/', verifyToken, contentController.createContent);
router.put('/:id', verifyToken, contentController.updateContent);
router.delete('/:id', verifyToken, contentController.deleteContent);

// 内容状态管理
router.put('/:id/status', verifyToken, contentController.updateContentStatus);

// 推送任务路由（必须在动态路由之前定义）
router.post('/push', verifyToken, contentController.createPushTask);
router.get('/push/list', verifyToken, contentController.getPushTaskList);
router.get('/push/:id', verifyToken, contentController.getPushTaskDetail);
router.put('/push/:id/cancel', verifyToken, contentController.cancelPushTask);
router.delete('/push/:id', verifyToken, contentController.deletePushTask);

// 内容统计路由
router.get('/statistics/data', verifyToken, contentController.getContentStatistics);

module.exports = router;

