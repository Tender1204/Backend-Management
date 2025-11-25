/**
 * 知识库索引工具
 * 基于 TF-IDF + 余弦相似度的简易问答模型
 * 业务价值：提升问答匹配效率，快速找到最相关的健康知识
 */

const { sequelize } = require('../config/db');
const { calculateSimilarity } = require('./nlpModel');

// 内存缓存：知识库索引
let knowledgeIndex = null;
let indexVersion = 0;

/**
 * 构建知识库索引
 * 技术实现：使用 TF-IDF 向量库生成文本索引，提升问答匹配效率
 * @returns {Object} 索引对象 { documents, vectors, keywords }
 */
const buildKnowledgeIndex = async () => {
  try {
    console.log('📚 开始构建知识库索引...');
    
    // 查询所有已上架的知识库内容
    const [knowledgeList] = await sequelize.query(
      `SELECT knowledgeId, title, content, keywords, category 
       FROM ai_knowledge_base 
       WHERE status = 1 
       ORDER BY knowledgeId`
    );
    
    if (!knowledgeList || knowledgeList.length === 0) {
      console.log('⚠️  知识库为空，无法构建索引');
      return null;
    }
    
    // 构建文档向量
    const documents = knowledgeList.map(item => ({
      id: item.knowledgeId,
      title: item.title,
      content: item.content,
      keywords: item.keywords ? item.keywords.split(',') : [],
      category: item.category,
      text: `${item.title} ${item.content}` // 合并标题和内容用于匹配
    }));
    
    // 计算 TF-IDF 向量（简化版）
    const allWords = new Set();
    documents.forEach(doc => {
      const words = doc.text.match(/[\u4e00-\u9fa5]+|[a-zA-Z]+/g) || [];
      words.forEach(word => {
        if (word.length > 1) {
          allWords.add(word);
        }
      });
    });
    
    const wordList = Array.from(allWords);
    const vectors = [];
    
    // 为每个文档计算 TF-IDF 向量
    documents.forEach((doc, docIndex) => {
      const words = doc.text.match(/[\u4e00-\u9fa5]+|[a-zA-Z]+/g) || [];
      const wordFreq = {};
      words.forEach(word => {
        if (word.length > 1) {
          wordFreq[word] = (wordFreq[word] || 0) + 1;
        }
      });
      
      // 计算 TF
      const tf = {};
      const totalWords = words.length;
      Object.keys(wordFreq).forEach(word => {
        tf[word] = wordFreq[word] / totalWords;
      });
      
      // 计算 IDF
      const idf = {};
      wordList.forEach(word => {
        const docsContainingWord = documents.filter(d => 
          d.text.includes(word)
        ).length;
        idf[word] = Math.log(documents.length / (docsContainingWord + 1));
      });
      
      // 计算 TF-IDF 向量
      const vector = wordList.map(word => {
        return (tf[word] || 0) * (idf[word] || 0);
      });
      
      vectors.push(vector);
    });
    
    knowledgeIndex = {
      documents,
      vectors,
      wordList,
      version: ++indexVersion,
      buildTime: new Date()
    };
    
    console.log(`✅ 知识库索引构建完成，共 ${documents.length} 条知识`);
    return knowledgeIndex;
  } catch (error) {
    console.error('❌ 知识库索引构建失败：', error);
    throw error;
  }
};

/**
 * 搜索最相关的知识
 * 技术实现：使用 TF-IDF 向量计算余弦相似度，找到最匹配的知识
 * @param {String} query - 用户问题
 * @param {Number} topK - 返回前K个结果，默认3
 * @returns {Array<Object>} 匹配的知识列表
 */
const searchKnowledge = async (query, topK = 3) => {
  try {
    // 如果索引不存在，先构建
    if (!knowledgeIndex) {
      await buildKnowledgeIndex();
    }
    
    if (!knowledgeIndex || knowledgeIndex.documents.length === 0) {
      return [];
    }
    
    // 计算查询文本的 TF-IDF 向量
    const queryWords = query.match(/[\u4e00-\u9fa5]+|[a-zA-Z]+/g) || [];
    const queryWordFreq = {};
    queryWords.forEach(word => {
      if (word.length > 1) {
        queryWordFreq[word] = (queryWordFreq[word] || 0) + 1;
      }
    });
    
    const tf = {};
    const totalWords = queryWords.length;
    Object.keys(queryWordFreq).forEach(word => {
      tf[word] = queryWordFreq[word] / totalWords;
    });
    
    const idf = {};
    knowledgeIndex.wordList.forEach(word => {
      const docsContainingWord = knowledgeIndex.documents.filter(d => 
        d.text.includes(word)
      ).length;
      idf[word] = Math.log(knowledgeIndex.documents.length / (docsContainingWord + 1));
    });
    
    const queryVector = knowledgeIndex.wordList.map(word => {
      return (tf[word] || 0) * (idf[word] || 0);
    });
    
    // 计算与每个文档的余弦相似度
    const similarities = knowledgeIndex.documents.map((doc, index) => {
      const docVector = knowledgeIndex.vectors[index];
      
      // 计算余弦相似度
      let dotProduct = 0;
      let queryNorm = 0;
      let docNorm = 0;
      
      for (let i = 0; i < queryVector.length; i++) {
        dotProduct += queryVector[i] * docVector[i];
        queryNorm += queryVector[i] * queryVector[i];
        docNorm += docVector[i] * docVector[i];
      }
      
      const similarity = dotProduct / (Math.sqrt(queryNorm) * Math.sqrt(docNorm) + 1e-10);
      
      return {
        knowledgeId: doc.id,
        title: doc.title,
        content: doc.content,
        category: doc.category,
        similarity: similarity || 0
      };
    });
    
    // 按相似度排序，返回前K个
    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK)
      .filter(item => item.similarity > 0.1); // 过滤相似度过低的结果
  } catch (error) {
    console.error('知识搜索失败：', error);
    return [];
  }
};

/**
 * 清除索引缓存（当知识库更新时调用）
 */
const clearIndex = () => {
  knowledgeIndex = null;
  console.log('🗑️  知识库索引已清除');
};

/**
 * 获取索引信息
 */
const getIndexInfo = () => {
  if (!knowledgeIndex) {
    return { exists: false };
  }
  
  return {
    exists: true,
    documentCount: knowledgeIndex.documents.length,
    version: knowledgeIndex.version,
    buildTime: knowledgeIndex.buildTime
  };
};

module.exports = {
  buildKnowledgeIndex,
  searchKnowledge,
  clearIndex,
  getIndexInfo
};

