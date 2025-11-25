/**
 * 用户管理相关路由
 */

const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const tagController = require('../controllers/tagController');
const { verifyToken } = require('../middleware/auth');

// 标签管理路由（必须在动态路由之前定义，避免路由冲突）
router.get('/tags', verifyToken, tagController.getTagList);
router.post('/tags', verifyToken, tagController.createTag);
router.delete('/tags/:id', verifyToken, tagController.deleteTag);
router.get('/tags/:id/users', verifyToken, tagController.getTagUsers);
router.post('/tags/:id/users', verifyToken, tagController.addUsersToTag);
router.delete('/tags/:id/users/:userId', verifyToken, tagController.removeUserFromTag);

// 用户列表查询（需要Token验证）
router.get('/list', verifyToken, userController.getUserList);

// 创建用户（需要Token验证）
router.post('/', verifyToken, userController.createUser);

// 用户详情查询（需要Token验证，必须在最后，避免与tags路由冲突）
router.get('/:id', verifyToken, userController.getUserDetail);

// 账号状态修改（需要Token验证）
router.put('/:id/status', verifyToken, userController.updateUserStatus);

// 密码重置（需要Token验证）
router.post('/:id/reset-password', verifyToken, userController.resetPassword);

// 删除用户（需要Token验证）
router.delete('/:id', verifyToken, userController.deleteUser);

module.exports = router;

