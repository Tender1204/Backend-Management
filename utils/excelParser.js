/**
 * Excel解析工具类（优化版）
 * 用于解析卫健委指标导入Excel文件
 * 
 * 业务价值：支持批量导入，提高数据录入效率，减少人工错误
 */

// 动态导入xlsx，避免缺少依赖时启动失败
let XLSX;
try {
  XLSX = require('xlsx');
} catch (err) {
  // 静默处理，在实际使用时再提示
  // console.warn('⚠️  xlsx未安装，Excel相关功能将不可用。请运行: npm install xlsx@0.18.x');
}

/**
 * 解析Excel文件
 * @param {Buffer} fileBuffer - Excel文件缓冲区
 * @param {Object} options - 解析选项
 * @returns {Array} 解析后的规则数组
 */
const parseExcel = (fileBuffer, options = {}) => {
  try {
    const {
      sheetName = null, // 指定工作表名称
      startRow = 1, // 起始行（从0开始，1表示跳过表头）
      requiredFields = ['indicatorName', 'thresholdValue'] // 必填字段
    } = options;

    // 读取Excel文件
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    
    // 获取工作表
    const sheetNameToUse = sheetName || workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetNameToUse];

    if (!worksheet) {
      throw new Error(`工作表 ${sheetNameToUse} 不存在`);
    }

    // 转换为JSON
    const jsonData = XLSX.utils.sheet_to_json(worksheet, {
      header: 1, // 使用数组格式
      defval: '' // 空单元格默认值
    });

    if (jsonData.length <= startRow) {
      throw new Error('Excel文件为空或格式不正确');
    }

    // 获取表头
    const headers = jsonData[0];
    const headerMap = {};
    headers.forEach((header, index) => {
      if (header) {
        // 标准化字段名（支持中英文）
        const normalizedHeader = normalizeHeader(header);
        headerMap[normalizedHeader] = index;
      }
    });

    // 解析数据行
    const rules = [];
    const errors = [];

    for (let i = startRow; i < jsonData.length; i++) {
      const row = jsonData[i];
      
      // 跳过空行
      if (row.every(cell => !cell || cell.toString().trim() === '')) {
        continue;
      }

      try {
        const rule = parseRow(row, headerMap, requiredFields);
        if (rule) {
          rules.push(rule);
        }
      } catch (err) {
        errors.push({
          row: i + 1,
          error: err.message,
          data: row
        });
      }
    }

    return {
      rules,
      errors,
      total: jsonData.length - startRow,
      success: rules.length,
      failed: errors.length
    };

  } catch (err) {
    throw new Error(`Excel解析失败：${err.message}`);
  }
};

/**
 * 解析单行数据
 */
const parseRow = (row, headerMap, requiredFields) => {
  const rule = {};

  // 指标名称（必填）
  const indicatorNameIndex = headerMap['indicatorName'] ?? headerMap['指标名称'];
  if (indicatorNameIndex === undefined) {
    throw new Error('缺少"指标名称"列');
  }
  rule.indicatorName = row[indicatorNameIndex]?.toString().trim();
  if (!rule.indicatorName) {
    throw new Error('指标名称不能为空');
  }

  // 阈值（必填）
  const thresholdValueIndex = headerMap['thresholdValue'] ?? headerMap['阈值'];
  if (thresholdValueIndex === undefined) {
    throw new Error('缺少"阈值"列');
  }
  rule.thresholdValue = row[thresholdValueIndex]?.toString().trim();
  if (!rule.thresholdValue) {
    throw new Error('阈值不能为空');
  }

  // 阈值单位（可选）
  const thresholdUnitIndex = headerMap['thresholdUnit'] ?? headerMap['单位'];
  if (thresholdUnitIndex !== undefined) {
    rule.thresholdUnit = row[thresholdUnitIndex]?.toString().trim() || null;
  }

  // 指标分类（可选）
  const categoryIndex = headerMap['category'] ?? headerMap['分类'];
  if (categoryIndex !== undefined) {
    rule.category = row[categoryIndex]?.toString().trim() || null;
  }

  // 权威解释（可选）
  const authorityExplanationIndex = headerMap['authorityExplanation'] ?? headerMap['权威解释'];
  if (authorityExplanationIndex !== undefined) {
    rule.authorityExplanation = row[authorityExplanationIndex]?.toString().trim() || null;
  }

  return rule;
};

/**
 * 标准化表头名称
 */
const normalizeHeader = (header) => {
  const headerStr = header.toString().trim();
  
  // 中文表头映射
  const chineseMap = {
    '指标名称': 'indicatorName',
    '阈值': 'thresholdValue',
    '单位': 'thresholdUnit',
    '分类': 'category',
    '权威解释': 'authorityExplanation',
    '指标分类': 'category'
  };

  if (chineseMap[headerStr]) {
    return chineseMap[headerStr];
  }

  // 英文表头标准化（转小写，去空格）
  return headerStr.toLowerCase().replace(/\s+/g, '');
};

/**
 * 生成Excel模板
 * @returns {Buffer} Excel文件缓冲区
 */
const generateTemplate = () => {
  if (!XLSX) {
    throw new Error('xlsx模块未安装，无法生成模板。请运行: npm install xlsx@0.18.x');
  }
  
  try {
    const templateData = [
      ['指标名称', '阈值', '单位', '分类', '权威解释'],
      ['每日饮水量', '2500', 'ml', '饮水健康', '根据国家卫健委2024年健康指南，成年人每日建议饮水量为2000-3000ml'],
      ['每日热量摄入', '2000', 'kcal', '饮食健康', '根据国家卫健委2024年健康指南，成年人每日建议热量摄入为1800-2200kcal'],
      ['每日步数', '10000', '步', '运动健康', '根据国家卫健委2024年健康指南，成年人每日建议步数为8000-12000步'],
      ['每日睡眠时长', '8', '小时', '睡眠健康', '根据国家卫健委2024年健康指南，成年人每日建议睡眠时长为7-9小时']
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(templateData);
    
    // 设置列宽
    worksheet['!cols'] = [
      { wch: 15 }, // 指标名称
      { wch: 10 }, // 阈值
      { wch: 10 }, // 单位
      { wch: 15 }, // 分类
      { wch: 50 }  // 权威解释
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '卫健委指标导入模板');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    
    if (!buffer || buffer.length === 0) {
      throw new Error('生成的Excel文件为空');
    }
    
    return buffer;
  } catch (err) {
    console.error('生成Excel模板失败：', err);
    throw new Error('生成模板失败：' + err.message);
  }
};

module.exports = {
  parseExcel,
  generateTemplate
};

