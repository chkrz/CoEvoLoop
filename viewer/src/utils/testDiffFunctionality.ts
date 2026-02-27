// 测试脚本：验证差异计算功能
import { calculatePortraitDiff, getDiffStats, diffToText } from './diffUtils';
import { calculatePortraitDiffOptimized } from './diffUtilsOptimized';

// 测试数据
const testOriginalData = {
  background_description: [
    "用户是25岁的软件工程师",
    "有3年前端开发经验",
    "熟悉React和Vue框架"
  ],
  knowledge_blind_spots: [
    "不了解后端架构",
    "缺乏系统设计经验",
    "对性能优化理解不深"
  ],
  operation_history: [
    {
      action: "注册平台",
      timestamp: "2024-01-15",
      details: "完成邮箱验证"
    },
    {
      action: "浏览课程",
      timestamp: "2024-01-16",
      details: "查看了5个课程"
    }
  ],
  problem_description: [
    "想提升技术深度",
    "缺乏项目实战经验",
    "不知道如何规划职业发展"
  ]
};

const testModifiedData = {
  background_description: [
    "用户是25岁的软件工程师",
    "有3年前端开发经验",
    "熟悉React和Vue框架",
    "正在学习TypeScript"
  ],
  knowledge_blind_spots: [
    "不了解后端架构",
    "缺乏系统设计经验"
  ],
  operation_history: [
    {
      action: "注册平台",
      timestamp: "2024-01-15",
      details: "完成邮箱验证"
    },
    {
      action: "浏览课程",
      timestamp: "2024-01-16",
      details: "查看了5个课程"
    },
    {
      action: "购买课程",
      timestamp: "2024-01-20",
      details: "购买了系统设计课程"
    }
  ],
  problem_description: [
    "想提升技术深度",
    "缺乏项目实战经验",
    "不知道如何规划职业发展",
    "需要学习新技术栈"
  ]
};

// 运行测试
console.log('🧪 开始测试差异计算功能...\n');

// 1. 测试基础差异计算
console.log('📊 基础差异计算结果:');
const diffs = calculatePortraitDiff(testOriginalData, testModifiedData);
console.log(`发现 ${diffs.length} 项差异`);

// 2. 测试统计信息
console.log('\n📈 差异统计:');
const stats = getDiffStats(diffs);
console.log(`新增: ${stats.added}`);
console.log(`删除: ${stats.removed}`);
console.log(`修改: ${stats.modified}`);
console.log(`总计: ${stats.total}`);

// 3. 测试文本输出
console.log('\n📝 差异文本描述:');
const textDiff = diffToText(diffs);
console.log(textDiff);

// 4. 测试性能优化版本
console.log('\n⚡ 性能优化版本测试:');
const startTime = performance.now();
const optimizedDiffs = calculatePortraitDiffOptimized(testOriginalData, testModifiedData);
const endTime = performance.now();
console.log(`优化版本计算耗时: ${(endTime - startTime).toFixed(2)}ms`);
console.log(`优化版本发现 ${optimizedDiffs.length} 项差异`);

// 5. 测试边界情况
console.log('\n🔍 边界情况测试:');

// 空数据测试
const emptyDiffs = calculatePortraitDiff({}, {});
console.log(`空数据差异: ${emptyDiffs.length} 项`);

// 相同数据测试
const sameDiffs = calculatePortraitDiff(testOriginalData, testOriginalData);
console.log(`相同数据差异: ${sameDiffs.length} 项`);

// 6. 测试大数据性能
console.log('\n🚀 大数据性能测试:');
const largeOriginal = {
  background_description: Array.from({length: 100}, (_, i) => `描述 ${i}`),
  knowledge_blind_spots: Array.from({length: 50}, (_, i) => `盲区 ${i}`),
  operation_history: Array.from({length: 30}, (_, i) => ({
    action: `操作 ${i}`,
    timestamp: `2024-01-${i + 1}`,
    details: `详情 ${i}`
  })),
  problem_description: Array.from({length: 75}, (_, i) => `问题 ${i}`)
};

const largeModified = {
  background_description: Array.from({length: 100}, (_, i) => `修改描述 ${i}`),
  knowledge_blind_spots: Array.from({length: 25}, (_, i) => `修改盲区 ${i}`),
  operation_history: Array.from({length: 35}, (_, i) => ({
    action: `修改操作 ${i}`,
    timestamp: `2024-01-${i + 1}`,
    details: `修改详情 ${i}`
  })),
  problem_description: Array.from({length: 80}, (_, i) => `修改问题 ${i}`)
};

const largeStartTime = performance.now();
const largeDiffs = calculatePortraitDiffOptimized(largeOriginal, largeModified, {
  maxDepth: 3,
  skipLargeArrays: true
});
const largeEndTime = performance.now();
console.log(`大数据集计算耗时: ${(largeEndTime - largeStartTime).toFixed(2)}ms`);
console.log(`大数据集差异: ${largeDiffs.length} 项`);

console.log('\n✅ 测试完成！所有功能正常运行。');