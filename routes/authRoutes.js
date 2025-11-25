/**
 * 认证相关路由
 */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verifyToken } = require('../middleware/auth');

// 管理员登录（不需要Token验证）
router.post('/login', authController.login);

// 获取当前登录管理员信息（需要Token验证）
router.get('/info', verifyToken, authController.getAdminInfo);

// 修改密码（需要Token验证）
router.post('/change-password', verifyToken, authController.changePassword);

// 更新管理员信息（需要Token验证）
router.post('/update-info', verifyToken, authController.updateAdminInfo);

// 忘记密码（不需要Token验证）
router.post('/forgot-password', authController.forgotPassword);

// 重置密码（不需要Token验证）
router.post('/reset-password', authController.resetPassword);

module.exports = router;

