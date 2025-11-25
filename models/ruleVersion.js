/**
 * 规则版本模型
 * 用于存储规则的历史版本信息
 */

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const RuleVersion = sequelize.define('RuleVersion', {
  versionId: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    field: 'version_id',
    comment: '版本ID'
  },
  ruleId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'rule_id',
    comment: '规则ID',
    references: {
      model: 'health_rule',
      key: 'rule_id'
    },
    index: true
  },
  versionNumber: {
    type: DataTypes.STRING(20),
    allowNull: false,
    field: 'version_number',
    comment: '版本号（如：V1.0、V1.1）',
    index: true
  },
  thresholdValue: {
    type: DataTypes.STRING(200),
    allowNull: false,
    field: 'threshold_value',
    comment: '阈值'
  },
  thresholdUnit: {
    type: DataTypes.STRING(20),
    field: 'threshold_unit',
    comment: '阈值单位'
  },
  authorityExplanation: {
    type: DataTypes.TEXT,
    field: 'authority_explanation',
    comment: '权威解释'
  },
  effectStatus: {
    type: DataTypes.TINYINT,
    defaultValue: 0,
    field: 'effect_status',
    comment: '版本生效状态：0-未生效，1-已生效，2-已过期',
    index: true
  },
  effectTime: {
    type: DataTypes.DATE,
    field: 'effect_time',
    comment: '生效时间',
    index: true
  },
  expireTime: {
    type: DataTypes.DATE,
    field: 'expire_time',
    comment: '过期时间'
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
  tableName: 'rule_version',
  timestamps: true,
  underscored: true,
  comment: '规则版本表'
});

module.exports = RuleVersion;

