/**
 * AI报告模板模型
 * 配置周报/月报生成规则
 */

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const AIReportTemplate = sequelize.define('AIReportTemplate', {
  templateId: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    field: 'templateId',
    comment: '模板ID（主键）'
  },
  templateName: {
    type: DataTypes.STRING(100),
    allowNull: false,
    field: 'templateName',
    comment: '模板名称（如"通用健康周报"）'
  },
  reportType: {
    type: DataTypes.STRING(20),
    allowNull: false,
    field: 'reportType',
    comment: '报告类型：week-周报，month-月报',
    index: true
  },
  dataDimensions: {
    type: DataTypes.JSON,
    field: 'dataDimensions',
    comment: '数据维度JSON（如["步数达标率","睡眠时长分布"]）'
  },
  analysisDimensions: {
    type: DataTypes.JSON,
    field: 'analysisDimensions',
    comment: '模型分析维度JSON（如["趋势分析","状态分类"]）'
  },
  suggestionRules: {
    type: DataTypes.TEXT,
    field: 'suggestionRules',
    comment: '建议生成规则'
  },
  isDefault: {
    type: DataTypes.TINYINT,
    defaultValue: 0,
    field: 'isDefault',
    comment: '是否默认模板：1-是，0-否',
    index: true
  }
}, {
  tableName: 'ai_report_template',
  timestamps: true,
  underscored: false,
  comment: 'AI报告模板表'
});

module.exports = AIReportTemplate;

