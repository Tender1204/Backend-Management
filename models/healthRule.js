/**
 * 健康规则模型
 * 用于存储健康规则配置
 */

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const HealthRule = sequelize.define('HealthRule', {
  ruleId: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    field: 'rule_id',
    comment: '规则ID'
  },
  ruleName: {
    type: DataTypes.STRING(100),
    allowNull: false,
    field: 'rule_name',
    comment: '规则名称'
  },
  indicatorName: {
    type: DataTypes.STRING(100),
    allowNull: false,
    field: 'indicator_name',
    comment: '指标名称（关联标准字典表）',
    index: true
  },
  category: {
    type: DataTypes.STRING(50),
    field: 'category',
    comment: '指标分类（关联字典表）',
    index: true
  },
  sourceDictId: {
    type: DataTypes.INTEGER,
    field: 'source_dict_id',
    comment: '关联标准字典表ID',
    references: {
      model: 'health_standard_dict',
      key: 'dict_id'
    },
    index: true
  },
  thresholdValue: {
    type: DataTypes.STRING(200),
    allowNull: false,
    field: 'threshold_value',
    comment: '阈值（如：2500ml）'
  },
  thresholdUnit: {
    type: DataTypes.STRING(20),
    field: 'threshold_unit',
    comment: '阈值单位（如：ml、kcal、步、分钟）'
  },
  authorityExplanation: {
    type: DataTypes.TEXT,
    field: 'authority_explanation',
    comment: '权威解释'
  },
  effectWay: {
    type: DataTypes.TINYINT,
    defaultValue: 1,
    field: 'effect_way',
    comment: '生效方式：1-即时生效，2-定时生效',
    index: true
  },
  effectTime: {
    type: DataTypes.DATE,
    field: 'effect_time',
    comment: '定时生效时间',
    index: true
  },
  status: {
    type: DataTypes.TINYINT,
    defaultValue: 1,
    comment: '状态：1-启用，0-禁用',
    index: true
  },
  createdBy: {
    type: DataTypes.INTEGER,
    field: 'created_by',
    comment: '创建人（管理员ID）'
  },
  createdAt: {
    type: DataTypes.DATE,
    field: 'created_at',
    defaultValue: DataTypes.NOW
  },
  updatedAt: {
    type: DataTypes.DATE,
    field: 'updated_at',
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'health_rule',
  timestamps: true,
  underscored: true,
  comment: '健康规则表'
});

module.exports = HealthRule;

