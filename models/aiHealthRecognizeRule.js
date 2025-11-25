/**
 * 健康状态识别规则模型
 * 关联健康指标与模型识别逻辑
 */

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const AIHealthRecognizeRule = sequelize.define('AIHealthRecognizeRule', {
  ruleId: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    field: 'ruleId',
    comment: '规则ID（主键）'
  },
  healthIndicator: {
    type: DataTypes.STRING(100),
    allowNull: false,
    field: 'healthIndicator',
    comment: '健康指标（如"每日步数""睡眠时长""饮水量"）',
    index: true
  },
  keyword: {
    type: DataTypes.STRING(200),
    allowNull: false,
    comment: '模型识别关键词（如"步数""睡眠""喝水"）',
    index: true
  },
  threshold: {
    type: DataTypes.STRING(200),
    allowNull: false,
    comment: '达标阈值范围（如"10000步""7-9小时""2000ml"）'
  },
  statusDesc: {
    type: DataTypes.STRING(50),
    field: 'statusDesc',
    comment: '状态描述：达标/未达标/超额'
  },
  suggestion: {
    type: DataTypes.TEXT,
    comment: '默认建议文本'
  }
}, {
  tableName: 'ai_health_recognize_rule',
  timestamps: true,
  underscored: false,
  comment: '健康状态识别规则表'
});

module.exports = AIHealthRecognizeRule;

