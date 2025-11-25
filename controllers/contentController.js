/**
 * 内容管理控制器
 * 处理知识库内容的CRUD、上下架、推送、统计等接口
 */

const { sequelize } = require('../config/db');
const { success, error, validationError, notFound } = require('../utils/response');

/**
 * 获取内容列表
 * GET /api/content/list
 * 查询参数：title, categoryId, publishStatus, page, limit
 */
const getContentList = async (req, res) => {
  try {
    const { title, categoryId, publishStatus, page = 1, limit = 10 } = req.query;
    
    // 构建查询条件
    let whereConditions = [];
    let replacements = {};
    
    // 标题模糊查询
    if (title) {
      whereConditions.push('c.title LIKE :title');
      replacements.title = `%${title}%`;
    }
    
    // 分类筛选
    if (categoryId) {
      whereConditions.push('c.category_id = :categoryId');
      replacements.categoryId = parseInt(categoryId);
    }
    
    // 发布状态筛选
    if (publishStatus !== undefined && publishStatus !== '') {
      whereConditions.push('c.publish_status = :publishStatus');
      replacements.publishStatus = parseInt(publishStatus);
    }
    
    const whereClause = whereConditions.length > 0 
      ? 'WHERE ' + whereConditions.join(' AND ')
      : '';
    
    // 计算总数
    const [countResult] = await sequelize.query(
      `SELECT COUNT(*) as total 
       FROM contents c 
       ${whereClause}`,
      { replacements }
    );
    const total = countResult[0].total;
    
    // 分页查询
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const [contents] = await sequelize.query(
      `SELECT 
        c.id,
        c.title,
        c.category_id,
        cc.category_name,
        c.cover_image,
        c.summary,
        c.view_count,
        c.like_count,
        c.share_count,
        c.publish_status,
        c.publish_time,
        c.created_at,
        c.updated_at,
        GROUP_CONCAT(DISTINCT ut.tag_name) as tags
       FROM contents c
       LEFT JOIN content_categories cc ON c.category_id = cc.id
       LEFT JOIN content_tag_mapping ctm ON c.id = ctm.content_id
       LEFT JOIN user_tags ut ON ctm.tag_id = ut.id
       ${whereClause}
       GROUP BY c.id
       ORDER BY c.created_at DESC
       LIMIT :limit OFFSET :offset`,
      {
        replacements: {
          ...replacements,
          limit: parseInt(limit),
          offset: offset
        }
      }
    );
    
    // 格式化数据
    const formattedContents = contents.map(content => ({
      ...content,
      tags: content.tags ? content.tags.split(',') : []
    }));
    
    return success(res, {
      list: formattedContents,
      total: parseInt(total),
      page: parseInt(page),
      limit: parseInt(limit)
    }, '获取成功');
    
  } catch (err) {
    console.error('获取内容列表错误：', err);
    return error(res, '获取内容列表失败', 500, err.message);
  }
};

/**
 * 获取内容详情
 * GET /api/content/:id
 */
const getContentDetail = async (req, res) => {
  try {
    const { id } = req.params;
    
    const [contents] = await sequelize.query(
      `SELECT 
        c.*,
        cc.category_name,
        GROUP_CONCAT(DISTINCT ut.id) as tag_ids,
        GROUP_CONCAT(DISTINCT ut.tag_name) as tags
       FROM contents c
       LEFT JOIN content_categories cc ON c.category_id = cc.id
       LEFT JOIN content_tag_mapping ctm ON c.id = ctm.content_id
       LEFT JOIN user_tags ut ON ctm.tag_id = ut.id
       WHERE c.id = :id
       GROUP BY c.id`,
      {
        replacements: { id: parseInt(id) }
      }
    );
    
    if (contents.length === 0) {
      return notFound(res, '内容不存在');
    }
    
    const content = contents[0];
    content.tag_ids = content.tag_ids ? content.tag_ids.split(',').map(id => parseInt(id)) : [];
    content.tags = content.tags ? content.tags.split(',') : [];
    
    return success(res, content, '获取成功');
    
  } catch (err) {
    console.error('获取内容详情错误：', err);
    return error(res, '获取内容详情失败', 500, err.message);
  }
};

/**
 * 创建内容
 * POST /api/content
 */
const createContent = async (req, res) => {
  try {
    const { title, categoryId, coverImage, summary, content, tagIds, publishStatus } = req.body;
    
    // 参数验证
    if (!title || !categoryId || !content) {
      return validationError(res, '标题、分类和内容不能为空');
    }
    
    // 处理空字符串，转换为null
    const processedCoverImage = (coverImage && coverImage.trim() !== '') ? coverImage.trim() : null;
    const processedSummary = (summary && summary.trim() !== '') ? summary.trim() : null;
    
    // 开始事务
    const transaction = await sequelize.transaction();
    
    try {
      // 插入内容
      const [result] = await sequelize.query(
        `INSERT INTO contents 
         (title, category_id, cover_image, summary, content, publish_status, publish_time, created_at, updated_at)
         VALUES (:title, :categoryId, :coverImage, :summary, :content, :publishStatus, 
                 CASE WHEN :publishStatus = 1 THEN NOW() ELSE NULL END, NOW(), NOW())`,
        {
          replacements: {
            title: title.trim(),
            categoryId: parseInt(categoryId),
            coverImage: processedCoverImage,
            summary: processedSummary,
            content: content.trim(),
            publishStatus: publishStatus || 0
          },
          transaction
        }
      );
      
      const contentId = result.insertId;
      
      // 插入标签关联
      if (tagIds && Array.isArray(tagIds) && tagIds.length > 0) {
        // 先检查content_tag_mapping表是否存在，如果不存在则创建
        const [tableCheck] = await sequelize.query(
          `SELECT COUNT(*) as count FROM information_schema.tables 
           WHERE table_schema = DATABASE() AND table_name = 'content_tag_mapping'`,
          { transaction }
        );
        
        if (tableCheck[0].count === 0) {
          // 创建content_tag_mapping表
          await sequelize.query(
            `CREATE TABLE IF NOT EXISTS content_tag_mapping (
              id INT PRIMARY KEY AUTO_INCREMENT,
              content_id INT NOT NULL,
              tag_id INT NOT NULL,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              UNIQUE KEY uk_content_tag (content_id, tag_id),
              FOREIGN KEY (content_id) REFERENCES contents(id) ON DELETE CASCADE,
              FOREIGN KEY (tag_id) REFERENCES user_tags(id) ON DELETE CASCADE,
              INDEX idx_content_id (content_id),
              INDEX idx_tag_id (tag_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='内容标签关联表'`,
            { transaction }
          );
        }
        
        // 过滤并验证标签ID
        const validTagIds = tagIds
          .map(id => parseInt(id))
          .filter(id => !isNaN(id) && id > 0);
        
        // 插入标签关联
        if (validTagIds.length > 0) {
          for (const tagId of validTagIds) {
            try {
              await sequelize.query(
                `INSERT INTO content_tag_mapping (content_id, tag_id, created_at)
                 VALUES (:contentId, :tagId, NOW())
                 ON DUPLICATE KEY UPDATE created_at = created_at`,
                {
                  replacements: {
                    contentId,
                    tagId
                  },
                  transaction
                }
              );
            } catch (tagErr) {
              // 如果标签不存在，记录错误但继续处理其他标签
              console.warn(`标签ID ${tagId} 插入失败：`, tagErr.message);
            }
          }
        }
      }
      
      // 提交事务
      await transaction.commit();
      
      return success(res, { id: contentId }, '创建成功');
      
    } catch (err) {
      // 回滚事务
      await transaction.rollback();
      throw err;
    }
    
  } catch (err) {
    console.error('创建内容错误：', err);
    console.error('错误详情：', err);
    // 返回更详细的错误信息
    const errorMessage = err.message || '创建内容失败';
    return error(res, errorMessage, 500, process.env.NODE_ENV === 'development' ? err.stack : undefined);
  }
};

/**
 * 更新内容
 * PUT /api/content/:id
 */
const updateContent = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, categoryId, coverImage, summary, content, tagIds, publishStatus } = req.body;
    
    // 参数验证
    if (!title || !categoryId || !content) {
      return validationError(res, '标题、分类和内容不能为空');
    }
    
    // 处理空字符串，转换为null
    const processedCoverImage = (coverImage && coverImage.trim() !== '') ? coverImage.trim() : null;
    const processedSummary = (summary && summary.trim() !== '') ? summary.trim() : null;
    
    // 检查内容是否存在
    const [existing] = await sequelize.query(
      `SELECT id FROM contents WHERE id = :id`,
      { replacements: { id: parseInt(id) } }
    );
    
    if (existing.length === 0) {
      return notFound(res, '内容不存在');
    }
    
    // 开始事务
    const transaction = await sequelize.transaction();
    
    try {
      // 更新内容
      await sequelize.query(
        `UPDATE contents 
         SET title = :title,
             category_id = :categoryId,
             cover_image = :coverImage,
             summary = :summary,
             content = :content,
             publish_status = :publishStatus,
             publish_time = CASE WHEN :publishStatus = 1 AND publish_time IS NULL THEN NOW() 
                                WHEN :publishStatus = 1 THEN publish_time 
                                ELSE NULL END,
             updated_at = NOW()
         WHERE id = :id`,
        {
          replacements: {
            id: parseInt(id),
            title: title.trim(),
            categoryId: parseInt(categoryId),
            coverImage: processedCoverImage,
            summary: processedSummary,
            content: content.trim(),
            publishStatus: publishStatus || 0
          },
          transaction
        }
      );
      
      // 更新标签关联（先删除旧的，再插入新的）
      // 检查表是否存在
      const [tableCheck] = await sequelize.query(
        `SELECT COUNT(*) as count FROM information_schema.tables 
         WHERE table_schema = DATABASE() AND table_name = 'content_tag_mapping'`,
        { transaction }
      );
      
      if (tableCheck[0].count > 0) {
        // 删除旧的标签关联
        await sequelize.query(
          `DELETE FROM content_tag_mapping WHERE content_id = :contentId`,
          {
            replacements: { contentId: parseInt(id) },
            transaction
          }
        );
        
        // 插入新的标签关联
        if (tagIds && Array.isArray(tagIds) && tagIds.length > 0) {
          // 过滤并验证标签ID
          const validTagIds = tagIds
            .map(tagId => parseInt(tagId))
            .filter(tagId => !isNaN(tagId) && tagId > 0);
          
          if (validTagIds.length > 0) {
            for (const tagId of validTagIds) {
              try {
                await sequelize.query(
                  `INSERT INTO content_tag_mapping (content_id, tag_id, created_at)
                   VALUES (:contentId, :tagId, NOW())`,
                  {
                    replacements: {
                      contentId: parseInt(id),
                      tagId
                    },
                    transaction
                  }
                );
              } catch (tagErr) {
                // 如果标签不存在，记录错误但继续处理其他标签
                console.warn(`标签ID ${tagId} 插入失败：`, tagErr.message);
              }
            }
          }
        }
      }
      
      // 提交事务
      await transaction.commit();
      
      return success(res, null, '更新成功');
      
    } catch (err) {
      // 回滚事务
      await transaction.rollback();
      throw err;
    }
    
  } catch (err) {
    console.error('更新内容错误：', err);
    return error(res, '更新内容失败', 500, err.message);
  }
};

/**
 * 删除内容
 * DELETE /api/content/:id
 */
const deleteContent = async (req, res) => {
  try {
    const { id } = req.params;
    
    // 检查内容是否存在
    const [existing] = await sequelize.query(
      `SELECT id FROM contents WHERE id = :id`,
      { replacements: { id: parseInt(id) } }
    );
    
    if (existing.length === 0) {
      return notFound(res, '内容不存在');
    }
    
    // 删除内容（级联删除关联数据）
    await sequelize.query(
      `DELETE FROM contents WHERE id = :id`,
      { replacements: { id: parseInt(id) } }
    );
    
    return success(res, null, '删除成功');
    
  } catch (err) {
    console.error('删除内容错误：', err);
    return error(res, '删除内容失败', 500, err.message);
  }
};

/**
 * 修改内容上架状态
 * PUT /api/content/:id/status
 */
const updateContentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { publishStatus } = req.body;
    
    // 参数验证
    if (publishStatus === undefined || ![0, 1, 2].includes(parseInt(publishStatus))) {
      return validationError(res, '发布状态参数无效（0-草稿，1-已发布，2-已下架）');
    }
    
    // 检查内容是否存在
    const [existing] = await sequelize.query(
      `SELECT id FROM contents WHERE id = :id`,
      { replacements: { id: parseInt(id) } }
    );
    
    if (existing.length === 0) {
      return notFound(res, '内容不存在');
    }
    
    // 更新状态
    await sequelize.query(
      `UPDATE contents 
       SET publish_status = :publishStatus,
           publish_time = CASE WHEN :publishStatus = 1 AND publish_time IS NULL THEN NOW() 
                              WHEN :publishStatus = 1 THEN publish_time 
                              ELSE NULL END,
           updated_at = NOW()
       WHERE id = :id`,
      {
        replacements: {
          id: parseInt(id),
          publishStatus: parseInt(publishStatus)
        }
      }
    );
    
    return success(res, null, '状态更新成功');
    
  } catch (err) {
    console.error('更新内容状态错误：', err);
    return error(res, '更新内容状态失败', 500, err.message);
  }
};

/**
 * 获取内容分类列表
 * GET /api/content/categories
 */
const getCategories = async (req, res) => {
  try {
    const [categories] = await sequelize.query(
      `SELECT id, category_name, category_code, parent_id, icon, sort_order, status
       FROM content_categories
       WHERE status = 1
       ORDER BY sort_order ASC, id ASC`
    );
    
    return success(res, categories, '获取成功');
    
  } catch (err) {
    console.error('获取分类列表错误：', err);
    return error(res, '获取分类列表失败', 500, err.message);
  }
};

/**
 * 创建推送任务
 * POST /api/content/push
 */
const createPushTask = async (req, res) => {
  try {
    const { contentId, pushType, pushTime, targetType, targetTags } = req.body;
    
    // 调试输出
    console.log('收到创建推送任务请求：', {
      contentId,
      pushType,
      pushTime,
      targetType,
      targetTags,
      targetTagsType: typeof targetTags,
      targetTagsIsArray: Array.isArray(targetTags),
      targetTagsLength: Array.isArray(targetTags) ? targetTags.length : 0
    });
    
    // 参数验证
    if (!contentId || !pushType || !targetType) {
      return validationError(res, '内容ID、推送类型和目标类型不能为空');
    }
    
    if (pushType === 2 && !pushTime) {
      return validationError(res, '定时推送必须指定推送时间');
    }
    
    // 处理targetTags：确保是数组并过滤无效值
    let processedTargetTags = [];
    if (targetType === 2) {
      if (!targetTags || !Array.isArray(targetTags) || targetTags.length === 0) {
        return validationError(res, '指定标签推送必须选择至少一个标签');
      }
      
      // 过滤和验证标签ID
      processedTargetTags = targetTags
        .map(id => parseInt(id))
        .filter(id => !isNaN(id) && id > 0);
      
      if (processedTargetTags.length === 0) {
        return validationError(res, '标签ID无效，请重新选择');
      }
      
      // 验证标签ID是否真实存在（使用参数化查询防止SQL注入）
      const [existingTags] = await sequelize.query(
        `SELECT id FROM user_tags WHERE id IN (:tagIds)`,
        {
          replacements: {
            tagIds: processedTargetTags
          }
        }
      );
      
      const existingTagIds = existingTags.map(t => t.id);
      processedTargetTags = processedTargetTags.filter(id => existingTagIds.includes(id));
      
      if (processedTargetTags.length === 0) {
        return validationError(res, '所选标签不存在，请重新选择');
      }
      
      if (processedTargetTags.length !== targetTags.length) {
        console.warn('部分标签ID无效，已过滤：', {
          original: targetTags,
          valid: processedTargetTags
        });
      }
      
      console.log('处理后的标签ID：', {
        original: targetTags,
        processed: processedTargetTags,
        existing: existingTagIds
      });
    }
    
    // 检查内容是否存在
    const [content] = await sequelize.query(
      `SELECT id, title FROM contents WHERE id = :contentId`,
      { replacements: { contentId: parseInt(contentId) } }
    );
    
    if (content.length === 0) {
      return notFound(res, '内容不存在');
    }
    
    // 开始事务
    const transaction = await sequelize.transaction();
    
    try {
      // 插入推送配置
      const [result] = await sequelize.query(
        `INSERT INTO content_push_configs 
         (content_id, push_type, push_time, target_type, target_tags, push_status, created_at, updated_at)
         VALUES (:contentId, :pushType, :pushTime, :targetType, :targetTags, 0, NOW(), NOW())`,
        {
          replacements: {
            contentId: parseInt(contentId),
            pushType: parseInt(pushType),
            pushTime: pushType === 2 ? pushTime : null,
            targetType: parseInt(targetType),
            targetTags: targetType === 2 && processedTargetTags.length > 0 
              ? JSON.stringify(processedTargetTags)
              : null
          },
          transaction
        }
      );
      
      const pushTaskId = result.insertId;
      
      // 如果是立即推送，这里可以触发推送逻辑（实际项目中需要实现推送服务）
      if (pushType === 1) {
        // TODO: 实现立即推送逻辑
        // 更新推送状态为已推送
        try {
          await sequelize.query(
            `UPDATE content_push_configs 
             SET push_status = 1, updated_at = NOW()
             WHERE id = :id`,
            { 
              replacements: { id: pushTaskId },
              transaction
            }
          );
        } catch (updateErr) {
          // 如果更新失败，记录错误但不影响整体流程
          console.warn('更新推送状态失败，但任务已创建：', updateErr.message);
        }
      }
      
      // 提交事务
      await transaction.commit();
      
      return success(res, { id: pushTaskId }, '推送任务创建成功');
      
    } catch (err) {
      // 回滚事务
      await transaction.rollback();
      throw err;
    }
    
  } catch (err) {
    console.error('创建推送任务错误：', err);
    return error(res, '创建推送任务失败', 500, err.message);
  }
};

/**
 * 获取推送任务列表
 * GET /api/content/push/list
 */
const getPushTaskList = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    
    // 计算总数
    const [countResult] = await sequelize.query(
      `SELECT COUNT(*) as total FROM content_push_configs`
    );
    const total = countResult[0].total;
    
    // 分页查询
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const [tasks] = await sequelize.query(
      `SELECT 
        cpc.id,
        cpc.content_id,
        c.title as content_title,
        cpc.push_type,
        cpc.push_time,
        cpc.target_type,
        cpc.target_tags,
        cpc.push_status,
        cpc.push_count,
        cpc.created_at,
        cpc.updated_at
       FROM content_push_configs cpc
       LEFT JOIN contents c ON cpc.content_id = c.id
       ORDER BY cpc.created_at DESC
       LIMIT :limit OFFSET :offset`,
      {
        replacements: {
          limit: parseInt(limit),
          offset: offset
        }
      }
    );
    
    // 格式化数据
    const formattedTasks = tasks.map(task => {
      let parsedTags = [];
      
      // 调试输出原始数据
      console.log('处理任务标签数据：', {
        id: task.id,
        target_tags_raw: task.target_tags,
        target_tags_type: typeof task.target_tags,
        target_tags_isArray: Array.isArray(task.target_tags)
      });
      
      if (task.target_tags) {
        // 如果已经是数组，直接使用
        if (Array.isArray(task.target_tags)) {
          parsedTags = task.target_tags;
          console.log('标签已经是数组格式：', parsedTags);
        } else if (typeof task.target_tags === 'string') {
          // 如果是字符串，尝试解析
          try {
            const parsed = JSON.parse(task.target_tags);
            // 检查解析后的类型
            if (Array.isArray(parsed)) {
              parsedTags = parsed;
              console.log('JSON解析成功，得到数组：', parsedTags);
            } else {
              // 如果不是数组，可能是单个数字或其他格式
              console.warn('JSON解析后不是数组：', {
                parsed: parsed,
                parsedType: typeof parsed,
                original: task.target_tags
              });
              // 尝试转换为数组
              if (typeof parsed === 'number') {
                parsedTags = [parsed];
                console.log('单个数字，转换为数组：', parsedTags);
              } else {
                parsedTags = [];
              }
            }
          } catch (err) {
            console.error('解析标签JSON失败：', err, '原始数据：', task.target_tags);
            parsedTags = [];
          }
        } else if (typeof task.target_tags === 'number') {
          // 如果是单个数字，转换为数组
          parsedTags = [task.target_tags];
          console.log('单个数字，转换为数组：', parsedTags);
        } else {
          console.warn('未知的标签数据格式：', {
            value: task.target_tags,
            type: typeof task.target_tags
          });
          parsedTags = [];
        }
      }
      
      return {
        ...task,
        target_tags: parsedTags
      };
    });
    
    // 调试输出
    console.log('推送任务列表（格式化后）：', formattedTasks.map(t => ({
      id: t.id,
      content_title: t.content_title,
      target_type: t.target_type,
      target_tags: t.target_tags
    })));
    
    return success(res, {
      list: formattedTasks,
      total: parseInt(total),
      page: parseInt(page),
      limit: parseInt(limit)
    }, '获取成功');
    
  } catch (err) {
    console.error('获取推送任务列表错误：', err);
    return error(res, '获取推送任务列表失败', 500, err.message);
  }
};

/**
 * 获取推送任务详情
 * GET /api/content/push/:id
 */
const getPushTaskDetail = async (req, res) => {
  try {
    const { id } = req.params;
    
    const [tasks] = await sequelize.query(
      `SELECT 
        cpc.*,
        c.title as content_title,
        c.content as content_body
       FROM content_push_configs cpc
       LEFT JOIN contents c ON cpc.content_id = c.id
       WHERE cpc.id = :id`,
      {
        replacements: { id: parseInt(id) }
      }
    );
    
    if (tasks.length === 0) {
      return notFound(res, '推送任务不存在');
    }
    
    const task = tasks[0];
    task.target_tags = task.target_tags ? JSON.parse(task.target_tags) : [];
    
    return success(res, task, '获取成功');
    
  } catch (err) {
    console.error('获取推送任务详情错误：', err);
    return error(res, '获取推送任务详情失败', 500, err.message);
  }
};

/**
 * 取消推送任务
 * PUT /api/content/push/:id/cancel
 */
const cancelPushTask = async (req, res) => {
  try {
    const { id } = req.params;
    
    // 检查任务是否存在
    const [task] = await sequelize.query(
      `SELECT id, push_status FROM content_push_configs WHERE id = :id`,
      { replacements: { id: parseInt(id) } }
    );
    
    if (task.length === 0) {
      return notFound(res, '推送任务不存在');
    }
    
    // 只能取消未执行的任务（状态为0-待推送）
    if (task[0].push_status !== 0) {
      return validationError(res, '只能取消未执行的推送任务');
    }
    
    // 更新状态为已取消
    await sequelize.query(
      `UPDATE content_push_configs 
       SET push_status = 2, updated_at = NOW()
       WHERE id = :id`,
      { replacements: { id: parseInt(id) } }
    );
    
    return success(res, null, '取消推送成功');
    
  } catch (err) {
    console.error('取消推送任务错误：', err);
    return error(res, '取消推送任务失败', 500, err.message);
  }
};

/**
 * 删除推送任务
 * DELETE /api/content/push/:id
 */
const deletePushTask = async (req, res) => {
  try {
    const { id } = req.params;
    
    // 检查任务是否存在
    const [task] = await sequelize.query(
      `SELECT id, push_status FROM content_push_configs WHERE id = :id`,
      { replacements: { id: parseInt(id) } }
    );
    
    if (task.length === 0) {
      return notFound(res, '推送任务不存在');
    }
    
    // 只能删除已取消或已推送的任务
    // 待推送的任务应该先取消再删除，或者直接删除
    if (task[0].push_status === 0) {
      // 对于待推送的任务，可以直接删除，但建议先提示用户取消
      // 这里允许直接删除
    }
    
    // 删除推送任务
    await sequelize.query(
      `DELETE FROM content_push_configs WHERE id = :id`,
      { replacements: { id: parseInt(id) } }
    );
    
    return success(res, null, '删除推送任务成功');
    
  } catch (err) {
    console.error('删除推送任务错误：', err);
    return error(res, '删除推送任务失败', 500, err.message);
  }
};

/**
 * 获取内容数据统计
 * GET /api/content/statistics
 */
const getContentStatistics = async (req, res) => {
  try {
    // 1. 总点击量
    const [totalViews] = await sequelize.query(
      `SELECT SUM(view_count) as total FROM contents WHERE publish_status = 1`
    );
    
    // 2. 总阅读时长（从用户行为日志统计，这里简化处理）
    const [totalReadTime] = await sequelize.query(
      `SELECT COUNT(*) * 60 as total_seconds 
       FROM user_behavior_logs 
       WHERE behavior_type = 'view' 
       AND resource_type = 'content' 
       AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`
    );
    
    // 3. 按分类统计
    const [categoryStats] = await sequelize.query(
      `SELECT 
        cc.id,
        cc.category_name,
        COUNT(c.id) as content_count,
        SUM(c.view_count) as total_views,
        AVG(c.view_count) as avg_views
       FROM content_categories cc
       LEFT JOIN contents c ON cc.id = c.category_id AND c.publish_status = 1
       WHERE cc.status = 1
       GROUP BY cc.id, cc.category_name
       ORDER BY total_views DESC`
    );
    
    // 4. 热门内容TOP10
    const [topContents] = await sequelize.query(
      `SELECT id, title, view_count, like_count
       FROM contents
       WHERE publish_status = 1
       ORDER BY view_count DESC
       LIMIT 10`
    );
    
    return success(res, {
      totalViews: parseInt(totalViews[0].total) || 0,
      totalReadTime: parseInt(totalReadTime[0].total_seconds) || 0,
      categoryStats: categoryStats.map(stat => ({
        ...stat,
        content_count: parseInt(stat.content_count) || 0,
        total_views: parseInt(stat.total_views) || 0,
        avg_views: parseFloat(stat.avg_views) || 0
      })),
      topContents: topContents.map(content => ({
        ...content,
        view_count: parseInt(content.view_count) || 0,
        like_count: parseInt(content.like_count) || 0
      }))
    }, '获取成功');
    
  } catch (err) {
    console.error('获取内容统计错误：', err);
    return error(res, '获取内容统计失败', 500, err.message);
  }
};

module.exports = {
  getContentList,
  getContentDetail,
  createContent,
  updateContent,
  deleteContent,
  updateContentStatus,
  getCategories,
  createPushTask,
  getPushTaskList,
  getPushTaskDetail,
  cancelPushTask,
  deletePushTask,
  getContentStatistics
};

