/**
 * AI生成报告模型
 * 存储生成的用户报告
 */

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const AIGeneratedReport = sequelize.define('AIGeneratedReport', {
  reportId: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    field: 'reportId',
    comment: '报告ID（主键）'
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'userId',
    comment: '用户ID',
    index: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  templateId: {
    type: DataTypes.INTEGER,
    field: 'templateId',
    comment: '关联模板ID',
    references: {
      model: 'ai_report_template',
      key: 'templateId'
    }
  },
  reportType: {
    type: DataTypes.STRING(20),
    allowNull: false,
    field: 'reportType',
    comment: '报告类型：week-周报，month-月报',
    index: true
  },
  reportPeriod: {
    type: DataTypes.STRING(50),
    allowNull: false,
    field: 'reportPeriod',
    comment: '报告周期（如"2024-10 第1周"）',
    index: true
  },
  reportContent: {
    type: DataTypes.JSON,
    field: 'reportContent',
    comment: '报告内容JSON'
  },
  generateTime: {
    type: DataTypes.DATE,
    field: 'generateTime',
    defaultValue: DataTypes.NOW,
    comment: '生成时间',
    index: true
  },
  isRead: {
    type: DataTypes.TINYINT,
    defaultValue: 0,
    field: 'isRead',
    comment: '是否已读：0-否，1-是',
    index: true
  }
}, {
  tableName: 'ai_generated_report',
  timestamps: false,
  underscored: false,
  comment: 'AI生成报告表'
});

module.exports = AIGeneratedReport;

