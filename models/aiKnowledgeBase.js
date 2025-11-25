/**
 * AI知识库模型
 * 存储同步后的健康科普内容，供模型调用
 */

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const AIKnowledgeBase = sequelize.define('AIKnowledgeBase', {
  knowledgeId: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    field: 'knowledgeId',
    comment: '知识ID（主键）'
  },
  title: {
    type: DataTypes.STRING(200),
    allowNull: false,
    comment: '标题'
  },
  category: {
    type: DataTypes.STRING(50),
    comment: '分类（如饮食/运动/睡眠/饮水）',
    index: true
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: '正文'
  },
  keywords: {
    type: DataTypes.STRING(500),
    comment: '模型提取关键词（逗号分隔）'
  },
  status: {
    type: DataTypes.TINYINT,
    defaultValue: 1,
    comment: '上架状态：1-已上架，0-已下架',
    index: true
  },
  createTime: {
    type: DataTypes.DATE,
    field: 'createTime',
    defaultValue: DataTypes.NOW,
    comment: '创建时间',
    index: true
  }
}, {
  tableName: 'ai_knowledge_base',
  timestamps: true,
  underscored: false,
  createdAt: 'createTime',
  updatedAt: 'updated_at',
  comment: 'AI知识库表'
});

module.exports = AIKnowledgeBase;

