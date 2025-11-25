/**
 * 健康规则管理相关路由
 */

const express = require('express');
const router = express.Router();
const ruleController = require('../controllers/ruleController');
const { verifyToken } = require('../middleware/auth');

// 基础规则配置
router.get('/config', verifyToken, ruleController.getRuleConfig);
router.put('/config', verifyToken, ruleController.updateRuleConfig);

// 规则类型
router.get('/types', verifyToken, ruleController.getRuleTypes);

// 规则模板管理
router.get('/templates', verifyToken, ruleController.getTemplateList);
router.post('/templates', verifyToken, ruleController.createTemplate);
router.put('/templates/:id', verifyToken, ruleController.updateTemplate);
router.delete('/templates/:id', verifyToken, ruleController.deleteTemplate);
router.post('/templates/:id/assign', verifyToken, ruleController.assignTemplateToUsers);

// 规则效果统计
router.get('/statistics', verifyToken, ruleController.getRuleStatistics);

module.exports = router;

