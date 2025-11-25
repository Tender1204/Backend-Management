/**
 * 数据库配置文件
 * 使用Sequelize ORM连接MySQL数据库
 */

const { Sequelize } = require('sequelize');
require('dotenv').config();

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  database: process.env.DB_NAME || 'health_admin_db',
  username: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  dialect: 'mysql',
  timezone: '+08:00', // 设置时区为东八区
  pool: {
    max: 10, // 连接池最大连接数
    min: 0, // 连接池最小连接数
    acquire: 30000, // 获取连接的最大等待时间（毫秒）
    idle: 10000 // 连接空闲的最大时间（毫秒）
  },
  logging: process.env.NODE_ENV === 'development' ? console.log : false, // 开发环境打印SQL日志
  define: {
    timestamps: true, // 自动添加createdAt和updatedAt字段
    underscored: true, // 使用下划线命名（created_at而不是createdAt）
    freezeTableName: true // 禁止自动复数化表名
  }
};

// 创建Sequelize实例
const sequelize = new Sequelize(
  dbConfig.database,
  dbConfig.username,
  dbConfig.password,
  {
    host: dbConfig.host,
    port: dbConfig.port,
    dialect: dbConfig.dialect,
    timezone: dbConfig.timezone,
    pool: dbConfig.pool,
    logging: dbConfig.logging,
    define: dbConfig.define
  }
);

// 测试数据库连接
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ 数据库连接成功！');
    return true;
  } catch (error) {
    console.error('❌ 数据库连接失败：', error.message);
    return false;
  }
};

module.exports = {
  sequelize,
  testConnection
};

