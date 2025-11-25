/**
 * 健康规则管理路由（迭代优化版）
 */

const express = require('express');
const router = express.Router();
const healthRuleController = require('../controllers/healthRuleController');
const { verifyToken } = require('../middleware/auth');

// 动态导入multer和excelParser，避免缺少依赖时启动失败
let multer, parseExcel;
try {
  multer = require('multer');
  parseExcel = require('../utils/excelParser').parseExcel;
} catch (err) {
  // 静默处理，在实际使用时再提示
  // console.warn('⚠️  multer或xlsx未安装，文件上传功能将不可用。请运行: npm install multer@1.x xlsx@0.18.x');
}

// 配置multer用于文件上传（如果multer已安装）
let upload;
if (multer) {
  upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 10 * 1024 * 1024 // 10MB
    },
    fileFilter: (req, file, cb) => {
      const allowedMimes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
        'application/vnd.ms-excel' // .xls
      ];
      if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('只支持Excel文件（.xlsx, .xls）'), false);
      }
    }
  });
}

// 导入卫健委指标接口（优化版）
if (upload && parseExcel) {
  router.post('/import', verifyToken, upload.single('file'), async (req, res) => {
    try {
      // 支持文件上传和JSON数据两种方式
      if (req.file) {
        // Excel文件上传
        const parseResult = parseExcel(req.file.buffer);
        req.body.rules = parseResult.rules;
        req.body.parseErrors = parseResult.errors;
      }
      
      return healthRuleController.importHealthRule(req, res);
    } catch (err) {
      return res.status(400).json({
        code: 400,
        message: err.message
      });
    }
  });
} else {
  router.post('/import', verifyToken, async (req, res) => {
    // 如果没有文件上传功能，只支持JSON数据
    return healthRuleController.importHealthRule(req, res);
  });
}

// Excel文件上传（单独接口）
if (upload && parseExcel) {
  router.post('/import/excel', verifyToken, upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          code: 400,
          message: '请上传Excel文件'
        });
      }

      const parseResult = parseExcel(req.file.buffer);
      
      return res.json({
        code: 200,
        message: '解析成功',
        data: parseResult
      });
    } catch (err) {
      return res.status(400).json({
        code: 400,
        message: err.message
      });
    }
  });
} else {
  router.post('/import/excel', verifyToken, (req, res) => {
    return res.status(503).json({
      code: 503,
      message: '文件上传功能不可用，请安装依赖: npm install multer@1.x xlsx@0.18.x'
    });
  });
}

// 获取健康规则列表接口（新增）
router.get('/list', verifyToken, healthRuleController.getHealthRuleList);

// 修改规则阈值/解释接口（优化版）
router.put('/update', verifyToken, healthRuleController.updateHealthRule);

// 版本回滚接口（优化版）
router.post('/rollback', verifyToken, healthRuleController.rollbackVersion);

// 规则关联模板接口（优化版）
router.post('/bind-template', verifyToken, healthRuleController.bindTemplate);

// 指标分类查询接口（新增）
router.get('/category', verifyToken, healthRuleController.getCategories);

// 操作日志查询接口（新增）
router.get('/operate-log', verifyToken, healthRuleController.getOperateLogs);

// 批量删除操作日志接口（必须在 /:logId 之前，避免路由冲突）
router.delete('/operate-log/batch-delete', verifyToken, healthRuleController.batchDeleteOperateLog);

// 删除操作日志接口（新增）
router.delete('/operate-log/:logId', verifyToken, healthRuleController.deleteOperateLog);

// 标准字典同步接口（新增）
router.post('/sync-dict', verifyToken, healthRuleController.syncDict);

// 获取规则详情接口（新增）
router.get('/detail/:ruleId', verifyToken, healthRuleController.getRuleDetail);

// 获取规则版本列表接口（新增）
router.get('/versions/:ruleId', verifyToken, healthRuleController.getRuleVersions);

// 过期规则版本接口（新增）
router.post('/expire-version', verifyToken, healthRuleController.expireVersion);

// 获取版本关联模板列表接口（新增）
router.get('/templates/:versionId', verifyToken, healthRuleController.getRuleTemplatesByVersion);

// 批量删除健康规则接口（必须在 /:ruleId 之前，避免路由冲突）
router.delete('/batch-delete', verifyToken, healthRuleController.batchDeleteHealthRule);

// 删除健康规则接口（新增，必须在批量删除之后）
router.delete('/:ruleId', verifyToken, healthRuleController.deleteHealthRule);

// 下载Excel模板
router.get('/template', verifyToken, (req, res) => {
  try {
    if (!parseExcel) {
      return res.status(503).json({
        code: 503,
        message: '模板下载功能不可用，请安装依赖: npm install xlsx@0.18.x'
      });
    }
    
    const { generateTemplate } = require('../utils/excelParser');
    
    if (!generateTemplate) {
      return res.status(503).json({
        code: 503,
        message: '模板生成功能不可用，请安装依赖: npm install xlsx@0.18.x'
      });
    }
    
    const buffer = generateTemplate();
    
    if (!buffer) {
      return res.status(500).json({
        code: 500,
        message: '生成模板失败：buffer为空'
      });
    }
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    // 使用URL编码处理中文文件名，避免HTTP头无效字符错误
    const encodedFilename = encodeURIComponent('卫健委指标导入模板.xlsx');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedFilename}`);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  } catch (err) {
    console.error('生成模板失败：', err);
    res.status(500).json({
      code: 500,
      message: err.message || '生成模板失败',
      error: err.message
    });
  }
});

module.exports = router;

