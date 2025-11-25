/**
 * NLP模型工具
 * 支持外部API调用，可选择不同的模型进行问答和数据分析
 * 核心功能：关键词提取、健康数据识别、文本相似度计算、问答生成
 * 
 * 配置说明：
 * - NLP_API_BASE_URL: API基础地址（如：https://api.example.com）
 * - NLP_API_KEY: API密钥（如果需要）
 * - NLP_MODEL_NAME: 默认使用的模型名称（如：gpt-3.5-turbo, claude-3, etc.）
 * - 支持在调用时指定不同的模型
 */

require('dotenv').config();
const axios = require('axios');
const { sequelize } = require('../config/db');

// 从环境变量或数据库配置中获取API配置
let NLP_API_BASE_URL = process.env.NLP_API_BASE_URL || process.env.NLP_API_URL || '';
let NLP_API_KEY = process.env.NLP_API_KEY || '';
let NLP_MODEL_NAME = process.env.NLP_MODEL_NAME || 'default';

/**
 * 从数据库加载API配置（如果存在）
 */
const loadApiConfigFromDB = async () => {
  try {
    const [configs] = await sequelize.query(
      `SELECT config_key, config_value FROM system_configs 
       WHERE config_key IN ('nlp_api_base_url', 'nlp_api_key', 'nlp_model_name')`,
      { logging: false }
    );
    
    configs.forEach(config => {
      if (config.config_key === 'nlp_api_base_url' && config.config_value) {
        NLP_API_BASE_URL = config.config_value;
      } else if (config.config_key === 'nlp_api_key' && config.config_value) {
        NLP_API_KEY = config.config_value;
      } else if (config.config_key === 'nlp_model_name' && config.config_value) {
        NLP_MODEL_NAME = config.config_value;
      }
    });
  } catch (err) {
    // 配置表不存在或查询失败，使用环境变量
    console.warn('从数据库加载API配置失败，使用环境变量：', err.message);
  }
};

// 启动时加载配置
loadApiConfigFromDB();

/**
 * 保存API配置到数据库
 */
const saveApiConfigToDB = async (baseUrl, apiKey, modelName) => {
  try {
    // 检查配置表是否存在
    const [tableCheck] = await sequelize.query(
      `SELECT COUNT(*) as count FROM information_schema.tables 
       WHERE table_schema = DATABASE() AND table_name = 'system_configs'`,
      { logging: false }
    );
    
    if (!tableCheck || !tableCheck[0] || tableCheck[0].count === 0) {
      return false; // 表不存在
    }
    
    // 保存配置
    if (baseUrl) {
      await sequelize.query(
        `INSERT INTO system_configs (config_key, config_value, config_type, config_desc, group_name, updated_at)
         VALUES ('nlp_api_base_url', :value, 'string', 'NLP API基础地址', 'ai_config', NOW())
         ON DUPLICATE KEY UPDATE config_value = :value, updated_at = NOW()`,
        { replacements: { value: baseUrl }, logging: false }
      );
      NLP_API_BASE_URL = baseUrl;
    }
    
    if (apiKey) {
      await sequelize.query(
        `INSERT INTO system_configs (config_key, config_value, config_type, config_desc, group_name, updated_at)
         VALUES ('nlp_api_key', :value, 'string', 'NLP API密钥', 'ai_config', NOW())
         ON DUPLICATE KEY UPDATE config_value = :value, updated_at = NOW()`,
        { replacements: { value: apiKey }, logging: false }
      );
      NLP_API_KEY = apiKey;
    }
    
    if (modelName) {
      await sequelize.query(
        `INSERT INTO system_configs (config_key, config_value, config_type, config_desc, group_name, updated_at)
         VALUES ('nlp_model_name', :value, 'string', 'NLP模型名称', 'ai_config', NOW())
         ON DUPLICATE KEY UPDATE config_value = :value, updated_at = NOW()`,
        { replacements: { value: modelName }, logging: false }
      );
      NLP_MODEL_NAME = modelName;
    }
    
    return true;
  } catch (err) {
    console.error('保存API配置失败：', err);
    return false;
  }
};

/**
 * 调用外部NLP API
 * @param {String} task - 任务类型：extract_keywords, qa, analyze, similarity
 * @param {Object} params - 任务参数
 * @param {String} modelName - 模型名称（可选，默认使用配置的模型）
 * @returns {Object} API响应结果
 */
const callNLPAPI = async (task, params, modelName = null) => {
  if (!NLP_API_BASE_URL) {
    return null; // 未配置API，返回null
  }

  const model = modelName || NLP_MODEL_NAME;
  const apiUrl = `${NLP_API_BASE_URL}/api/${task}`;

  try {
    const response = await axios.post(apiUrl, {
      ...params,
      model: model,
      task: task
    }, {
      headers: {
        'Content-Type': 'application/json',
        ...(NLP_API_KEY ? { 'Authorization': `Bearer ${NLP_API_KEY}` } : {})
      },
      timeout: 10000 // 10秒超时
    });

    if (response.data) {
      return response.data;
    }
    return null;
  } catch (error) {
    console.warn(`NLP API调用失败（${task}），使用降级方案：`, error.message);
    return null;
  }
};

/**
 * 调用外部NLP API提取关键词
 * @param {String} text - 输入文本
 * @param {String} modelName - 模型名称（可选）
 * @returns {Array<String>} 关键词数组
 */
const callNLPAPIForKeywords = async (text, modelName = null) => {
  const result = await callNLPAPI('extract_keywords', {
    text: text,
    max_keywords: 10
  }, modelName);
  
  if (result && result.keywords) {
    return result.keywords;
  }
  return null;
};

/**
 * 提取文本关键词
 * 业务价值：从健康科普内容中提取关键信息，用于知识库索引和问答匹配
 * @param {String} text - 输入文本
 * @param {String} modelName - 模型名称（可选）
 * @returns {Array<String>} 关键词数组
 */
const extractKeywords = async (text, modelName = null) => {
  try {
    // 优先尝试调用外部NLP API
    const apiKeywords = await callNLPAPIForKeywords(text, modelName);
    if (apiKeywords && apiKeywords.length > 0) {
      return apiKeywords;
    }

    // API调用失败或未配置，使用简单分词方法
    const words = text.match(/[\u4e00-\u9fa5]{2,}|[a-zA-Z]{2,}/g) || [];
    const wordFreq = {};
    words.forEach(word => {
      if (word.length > 1) {
        wordFreq[word] = (wordFreq[word] || 0) + 1;
      }
    });
    
    // 返回频率最高的前10个词作为关键词
    const keywords = Object.entries(wordFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);
    
    return keywords.length > 0 ? keywords : text.split(/[，。、；：！？\s]+/).filter(word => word.length > 1).slice(0, 10);
  } catch (error) {
    console.error('关键词提取失败：', error);
    // 降级处理：返回简单分词结果
    return text.split(/[，。、；：！？\s]+/).filter(word => word.length > 1).slice(0, 10);
  }
};

/**
 * AI问答生成
 * @param {String} question - 用户问题
 * @param {String} context - 上下文信息（知识库内容等）
 * @param {String} modelName - 模型名称（可选）
 * @returns {String} AI回答
 */
const generateAnswer = async (question, context = '', modelName = null) => {
  try {
    const result = await callNLPAPI('qa', {
      question: question,
      context: context,
      max_length: 500
    }, modelName);
    
    if (result && result.answer) {
      return result.answer;
    }
    return null;
  } catch (error) {
    console.error('AI问答生成失败：', error);
    return null;
  }
};

/**
 * 数据分析
 * @param {Object} data - 要分析的数据
 * @param {String} analysisType - 分析类型（trend, summary, insight等）
 * @param {String} modelName - 模型名称（可选）
 * @returns {Object} 分析结果
 */
const analyzeData = async (data, analysisType = 'summary', modelName = null) => {
  try {
    const result = await callNLPAPI('analyze', {
      data: data,
      analysis_type: analysisType
    }, modelName);
    
    if (result && result.analysis) {
      return result.analysis;
    }
    return null;
  } catch (error) {
    console.error('数据分析失败：', error);
    return null;
  }
};

/**
 * 识别健康数据状态
 * 业务价值：从用户问题中提取健康指标和数值，判断是否达标
 * @param {String} question - 用户问题
 * @param {Array<Object>} rules - 健康识别规则数组
 * @returns {Object} 识别结果 { indicator, value, status, suggestion }
 */
const recognizeHealthData = async (question, rules = []) => {
  try {
    // 从问题中提取数字和指标关键词
    const numbers = question.match(/\d+/g) || [];
    const extractedNumbers = numbers.map(n => parseInt(n));
    
    // 匹配规则
    for (const rule of rules) {
      const keywords = rule.keyword.split(',').map(k => k.trim());
      
      // 检查问题中是否包含关键词
      const hasKeyword = keywords.some(keyword => question.includes(keyword));
      
      if (hasKeyword && extractedNumbers.length > 0) {
        const value = extractedNumbers[0];
        const threshold = rule.threshold;
        
        // 解析阈值（支持范围，如 "7-9小时"、"10000步"）
        let status = '未达标';
        let suggestion = rule.suggestion || '';
        
        if (threshold.includes('-')) {
          // 范围阈值（如 "7-9小时"）
          const [min, max] = threshold.split('-').map(s => parseInt(s.match(/\d+/)?.[0] || 0));
          if (value >= min && value <= max) {
            status = '达标';
          } else if (value < min) {
            status = '未达标';
          } else {
            status = '超额';
          }
        } else {
          // 单值阈值（如 "10000步"）
          const target = parseInt(threshold.match(/\d+/)?.[0] || 0);
          if (value >= target) {
            status = '达标';
          } else {
            status = '未达标';
          }
        }
        
        return {
          indicator: rule.healthIndicator,
          value: value,
          status: status,
          suggestion: suggestion,
          threshold: threshold
        };
      }
    }
    
    // 未匹配到规则
    return null;
  } catch (error) {
    console.error('健康数据识别失败：', error);
    return null;
  }
};

/**
 * 文本相似度计算（用于问答匹配）
 * 业务价值：计算用户问题与知识库内容的相似度，找到最相关的答案
 * @param {String} text1 - 文本1
 * @param {String} text2 - 文本2
 * @param {String} modelName - 模型名称（可选）
 * @returns {Number} 相似度分数（0-1）
 */
const calculateSimilarity = async (text1, text2, modelName = null) => {
  try {
    // 优先使用API计算相似度
    const result = await callNLPAPI('similarity', {
      text1: text1,
      text2: text2
    }, modelName);
    
    if (result && typeof result.similarity === 'number') {
      return result.similarity;
    }
    
    // API调用失败，使用简单的词汇重叠度计算相似度
    const words1 = new Set(text1.split(/[\s，。、；：！？]+/).filter(w => w.length > 1));
    const words2 = new Set(text2.split(/[\s，。、；：！？]+/).filter(w => w.length > 1));
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    return union.size > 0 ? intersection.size / union.size : 0;
  } catch (error) {
    console.error('相似度计算失败：', error);
    return 0;
  }
};

/**
 * 获取模型版本信息
 */
const getModelVersion = () => {
  return NLP_MODEL_NAME || 'API-v1.0';
};

/**
 * 获取可用的模型列表（从API获取）
 */
const getAvailableModels = async () => {
  try {
    if (!NLP_API_BASE_URL) {
      return [];
    }
    
    const result = await callNLPAPI('list_models', {});
    if (result && result.models) {
      return result.models;
    }
    return [];
  } catch (error) {
    console.warn('获取模型列表失败：', error.message);
    return [];
  }
};

module.exports = {
  extractKeywords,
  recognizeHealthData,
  calculateSimilarity,
  generateAnswer,
  analyzeData,
  getModelVersion,
  getAvailableModels,
  saveApiConfigToDB,
  loadApiConfigFromDB
};

