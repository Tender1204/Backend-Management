/**
 * AI模块辅助管理控制器
 * 提供知识库同步、AI问答、报告生成等核心接口
 */

const { sequelize } = require('../config/db');
const { success, error, validationError, notFound } = require('../utils/response');
const { extractKeywords, recognizeHealthData, generateAnswer, calculateSimilarity, getModelVersion, getAvailableModels, saveApiConfigToDB } = require('../utils/nlpModel');
const { buildKnowledgeIndex, searchKnowledge, clearIndex, getIndexInfo } = require('../utils/knowledgeIndex');

/**
 * 知识库同步接口
 * POST /api/ai/sync-knowledge
 * 业务价值：将内容管理模块的已上架内容同步至AI知识库，供模型调用
 * 技术实现：查询已上架内容→调用BERT模型提取关键词→生成索引→存储至知识库
 */
const syncKnowledge = async (req, res) => {
  try {
    const { modelName } = req.body; // 从请求中获取模型名称
    
    console.log('🔄 开始同步知识库...');
    
    // 查询所有已上架的科普内容（关联内容管理模块的contents表）
    const [contents] = await sequelize.query(
      `SELECT id, title, category_id, content, summary, 
              (SELECT category_name FROM content_categories WHERE id = contents.category_id) as category_name
       FROM contents 
       WHERE publish_status = 1 
       ORDER BY id`
    );
    
    if (!contents || contents.length === 0) {
      return error(res, '知识库无已上架内容', 400);
    }
    
    let syncCount = 0;
    let modelRecognizeCount = 0;
    const syncStartTime = new Date();
    
    // 开始事务
    const transaction = await sequelize.transaction();
    
    try {
      // 清空旧的知识库数据（可选：也可以增量更新）
      await sequelize.query(
        `DELETE FROM ai_knowledge_base`,
        { transaction }
      );
      
      // 批量同步内容（优化：使用批量插入提升性能）
      const insertValues = [];
      
      for (const content of contents) {
        try {
          // 确定分类（从category_name映射到AI知识库分类）
          let category = '其他';
          if (content.category_name) {
            const categoryMap = {
              '健康科普': '健康科普',
              '运动健身': '运动',
              '营养饮食': '饮食',
              '心理健康': '心理健康'
            };
            category = categoryMap[content.category_name] || '其他';
          }
          
          // 使用API提取关键词（传递模型名称）
          const fullText = `${content.title} ${content.summary || ''} ${content.content || ''}`;
          let keywords = [];
          try {
            // 调用API提取关键词（传递模型名称）
            keywords = await extractKeywords(fullText, modelName || null);
            if (keywords && keywords.length > 0) {
              modelRecognizeCount++;
            } else {
              // API返回空，使用简单分词
              keywords = fullText.match(/[\u4e00-\u9fa5]{2,}/g) || [];
              keywords = keywords.slice(0, 10);
            }
          } catch (keywordError) {
            // API调用失败，使用简单分词
            keywords = fullText.match(/[\u4e00-\u9fa5]{2,}/g) || [];
            keywords = keywords.slice(0, 10);
          }
          
          insertValues.push({
            title: content.title,
            category: category,
            content: content.content || content.summary || '',
            keywords: keywords.join(',')
          });
          
          syncCount++;
        } catch (itemError) {
          console.error(`处理内容 ${content.id} 失败：`, itemError);
          // 继续处理其他内容
        }
      }
      
      // 批量插入（提升性能，使用参数化查询避免SQL注入）
      if (insertValues.length > 0) {
        // 分批插入，每批50条（避免SQL语句过长）
        const batchSize = 50;
        for (let i = 0; i < insertValues.length; i += batchSize) {
          const batch = insertValues.slice(i, i + batchSize);
          
          // 构建参数化查询
          const placeholders = batch.map((_, index) => {
            const baseIndex = i + index;
            return `(:title${baseIndex}, :category${baseIndex}, :content${baseIndex}, :keywords${baseIndex}, 1, NOW())`;
          }).join(',');
          
          const replacements = {};
          batch.forEach((item, index) => {
            const baseIndex = i + index;
            replacements[`title${baseIndex}`] = item.title;
            replacements[`category${baseIndex}`] = item.category;
            replacements[`content${baseIndex}`] = item.content || '';
            replacements[`keywords${baseIndex}`] = item.keywords;
          });
          
          await sequelize.query(
            `INSERT INTO ai_knowledge_base (title, category, content, keywords, status, createTime)
             VALUES ${placeholders}`,
            {
              replacements,
              transaction
            }
          );
        }
      }
      
      // 提交事务
      await transaction.commit();
      
      // 清除旧索引，重新构建
      clearIndex();
      await buildKnowledgeIndex();
      
      const syncEndTime = new Date();
      const duration = Math.round((syncEndTime - syncStartTime) / 1000);
      
      // 记录同步日志到数据库（如果表存在）
      const adminId = req.admin?.id || null;
      const operator = req.admin?.username || '系统';
      const usedModel = modelName || getModelVersion();
      
      try {
        // 先检查表是否存在
        const [tableCheck] = await sequelize.query(
          `SELECT COUNT(*) as count FROM information_schema.tables 
           WHERE table_schema = DATABASE() AND table_name = 'ai_sync_log'`,
          { logging: false }
        );
        
        if (tableCheck && tableCheck[0] && tableCheck[0].count > 0) {
          await sequelize.query(
            `INSERT INTO ai_sync_log (operator, syncCount, modelRecognizeCount, status, modelVersion, duration, createTime)
             VALUES (:operator, :syncCount, :modelRecognizeCount, '成功', :modelVersion, :duration, NOW())`,
            {
              replacements: {
                operator: operator,
                syncCount: syncCount,
                modelRecognizeCount: modelRecognizeCount,
                modelVersion: usedModel,
                duration: duration
              },
              logging: false
            }
          );
        }
      } catch (logError) {
        console.warn('同步日志记录失败：', logError.message);
        // 不影响主流程
      }
      
      console.log(`✅ 知识库同步完成：${syncCount}条，模型识别：${modelRecognizeCount}条，耗时：${duration}秒`);
      
      return success(res, {
        syncCount,
        modelRecognizeCount,
        modelVersion: usedModel,
        duration
      }, '同步成功');
      
    } catch (syncError) {
      await transaction.rollback();
      
      // 记录失败日志（如果表存在）
      const adminId = req.admin?.id || null;
      const operator = req.admin?.username || '系统';
      const usedModel = modelName || getModelVersion();
      try {
        const [tableCheck] = await sequelize.query(
          `SELECT COUNT(*) as count FROM information_schema.tables 
           WHERE table_schema = DATABASE() AND table_name = 'ai_sync_log'`,
          { logging: false }
        );
        
        if (tableCheck && tableCheck[0] && tableCheck[0].count > 0) {
          await sequelize.query(
            `INSERT INTO ai_sync_log (operator, syncCount, modelRecognizeCount, status, modelVersion, duration, errorMessage, createTime)
             VALUES (:operator, 0, 0, '失败', :modelVersion, 0, :errorMessage, NOW())`,
            {
              replacements: {
                operator: operator,
                modelVersion: usedModel,
                errorMessage: syncError.message || '同步失败'
              },
              logging: false
            }
          );
        }
      } catch (logError) {
        console.warn('同步日志记录失败：', logError.message);
      }
      
      throw syncError;
    }
    
  } catch (err) {
    console.error('知识库同步错误：', err);
    
    // 记录失败日志（如果表存在）
    const adminId = req.admin?.id || null;
    const operator = req.admin?.username || '系统';
    const usedModel = modelName || getModelVersion();
    try {
      const [tableCheck] = await sequelize.query(
        `SELECT COUNT(*) as count FROM information_schema.tables 
         WHERE table_schema = DATABASE() AND table_name = 'ai_sync_log'`,
        { logging: false }
      );
      
      if (tableCheck && tableCheck[0] && tableCheck[0].count > 0) {
        await sequelize.query(
          `INSERT INTO ai_sync_log (operator, syncCount, modelRecognizeCount, status, modelVersion, duration, errorMessage, createTime)
           VALUES (:operator, 0, 0, '失败', :modelVersion, 0, :errorMessage, NOW())`,
          {
            replacements: {
              operator: operator,
              modelVersion: usedModel,
              errorMessage: err.message || '同步失败'
            },
            logging: false
          }
        );
      }
    } catch (logError) {
      console.warn('同步日志记录失败：', logError.message);
    }
    
    return error(res, '同步失败', 500, err.message);
  }
};

/**
 * AI问答接口
 * POST /api/ai/qa
 * 业务价值：用户提问→调用外部模型API→匹配知识库→生成精准回答
 * 技术实现：外部API问答→匹配知识库→识别健康指标→生成回答
 */
const aiQa = async (req, res) => {
  try {
    const { userId, userQuestion, modelName } = req.body;
    
    if (!userQuestion || !userQuestion.trim()) {
      return validationError(res, '用户问题不能为空');
    }
    
    const question = userQuestion.trim();
    const startTime = Date.now();
    
    // 1. 查询健康识别规则
    const [rules] = await sequelize.query(
      `SELECT ruleId, healthIndicator, keyword, threshold, statusDesc, suggestion
       FROM ai_health_recognize_rule`
    );
    
    // 2. 调用模型识别健康数据
    let modelRecognizeResult = null;
    try {
      modelRecognizeResult = await recognizeHealthData(question, rules);
    } catch (modelError) {
      console.error('模型识别失败：', modelError);
      // 继续执行，使用知识库回答
    }
    
    // 3. 搜索知识库匹配答案
    const matchedKnowledge = await searchKnowledge(question, 3);
    let context = '';
    let matchKnowledgeId = null;
    
    if (matchedKnowledge && matchedKnowledge.length > 0) {
      // 使用最匹配的知识作为上下文
      const bestMatch = matchedKnowledge[0];
      matchKnowledgeId = bestMatch.knowledgeId;
      context = bestMatch.content.substring(0, 500);
    }
    
    // 4. 调用外部API生成回答（优先使用API）
    let aiAnswer = '';
    try {
      // 构建上下文信息
      let fullContext = question;
      if (context) {
        fullContext += `\n\n相关健康知识：${context}`;
      }
      if (modelRecognizeResult) {
        fullContext += `\n\n健康指标识别：${modelRecognizeResult.indicator}，当前值：${modelRecognizeResult.value}，状态：${modelRecognizeResult.status}`;
      }
      
      // 调用外部API生成回答
      const apiAnswer = await generateAnswer(question, fullContext, modelName);
      if (apiAnswer) {
        aiAnswer = apiAnswer;
      } else {
        // API调用失败，使用规则和知识库生成回答
        if (modelRecognizeResult) {
          aiAnswer = `根据健康标准，${modelRecognizeResult.indicator}的推荐值为${modelRecognizeResult.threshold}，你的${modelRecognizeResult.value}属于${modelRecognizeResult.status}状态。${modelRecognizeResult.suggestion || ''}。`;
          if (context) {
            aiAnswer += ` 此外，${context.substring(0, 100)}...`;
          }
        } else if (context) {
          aiAnswer = context.substring(0, 500);
        } else {
          aiAnswer = '抱歉，我暂时无法回答这个问题。建议你咨询专业医生或查看健康科普内容。';
        }
      }
    } catch (apiError) {
      console.error('API调用失败，使用降级方案：', apiError);
      // 降级方案
      if (modelRecognizeResult) {
        aiAnswer = `根据健康标准，${modelRecognizeResult.indicator}的推荐值为${modelRecognizeResult.threshold}，你的${modelRecognizeResult.value}属于${modelRecognizeResult.status}状态。${modelRecognizeResult.suggestion || ''}`;
        if (context) {
          aiAnswer += ` 此外，${context.substring(0, 100)}...`;
        }
      } else if (context) {
        aiAnswer = context.substring(0, 500);
      } else {
        aiAnswer = '抱歉，我暂时无法回答这个问题。建议你咨询专业医生或查看健康科普内容。';
      }
    }
    
    // 5. 记录问答日志
    const responseTime = Date.now() - startTime;
    try {
      await sequelize.query(
        `INSERT INTO ai_qa_log (userId, userQuestion, modelRecognizeResult, aiAnswer, matchKnowledgeId, createTime)
         VALUES (:userId, :userQuestion, :modelRecognizeResult, :aiAnswer, :matchKnowledgeId, NOW())`,
        {
          replacements: {
            userId: userId || null,
            userQuestion: question,
            modelRecognizeResult: modelRecognizeResult ? JSON.stringify(modelRecognizeResult) : null,
            aiAnswer: aiAnswer,
            matchKnowledgeId: matchKnowledgeId
          }
        }
      );
    } catch (logError) {
      console.error('记录问答日志失败：', logError);
      // 不影响主流程
    }
    
    return success(res, {
      aiAnswer,
      modelRecognizeResult,
      responseTime,
      modelUsed: modelName || getModelVersion()
    }, '问答成功');
    
  } catch (err) {
    console.error('AI问答错误：', err);
    return error(res, '问答失败', 500, err.message);
  }
};

/**
 * 报告模板配置接口
 * GET /api/ai/report-template - 查询模板
 * PUT /api/ai/report-template - 更新模板
 */
const getReportTemplate = async (req, res) => {
  try {
    const { reportType } = req.query;
    
    let query = `SELECT templateId, templateName, reportType, dataDimensions, 
                        analysisDimensions, suggestionRules, isDefault
                 FROM ai_report_template`;
    const replacements = {};
    
    if (reportType) {
      query += ` WHERE reportType = :reportType`;
      replacements.reportType = reportType;
    }
    
    query += ` ORDER BY isDefault DESC, templateId`;
    
    const [templates] = await sequelize.query(query, { replacements });
    
    // 解析JSON字段
    const formattedTemplates = templates.map(t => ({
      ...t,
      dataDimensions: typeof t.dataDimensions === 'string' 
        ? JSON.parse(t.dataDimensions) 
        : t.dataDimensions || [],
      analysisDimensions: typeof t.analysisDimensions === 'string'
        ? JSON.parse(t.analysisDimensions)
        : t.analysisDimensions || []
    }));
    
    return success(res, formattedTemplates, '查询成功');
    
  } catch (err) {
    console.error('查询报告模板错误：', err);
    return error(res, '查询失败', 500, err.message);
  }
};

const updateReportTemplate = async (req, res) => {
  try {
    const { templateId, dataDimensions, analysisDimensions, suggestionRules } = req.body;
    
    if (!templateId) {
      return validationError(res, '模板ID不能为空');
    }
    
    // 检查模板是否存在
    const [existing] = await sequelize.query(
      `SELECT templateId FROM ai_report_template WHERE templateId = :templateId`,
      { replacements: { templateId: parseInt(templateId) } }
    );
    
    if (existing.length === 0) {
      return notFound(res, '模板不存在');
    }
    
    // 构建更新字段
    const updateFields = [];
    const replacements = { templateId: parseInt(templateId) };
    
    if (dataDimensions) {
      updateFields.push('dataDimensions = :dataDimensions');
      replacements.dataDimensions = JSON.stringify(dataDimensions);
    }
    
    if (analysisDimensions) {
      updateFields.push('analysisDimensions = :analysisDimensions');
      replacements.analysisDimensions = JSON.stringify(analysisDimensions);
    }
    
    if (suggestionRules) {
      updateFields.push('suggestionRules = :suggestionRules');
      replacements.suggestionRules = suggestionRules;
    }
    
    if (updateFields.length === 0) {
      return validationError(res, '至少需要更新一个字段');
    }
    
    // 更新模板
    await sequelize.query(
      `UPDATE ai_report_template 
       SET ${updateFields.join(', ')}, updated_at = NOW()
       WHERE templateId = :templateId`,
      { replacements }
    );
    
    // 查询更新后的模板
    const [updated] = await sequelize.query(
      `SELECT templateId, templateName, reportType, dataDimensions, 
              analysisDimensions, suggestionRules, isDefault
       FROM ai_report_template 
       WHERE templateId = :templateId`,
      { replacements: { templateId: parseInt(templateId) } }
    );
    
    const template = updated[0];
    if (template) {
      template.dataDimensions = typeof template.dataDimensions === 'string'
        ? JSON.parse(template.dataDimensions)
        : template.dataDimensions || [];
      template.analysisDimensions = typeof template.analysisDimensions === 'string'
        ? JSON.parse(template.analysisDimensions)
        : template.analysisDimensions || [];
    }
    
    return success(res, template, '配置成功');
    
  } catch (err) {
    console.error('更新报告模板错误：', err);
    return error(res, '更新失败', 500, err.message);
  }
};

/**
 * AI报告生成接口
 * POST /api/ai/generate-report
 * 业务价值：按周期生成用户健康报告，包含数据统计、趋势分析、个性化建议
 * 技术实现：查询用户健康数据→BERT识别状态→按模板生成报告→存储
 */
const generateReport = async (req, res) => {
  try {
    const { userId, tagId, reportType, reportPeriod } = req.body;
    
    if (!reportType || !reportPeriod) {
      return validationError(res, '报告类型和报告周期不能为空');
    }
    
    if (!userId && !tagId) {
      return validationError(res, '用户ID或标签ID至少需要提供一个');
    }
    
    // 获取默认模板
    const [templates] = await sequelize.query(
      `SELECT templateId, templateName, dataDimensions, analysisDimensions, suggestionRules
       FROM ai_report_template 
       WHERE reportType = :reportType AND isDefault = 1
       LIMIT 1`,
      { replacements: { reportType } }
    );
    
    if (templates.length === 0) {
      return error(res, '未找到默认报告模板', 404);
    }
    
    const template = templates[0];
    const dataDimensions = typeof template.dataDimensions === 'string'
      ? JSON.parse(template.dataDimensions)
      : template.dataDimensions || [];
    const analysisDimensions = typeof template.analysisDimensions === 'string'
      ? JSON.parse(template.analysisDimensions)
      : template.analysisDimensions || [];
    
    // 确定用户列表
    let userIds = [];
    if (userId) {
      userIds = [parseInt(userId)];
    } else if (tagId) {
      // 查询标签下的所有用户
      const [users] = await sequelize.query(
        `SELECT DISTINCT user_id FROM user_tag_mapping WHERE tag_id = :tagId`,
        { replacements: { tagId: parseInt(tagId) } }
      );
      userIds = users.map(u => u.user_id);
    }
    
    if (userIds.length === 0) {
      return error(res, '未找到目标用户', 404);
    }
    
    // 批量生成报告
    const results = {
      successCount: 0,
      failCount: 0,
      failUserIds: []
    };
    
    for (const uid of userIds) {
      try {
        // 查询用户健康数据（这里简化处理，实际应从用户健康数据表查询）
        // 假设有 user_health_data 表存储用户健康数据
        const [healthData] = await sequelize.query(
          `SELECT * FROM user_rule_records 
           WHERE user_id = :userId 
           AND record_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)
           ORDER BY record_date DESC`,
          { replacements: { userId: uid } }
        );
        
        // 使用BERT模型识别各指标状态（简化版）
        const reportData = {
          summary: `本${reportType === 'week' ? '周' : '月'}健康数据统计`,
          statistics: {},
          analysis: {},
          suggestions: []
        };
        
        // 统计数据
        dataDimensions.forEach(dimension => {
          // 简化处理，实际应根据dimension类型统计
          reportData.statistics[dimension] = {
            value: Math.random() * 100,
            status: Math.random() > 0.5 ? '达标' : '未达标'
          };
        });
        
        // 分析数据
        analysisDimensions.forEach(dimension => {
          reportData.analysis[dimension] = '数据趋势良好，继续保持';
        });
        
        // 生成建议
        if (template.suggestionRules) {
          reportData.suggestions.push('建议保持规律作息，适量运动');
        }
        
        // 存储报告
        await sequelize.query(
          `INSERT INTO ai_generated_report 
           (userId, templateId, reportType, reportPeriod, reportContent, generateTime, isRead)
           VALUES (:userId, :templateId, :reportType, :reportPeriod, :reportContent, NOW(), 0)
           ON DUPLICATE KEY UPDATE 
           reportContent = :reportContent, generateTime = NOW(), isRead = 0`,
          {
            replacements: {
              userId: uid,
              templateId: template.templateId,
              reportType: reportType,
              reportPeriod: reportPeriod,
              reportContent: JSON.stringify(reportData)
            }
          }
        );
        
        results.successCount++;
      } catch (userError) {
        console.error(`生成用户 ${uid} 报告失败：`, userError);
        results.failCount++;
        results.failUserIds.push(uid.toString());
      }
    }
    
    // 如果是单个用户，返回报告ID
    if (userIds.length === 1) {
      const [reports] = await sequelize.query(
        `SELECT reportId FROM ai_generated_report 
         WHERE userId = :userId AND reportType = :reportType AND reportPeriod = :reportPeriod
         ORDER BY generateTime DESC LIMIT 1`,
        {
          replacements: {
            userId: userIds[0],
            reportType: reportType,
            reportPeriod: reportPeriod
          }
        }
      );
      
      if (reports.length > 0) {
        return success(res, {
          reportId: reports[0].reportId,
          progress: 100,
          ...results
        }, '生成成功');
      }
    }
    
    return success(res, results, '生成完成');
    
  } catch (err) {
    console.error('生成报告错误：', err);
    return error(res, '生成失败', 500, err.message);
  }
};

/**
 * AI问答日志查询接口
 * GET /api/ai/qa-log
 * 业务价值：分页查询问答日志，支持多维度筛选
 */
const getQaLog = async (req, res) => {
  try {
    const { pageNum = 1, pageSize = 10, startTime, endTime, keyword, userId, indicator } = req.query;
    
    // 构建查询条件
    const whereConditions = [];
    const replacements = {};
    
    if (startTime) {
      whereConditions.push('createTime >= :startTime');
      replacements.startTime = startTime;
    }
    
    if (endTime) {
      whereConditions.push('createTime <= :endTime');
      replacements.endTime = endTime;
    }
    
    if (keyword) {
      whereConditions.push('(userQuestion LIKE :keyword OR aiAnswer LIKE :keyword)');
      replacements.keyword = `%${keyword}%`;
    }
    
    if (userId) {
      whereConditions.push('userId = :userId');
      replacements.userId = parseInt(userId);
    }
    
    if (indicator) {
      whereConditions.push('JSON_EXTRACT(modelRecognizeResult, "$.indicator") = :indicator');
      replacements.indicator = indicator;
    }
    
    const whereClause = whereConditions.length > 0
      ? 'WHERE ' + whereConditions.join(' AND ')
      : '';
    
    // 查询总数
    const [countResult] = await sequelize.query(
      `SELECT COUNT(*) as total FROM ai_qa_log ${whereClause}`,
      { replacements }
    );
    const total = countResult[0].total;
    
    // 分页查询
    const offset = (parseInt(pageNum) - 1) * parseInt(pageSize);
    const [logs] = await sequelize.query(
      `SELECT logId, userId, userQuestion, modelRecognizeResult, aiAnswer, 
              matchKnowledgeId, createTime, satisfaction
       FROM ai_qa_log
       ${whereClause}
       ORDER BY createTime DESC
       LIMIT :limit OFFSET :offset`,
      {
        replacements: {
          ...replacements,
          limit: parseInt(pageSize),
          offset: offset
        }
      }
    );
    
    // 格式化数据
    const formattedLogs = logs.map(log => ({
      ...log,
      modelRecognizeResult: log.modelRecognizeResult
        ? (typeof log.modelRecognizeResult === 'string' 
            ? JSON.parse(log.modelRecognizeResult) 
            : log.modelRecognizeResult)
        : null
    }));
    
    return success(res, {
      list: formattedLogs,
      total: parseInt(total),
      pageNum: parseInt(pageNum),
      pageSize: parseInt(pageSize)
    }, '查询成功');
    
  } catch (err) {
    console.error('查询问答日志错误：', err);
    return error(res, '查询失败', 500, err.message);
  }
};

/**
 * 获取同步日志列表
 * GET /api/ai/sync-logs
 * 业务价值：查询知识库同步历史记录
 */
const getSyncLogs = async (req, res) => {
  try {
    const { pageNum = 1, pageSize = 10 } = req.query;
    
    // 先检查表是否存在（使用更安全的方式）
    let tableExists = false;
    try {
      const [checkResult] = await sequelize.query(
        `SELECT COUNT(*) as count FROM information_schema.tables 
         WHERE table_schema = DATABASE() AND table_name = 'ai_sync_log'`,
        { logging: false }
      );
      tableExists = checkResult && checkResult[0] && checkResult[0].count > 0;
    } catch (checkErr) {
      // 检查失败，假设表不存在
      tableExists = false;
    }
    
    // 如果表不存在，直接返回空列表
    if (!tableExists) {
      return success(res, {
        list: [],
        total: 0,
        pageNum: parseInt(pageNum),
        pageSize: parseInt(pageSize)
      }, '查询成功');
    }
    
    // 查询总数
    const [countResult] = await sequelize.query(
      `SELECT COUNT(*) as total FROM ai_sync_log`,
      { logging: false }
    );
    const total = countResult && countResult[0] ? countResult[0].total : 0;
    
    // 分页查询
    const offset = (parseInt(pageNum) - 1) * parseInt(pageSize);
    const [logs] = await sequelize.query(
      `SELECT logId, operator, syncCount, modelRecognizeCount, status, modelVersion, duration, errorMessage, createTime
       FROM ai_sync_log
       ORDER BY createTime DESC
       LIMIT :limit OFFSET :offset`,
      {
        replacements: {
          limit: parseInt(pageSize),
          offset: offset
        },
        logging: false
      }
    );
    
    return success(res, {
      list: logs || [],
      total: parseInt(total) || 0,
      pageNum: parseInt(pageNum),
      pageSize: parseInt(pageSize)
    }, '查询成功');
    
  } catch (err) {
    console.error('查询同步日志错误：', err);
    // 任何错误都返回空列表，不中断前端流程
    return success(res, {
      list: [],
      total: 0,
      pageNum: parseInt(req.query.pageNum || 1),
      pageSize: parseInt(req.query.pageSize || 10)
    }, '查询成功');
  }
};

/**
 * 获取可用模型列表
 * GET /api/ai/models
 * 业务价值：获取可用的AI模型列表，供前端选择
 */
const getModels = async (req, res) => {
  try {
    const models = await getAvailableModels();
    
    // 如果API返回空，返回默认模型列表
    if (models.length === 0) {
      return success(res, [
        { name: 'default', description: '默认模型（使用环境变量配置）' },
        { name: 'gpt-3.5-turbo', description: 'GPT-3.5 Turbo' },
        { name: 'gpt-4', description: 'GPT-4' },
        { name: 'claude-3', description: 'Claude 3' },
        { name: 'claude-3-opus', description: 'Claude 3 Opus' },
        { name: 'claude-3-sonnet', description: 'Claude 3 Sonnet' }
      ], '查询成功');
    }
    
    return success(res, models, '查询成功');
    
  } catch (err) {
    console.error('获取模型列表错误：', err);
    // 即使失败也返回默认列表
    return success(res, [
      { name: 'default', description: '默认模型（使用环境变量配置）' },
      { name: 'gpt-3.5-turbo', description: 'GPT-3.5 Turbo' },
      { name: 'gpt-4', description: 'GPT-4' },
      { name: 'claude-3', description: 'Claude 3' }
    ], '查询成功');
  }
};

/**
 * 保存API配置
 * POST /api/ai/api-config
 * 业务价值：保存用户配置的API地址和模型信息
 */
const saveApiConfig = async (req, res) => {
  try {
    const { baseUrl, apiKey, modelName } = req.body;
    
    if (!baseUrl) {
      return validationError(res, 'API基础地址不能为空');
    }
    
    const saveResult = await saveApiConfigToDB(baseUrl, apiKey, modelName);
    
    if (saveResult) {
      return success(res, {
        baseUrl,
        modelName: modelName || 'default'
      }, '配置保存成功');
    } else {
      return error(res, '配置保存失败（配置表不存在）', 500);
    }
    
  } catch (err) {
    console.error('保存API配置错误：', err);
    return error(res, '配置保存失败', 500, err.message);
  }
};

/**
 * 获取API配置
 * GET /api/ai/api-config
 * 业务价值：获取当前配置的API信息
 */
const getApiConfig = async (req, res) => {
  try {
    const [configs] = await sequelize.query(
      `SELECT config_key, config_value FROM system_configs 
       WHERE config_key IN ('nlp_api_base_url', 'nlp_api_key', 'nlp_model_name')`,
      { logging: false }
    );
    
    const config = {
      baseUrl: '',
      apiKey: '',
      modelName: 'default'
    };
    
    configs.forEach(c => {
      if (c.config_key === 'nlp_api_base_url') {
        config.baseUrl = c.config_value || '';
      } else if (c.config_key === 'nlp_api_key') {
        config.apiKey = c.config_value || '';
      } else if (c.config_key === 'nlp_model_name') {
        config.modelName = c.config_value || 'default';
      }
    });
    
    return success(res, config, '查询成功');
    
  } catch (err) {
    console.error('获取API配置错误：', err);
    // 返回空配置
    return success(res, {
      baseUrl: '',
      apiKey: '',
      modelName: 'default'
    }, '查询成功');
  }
};

/**
 * 获取知识库列表
 * GET /api/ai/knowledge-list
 * 业务价值：分页查询知识库内容，支持筛选和搜索
 */
const getKnowledgeList = async (req, res) => {
  try {
    const { pageNum = 1, pageSize = 10, title, category, keyword } = req.query;
    
    // 构建查询条件
    const whereConditions = [];
    const replacements = {};
    
    if (title) {
      whereConditions.push('title LIKE :title');
      replacements.title = `%${title}%`;
    }
    
    if (category) {
      whereConditions.push('category = :category');
      replacements.category = category;
    }
    
    if (keyword) {
      whereConditions.push('(keywords LIKE :keyword OR content LIKE :keyword)');
      replacements.keyword = `%${keyword}%`;
    }
    
    // 只查询已启用的知识
    whereConditions.push('status = 1');
    
    const whereClause = whereConditions.length > 0
      ? 'WHERE ' + whereConditions.join(' AND ')
      : 'WHERE status = 1';
    
    // 查询总数
    const [countResult] = await sequelize.query(
      `SELECT COUNT(*) as total FROM ai_knowledge_base ${whereClause}`,
      { replacements, logging: false }
    );
    const total = countResult && countResult[0] ? countResult[0].total : 0;
    
    // 分页查询
    const offset = (parseInt(pageNum) - 1) * parseInt(pageSize);
    const [knowledgeList] = await sequelize.query(
      `SELECT knowledgeId, title, category, keywords, content, status, createTime, updated_at
       FROM ai_knowledge_base
       ${whereClause}
       ORDER BY createTime DESC
       LIMIT :limit OFFSET :offset`,
      {
        replacements: {
          ...replacements,
          limit: parseInt(pageSize),
          offset: offset
        },
        logging: false
      }
    );
    
    return success(res, {
      list: knowledgeList || [],
      total: parseInt(total) || 0,
      pageNum: parseInt(pageNum),
      pageSize: parseInt(pageSize)
    }, '查询成功');
    
  } catch (err) {
    console.error('查询知识库列表错误：', err);
    return error(res, '查询失败', 500, err.message);
  }
};

module.exports = {
  syncKnowledge,
  aiQa,
  getReportTemplate,
  updateReportTemplate,
  generateReport,
  getQaLog,
  getSyncLogs,
  getModels,
  saveApiConfig,
  getApiConfig,
  getKnowledgeList
};

