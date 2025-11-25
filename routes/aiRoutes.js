/**
 * AI模块辅助管理相关路由
 */

const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const { verifyToken } = require('../middleware/auth');

// 知识库同步接口
router.post('/sync-knowledge', verifyToken, aiController.syncKnowledge);

// AI问答接口
router.post('/qa', verifyToken, aiController.aiQa);

// 报告模板配置接口
router.get('/report-template', verifyToken, aiController.getReportTemplate);
router.put('/report-template', verifyToken, aiController.updateReportTemplate);

// AI报告生成接口
router.post('/generate-report', verifyToken, aiController.generateReport);

// AI问答日志查询接口
router.get('/qa-log', verifyToken, aiController.getQaLog);

// 知识库同步日志查询接口
router.get('/sync-logs', verifyToken, aiController.getSyncLogs);

// 获取可用模型列表接口
router.get('/models', verifyToken, aiController.getModels);

// API配置接口
router.get('/api-config', verifyToken, aiController.getApiConfig);
router.post('/api-config', verifyToken, aiController.saveApiConfig);

// 知识库列表查询接口
router.get('/knowledge-list', verifyToken, aiController.getKnowledgeList);

module.exports = router;

