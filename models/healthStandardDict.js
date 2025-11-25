/**
 * 卫健委标准字典模型
 * 用于存储卫健委权威健康指标标准
 */

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const HealthStandardDict = sequelize.define('HealthStandardDict', {
  dictId: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    field: 'dict_id',
    comment: '字典ID'
  },
  indicatorName: {
    type: DataTypes.STRING(100),
    allowNull: false,
    field: 'indicator_name',
    comment: '指标名称（与health_rule表关联）',
    index: true
  },
  category: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '指标分类：饮水健康、饮食健康、运动健康、睡眠健康等',
    index: true
  },
  recommendThreshold: {
    type: DataTypes.STRING(200),
    allowNull: false,
    field: 'recommend_threshold',
    comment: '卫健委推荐阈值范围（如：2000-3000ml）'
  },
  sourceUrl: {
    type: DataTypes.STRING(500),
    field: 'source_url',
    comment: '官网来源链接'
  },
  sourceDesc: {
    type: DataTypes.STRING(200),
    field: 'source_desc',
    comment: '来源说明（如：国家卫健委2024年健康指南）'
  },
  updateTime: {
    type: DataTypes.DATE,
    field: 'update_time',
    comment: '标准更新时间'
  },
  status: {
    type: DataTypes.TINYINT,
    defaultValue: 1,
    comment: '状态：1-启用，0-禁用',
    index: true
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
  tableName: 'health_standard_dict',
  timestamps: true,
  underscored: true,
  comment: '卫健委标准字典表'
});

module.exports = HealthStandardDict;

