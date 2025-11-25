/**
 * 用户标签管理控制器
 */

const { sequelize } = require('../config/db');
const { success, error, validationError } = require('../utils/response');

/**
 * 获取标签列表
 * GET /api/users/tags
 */
const getTagList = async (req, res) => {
  try {
    const [tags] = await sequelize.query(
      `SELECT 
        id, tag_name, tag_desc, color, sort_order, status, created_at
       FROM user_tags
       WHERE status = 1
       ORDER BY sort_order ASC, created_at DESC`
    );
    
    return success(res, tags, '获取成功');
  } catch (err) {
    console.error('获取标签列表错误：', err);
    return error(res, '获取标签列表失败', 500, err.message);
  }
};

/**
 * 创建标签
 * POST /api/users/tags
 */
const createTag = async (req, res) => {
  try {
    const { tag_name, tag_desc, color } = req.body;
    
    if (!tag_name) {
      return validationError(res, '标签名称不能为空');
    }
    
    // 检查标签名是否已存在
    const [existing] = await sequelize.query(
      `SELECT id FROM user_tags WHERE tag_name = :tag_name LIMIT 1`,
      { replacements: { tag_name } }
    );
    
    if (existing && existing.length > 0) {
      return error(res, '标签名称已存在', 400);
    }
    
    // 创建标签
    const [result, metadata] = await sequelize.query(
      `INSERT INTO user_tags (tag_name, tag_desc, color, created_at)
       VALUES (:tag_name, :tag_desc, :color, NOW())`,
      {
        replacements: {
          tag_name,
          tag_desc: tag_desc || null,
          color: color || '#409EFF'
        }
      }
    );
    
    // MySQL2返回的insertId在metadata中
    const insertId = metadata?.insertId || result?.insertId;
    
    if (!insertId) {
      return error(res, '创建标签失败：无法获取插入ID', 500);
    }
    
    // 查询创建的标签信息
    const [newTag] = await sequelize.query(
      `SELECT id, tag_name, tag_desc, color, sort_order, status, created_at
       FROM user_tags
       WHERE id = :insertId
       LIMIT 1`,
      { replacements: { insertId } }
    );
    
    return success(res, newTag[0] || { id: insertId }, '创建成功');
  } catch (err) {
    console.error('创建标签错误：', err);
    return error(res, '创建标签失败', 500, err.message);
  }
};

/**
 * 删除标签
 * DELETE /api/users/tags/:id
 */
const deleteTag = async (req, res) => {
  try {
    const { id } = req.params;
    
    // 检查标签是否存在
    const [tag] = await sequelize.query(
      `SELECT id FROM user_tags WHERE id = :id LIMIT 1`,
      { replacements: { id } }
    );
    
    if (!tag || tag.length === 0) {
      return error(res, '标签不存在', 404);
    }
    
    // 删除标签（关联关系会自动删除，因为有外键约束）
    await sequelize.query(
      `DELETE FROM user_tags WHERE id = :id`,
      { replacements: { id } }
    );
    
    return success(res, null, '删除成功');
  } catch (err) {
    console.error('删除标签错误：', err);
    return error(res, '删除标签失败', 500, err.message);
  }
};

/**
 * 获取标签关联的用户列表
 * GET /api/users/tags/:id/users
 */
const getTagUsers = async (req, res) => {
  try {
    const { id } = req.params;
    
    const [users] = await sequelize.query(
      `SELECT 
        u.id, u.nickname, u.avatar, u.phone, u.register_time
       FROM users u
       JOIN user_tag_mapping utm ON u.id = utm.user_id
       WHERE utm.tag_id = :id
       ORDER BY utm.created_at DESC`,
      { replacements: { id } }
    );
    
    return success(res, users, '获取成功');
  } catch (err) {
    console.error('获取标签用户列表错误：', err);
    return error(res, '获取标签用户列表失败', 500, err.message);
  }
};

/**
 * 批量添加用户到标签
 * POST /api/users/tags/:id/users
 */
const addUsersToTag = async (req, res) => {
  try {
    const { id } = req.params;
    const { userIds } = req.body;
    
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return validationError(res, '用户ID列表不能为空');
    }
    
    // 检查标签是否存在
    const [tag] = await sequelize.query(
      `SELECT id FROM user_tags WHERE id = :id LIMIT 1`,
      { replacements: { id } }
    );
    
    if (!tag || tag.length === 0) {
      return error(res, '标签不存在', 404);
    }
    
    // 批量插入关联关系（忽略已存在的）
    // 先查询已存在的关联关系
    const [existing] = await sequelize.query(
      `SELECT user_id FROM user_tag_mapping WHERE tag_id = :id AND user_id IN (:userIds)`,
      { replacements: { id, userIds } }
    );
    
    const existingUserIds = existing.map(item => item.user_id);
    const newUserIds = userIds.filter(userId => !existingUserIds.includes(userId));
    
    if (newUserIds.length > 0) {
      // 批量插入新关联关系
      const values = newUserIds.map(userId => `(${id}, ${userId}, NOW())`).join(',');
      await sequelize.query(
        `INSERT INTO user_tag_mapping (tag_id, user_id, created_at)
         VALUES ${values}`
      );
    }
    
    return success(res, { count: userIds.length }, '添加成功');
  } catch (err) {
    console.error('批量添加用户错误：', err);
    return error(res, '批量添加用户失败', 500, err.message);
  }
};

/**
 * 从标签移除用户
 * DELETE /api/users/tags/:id/users/:userId
 */
const removeUserFromTag = async (req, res) => {
  try {
    const { id, userId } = req.params;
    
    await sequelize.query(
      `DELETE FROM user_tag_mapping 
       WHERE tag_id = :tagId AND user_id = :userId`,
      { replacements: { tagId: id, userId } }
    );
    
    return success(res, null, '移除成功');
  } catch (err) {
    console.error('移除用户错误：', err);
    return error(res, '移除用户失败', 500, err.message);
  }
};

module.exports = {
  getTagList,
  createTag,
  deleteTag,
  getTagUsers,
  addUsersToTag,
  removeUserFromTag
};

