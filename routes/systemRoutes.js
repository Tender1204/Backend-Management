/**
 * 系统管理相关路由
 */

const express = require('express');
const router = express.Router();
const systemController = require('../controllers/systemController');
const { verifyToken } = require('../middleware/auth');

// 系统配置路由
router.get('/configs', verifyToken, systemController.getConfigList);
router.get('/configs/:key', verifyToken, systemController.getConfigDetail);
router.post('/configs', verifyToken, systemController.saveConfig);
router.delete('/configs/:key', verifyToken, systemController.deleteConfig);

// 系统日志路由
router.get('/logs', verifyToken, systemController.getLogList);
router.get('/logs/:id', verifyToken, systemController.getLogDetail);

// 数据备份路由
router.get('/backups', verifyToken, systemController.getBackupList);
router.post('/backups', verifyToken, systemController.createBackup);
router.delete('/backups/:id', verifyToken, systemController.deleteBackup);

module.exports = router;

