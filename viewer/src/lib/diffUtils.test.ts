/**
 * diffUtils 简单测试
 */

import { computeDiff, getDiffStats, hasDiff, getDiffSummary } from './diffUtils';

// 简单测试函数
function runTests() {
  console.log('开始测试 diffUtils...');

  // 测试1: 空文本
  const test1 = computeDiff('', '');
  console.assert(test1.segments.length === 0, '测试1失败: 空文本');
  console.log('测试1通过: 空文本处理');

  // 测试2: 新增文本
  const test2 = computeDiff('', 'hello');
  console.assert(test2.segments.length === 1, '测试2失败: 新增文本');
  console.assert(test2.segments[0].type === 'insert', '测试2失败: 类型错误');
  console.log('测试2通过: 新增文本处理');

  // 测试3: 相同文本
  const test3 = computeDiff('hello', 'hello');
  console.assert(test3.segments.length === 1, '测试3失败: 相同文本');
  console.assert(test3.segments[0].type === 'equal', '测试3失败: 类型错误');
  console.log('测试3通过: 相同文本处理');

  // 测试4: 文本修改
  const test4 = computeDiff('hello world', 'hello there');
  console.assert(test4.segments.length > 0, '测试4失败: 文本修改');
  console.log('测试4通过: 文本修改处理');

  // 测试5: 差异检测
  console.assert(hasDiff('a', 'b') === true, '测试5失败: 差异检测');
  console.assert(hasDiff('a', 'a') === false, '测试5失败: 无差异检测');
  console.log('测试5通过: 差异检测');

  // 测试6: 差异摘要
  const summary = getDiffSummary('hello', 'hello world');
  console.assert(summary.includes('新增'), '测试6失败: 差异摘要');
  console.log('测试6通过: 差异摘要');

  console.log('所有测试通过!');
}

// 运行测试
if (typeof window !== 'undefined') {
  // 浏览器环境
  console.log('在浏览器环境中运行测试...');
  runTests();
} else {
  // Node.js环境
  console.log('在Node.js环境中运行测试...');
  runTests();
}