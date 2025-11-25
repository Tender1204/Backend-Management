/**
 * 初始化管理员账号脚本
 * 用于创建默认管理员账号（用户名：admin，密码：123456）
 * 运行方式：node scripts/init-admin.js
 */

const bcrypt = require('bcryptjs');
const { sequelize } = require('../config/db');

const initAdmin = async () => {
  try {
    console.log('开始初始化管理员账号...');
    
    // 测试数据库连接
    await sequelize.authenticate();
    console.log('✅ 数据库连接成功');
    
    // 检查表是否存在
    const [tables] = await sequelize.query(
      `SHOW TABLES LIKE 'admins'`,
      { type: sequelize.QueryTypes.SELECT }
    );
    
    if (!tables || tables.length === 0) {
      console.error('❌ 错误：admins表不存在，请先执行database/schema.sql创建表结构');
      process.exit(1);
    }
    
    const username = 'admin';
    const password = '123456';
    
    // 检查管理员是否已存在
    const [existingAdmins] = await sequelize.query(
      `SELECT id, password FROM admins WHERE username = :username`,
      {
        replacements: { username },
        type: sequelize.QueryTypes.SELECT
      }
    );
    
    // 加密密码
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    console.log('密码加密完成，长度：', hashedPassword.length);
    
    // 如果存在占位符密码，先删除该记录
    if (existingAdmins && existingAdmins.length > 0) {
      const existingAdmin = existingAdmins[0];
      if (existingAdmin.password && existingAdmin.password.includes('placeholder')) {
        console.log('⚠️  检测到占位符密码，删除旧记录...');
        await sequelize.query(
          `DELETE FROM admins WHERE username = :username`,
          {
            replacements: { username }
          }
        );
        console.log('✅ 旧记录已删除，将创建新记录');
      }
    }
    
    // 重新检查管理员是否存在（可能刚被删除）
    const [checkAdmins] = await sequelize.query(
      `SELECT id FROM admins WHERE username = :username`,
      {
        replacements: { username },
        type: sequelize.QueryTypes.SELECT
      }
    );
    
    if (checkAdmins && checkAdmins.length > 0) {
      console.log('⚠️  管理员账号已存在，正在更新密码...');
      
      // 更新密码（使用原始SQL）
      const [updateResult] = await sequelize.query(
        `UPDATE admins 
         SET password = :password, status = 1, updated_at = NOW()
         WHERE username = :username`,
        {
          replacements: { 
            password: hashedPassword, 
            username: username 
          }
        }
      );
      
      console.log('✅ 管理员密码已更新');
      console.log(`   用户名：${username}`);
      console.log(`   密码：${password}`);
    } else {
      console.log('创建新管理员账号...');
      
      // 插入管理员（使用原始SQL，避免Sequelize验证问题）
      const [insertResult] = await sequelize.query(
        `INSERT INTO admins (username, password, nickname, status, created_at, updated_at) 
         VALUES (:username, :password, :nickname, 1, NOW(), NOW())`,
        {
          replacements: { 
            username: username, 
            password: hashedPassword,
            nickname: '超级管理员'
          }
        }
      );
      
      console.log('✅ 管理员账号创建成功');
      console.log(`   用户名：${username}`);
      console.log(`   密码：${password}`);
    }
    
    console.log('\n初始化完成！');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ 初始化失败：', error.message);
    console.error('错误详情：', error);
    if (error.errors) {
      console.error('验证错误详情：', error.errors);
    }
    process.exit(1);
  }
};

initAdmin();

