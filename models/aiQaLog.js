/**
 * AI问答日志模型
 * 记录用户与AI的交互数据
 */

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const AIQaLog = sequelize.define('AIQaLog', {
  logId: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
    field: 'logId',
    comment: '日志ID（主键）'
  },
  userId: {
    type: DataTypes.INTEGER,
    comment: '用户ID',
    index: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  userQuestion: {
    type: DataTypes.TEXT,
    allowNull: false,
    field: 'userQuestion',
    comment: '用户问题'
  },
  modelRecognizeResult: {
    type: DataTypes.JSON,
    field: 'modelRecognizeResult',
    comment: '模型识别结果JSON（如{"指标":"步数","数值":8000}）'
  },
  aiAnswer: {
    type: DataTypes.TEXT,
    field: 'aiAnswer',
    comment: 'AI回答内容'
  },
  matchKnowledgeId: {
    type: DataTypes.INTEGER,
    field: 'matchKnowledgeId',
    comment: '匹配的知识库ID',
    index: true,
    references: {
      model: 'ai_knowledge_base',
      key: 'knowledgeId'
    }
  },
  createTime: {
    type: DataTypes.DATE,
    field: 'createTime',
    defaultValue: DataTypes.NOW,
    comment: '交互时间',
    index: true
  },
  satisfaction: {
    type: DataTypes.TINYINT,
    comment: '用户满意度：1-5星，默认null'
  }
}, {
  tableName: 'ai_qa_log',
  timestamps: false,
  underscored: false,
  comment: 'AI问答日志表'
});

module.exports = AIQaLog;

