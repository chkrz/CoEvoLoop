/**
 * diffUtils 单元测试
 */

import { computeDiff, getDiffStats, hasDiff, getDiffSummary, clearDiffCache } from '../diffUtils';

describe('diffUtils', () => {
  beforeEach(() => {
    clearDiffCache();
  });

  describe('computeDiff', () => {
    it('应该处理空文本', () => {
      const result = computeDiff('', '');
      expect(result.segments).toEqual([]);
      expect(result.similarity).toBe(1);
      expect(result.changes).toBe(0);
    });

    it('应该处理新增文本', () => {
      const result = computeDiff('', 'hello world');
      expect(result.segments).toEqual([{ type: 'insert', value: 'hello world' }]);
      expect(result.similarity).toBe(0);
      expect(result.changes).toBe(1);
    });

    it('应该处理删除文本', () => {
      const result = computeDiff('hello world', '');
      expect(result.segments).toEqual([{ type: 'delete', value: 'hello world' }]);
      expect(result.similarity).toBe(0);
      expect(result.changes).toBe(1);
    });

    it('应该处理相同文本', () => {
      const result = computeDiff('hello world', 'hello world');
      expect(result.segments).toEqual([{ type: 'equal', value: 'hello world' }]);
      expect(result.similarity).toBe(1);
      expect(result.changes).toBe(0);
    });

    it('应该处理文本修改', () => {
      const result = computeDiff('hello world', 'hello there');
      expect(result.segments.length).toBeGreaterThan(0);
      expect(result.similarity).toBeLessThan(1);
      expect(result.changes).toBeGreaterThan(0);
    });

    it('应该缓存结果', () => {
      const original = 'test text';
      const modified = 'test modified';
      
      const result1 = computeDiff(original, modified);
      const result2 = computeDiff(original, modified);
      
      expect(result1).toEqual(result2);
    });
  });

  describe('getDiffStats', () => {
    it('应该正确统计差异', () => {
      const segments = [
        { type: 'equal', value: 'hello ' },
        { type: 'delete', value: 'world' },
        { type: 'insert', value: 'there' },
        { type: 'equal', value: '!' }
      ];
      
      const stats = getDiffStats(segments);
      expect(stats.insertions).toBe(5); // 'there'
      expect(stats.deletions).toBe(5); // 'world'
      expect(stats.modifications).toBe(0);
    });
  });

  describe('hasDiff', () => {
    it('应该检测差异', () => {
      expect(hasDiff('hello', 'hello')).toBe(false);
      expect(hasDiff('hello', 'world')).toBe(true);
      expect(hasDiff('', 'world')).toBe(true);
      expect(hasDiff('hello', '')).toBe(true);
    });
  });

  describe('getDiffSummary', () => {
    it('应该生成正确的摘要', () => {
      expect(getDiffSummary('hello', 'hello')).toBe('无修改');
      expect(getDiffSummary('hello', 'hello world')).toContain('新增');
      expect(getDiffSummary('hello world', 'hello')).toContain('删除');
    });
  });

  describe('性能测试', () => {
    it('应该处理大文本', () => {
      const original = 'a'.repeat(1000);
      const modified = 'a'.repeat(500) + 'b'.repeat(500);
      
      const start = performance.now();
      const result = computeDiff(original, modified);
      const end = performance.now();
      
      expect(result).toBeDefined();
      expect(end - start).toBeLessThan(100); // 应该在100ms内完成
    });
  });
});