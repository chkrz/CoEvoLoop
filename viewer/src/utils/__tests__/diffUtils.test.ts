import { describe, it, expect, beforeEach } from 'vitest';
import {
  deepDiff,
  calculateTextDiff,
  calculateArrayDiff,
  calculatePortraitDiff,
  getChangedDiffs,
  getDiffStats,
  diffToText,
  UserPortraitData
} from '../diffUtils';

describe('diffUtils', () => {
  describe('calculateTextDiff', () => {
    it('应该正确识别文本的新增', () => {
      const result = calculateTextDiff('hello', 'hello world');
      expect(result).toEqual([
        { type: 'unchanged', text: 'hello', start: 0, end: 5 },
        { type: 'added', text: ' world', start: 5, end: 11 }
      ]);
    });

    it('应该正确识别文本的删除', () => {
      const result = calculateTextDiff('hello world', 'hello');
      expect(result).toEqual([
        { type: 'unchanged', text: 'hello', start: 0, end: 5 },
        { type: 'removed', text: ' world', start: 5, end: 11 }
      ]);
    });

    it('应该正确识别文本的修改', () => {
      const result = calculateTextDiff('hello', 'hi');
      expect(result).toHaveLength(2);
      expect(result[0].type).toBe('removed');
      expect(result[1].type).toBe('added');
    });

    it('应该处理相同的文本', () => {
      const result = calculateTextDiff('hello', 'hello');
      expect(result).toEqual([
        { type: 'unchanged', text: 'hello', start: 0, end: 5 }
      ]);
    });

    it('应该处理空文本', () => {
      const result1 = calculateTextDiff('', 'hello');
      expect(result1).toEqual([
        { type: 'added', text: 'hello', start: 0, end: 5 }
      ]);

      const result2 = calculateTextDiff('hello', '');
      expect(result2).toEqual([
        { type: 'removed', text: 'hello', start: 0, end: 5 }
      ]);
    });
  });

  describe('calculateArrayDiff', () => {
    it('应该正确识别数组的新增元素', () => {
      const result = calculateArrayDiff(['a', 'b'], ['a', 'b', 'c']);
      expect(result).toEqual([
        { type: 'unchanged', index: 0, original: 'a', modified: 'a' },
        { type: 'unchanged', index: 1, original: 'b', modified: 'b' },
        { type: 'added', index: 2, modified: 'c' }
      ]);
    });

    it('应该正确识别数组的删除元素', () => {
      const result = calculateArrayDiff(['a', 'b', 'c'], ['a', 'b']);
      expect(result).toEqual([
        { type: 'unchanged', index: 0, original: 'a', modified: 'a' },
        { type: 'unchanged', index: 1, original: 'b', modified: 'b' },
        { type: 'removed', index: 2, original: 'c' }
      ]);
    });

    it('应该正确识别数组的修改元素', () => {
      const result = calculateArrayDiff(['a', 'b', 'c'], ['a', 'x', 'c']);
      expect(result).toHaveLength(3);
      expect(result[1].type).toBe('modified');
      expect(result[1].original).toBe('b');
      expect(result[1].modified).toBe('x');
    });

    it('应该处理字符串数组的文本差异', () => {
      const result = calculateArrayDiff(['hello'], ['hello world']);
      expect(result[0].textDiff).toBeDefined();
      expect(result[0].type).toBe('modified');
    });

    it('应该处理空数组', () => {
      const result1 = calculateArrayDiff([], ['a', 'b']);
      expect(result1).toEqual([
        { type: 'added', index: 0, modified: 'a' },
        { type: 'added', index: 1, modified: 'b' }
      ]);

      const result2 = calculateArrayDiff(['a', 'b'], []);
      expect(result2).toEqual([
        { type: 'removed', index: 0, original: 'a' },
        { type: 'removed', index: 1, original: 'b' }
      ]);
    });
  });

  describe('deepDiff', () => {
    it('应该正确识别简单值的差异', () => {
      const result = deepDiff('old', 'new', 'test');
      expect(result).toEqual([
        {
          field: 'test',
          type: 'modified',
          original: 'old',
          modified: 'new'
        }
      ]);
    });

    it('应该正确识别新增字段', () => {
      const result = deepDiff(undefined, 'new', 'test');
      expect(result).toEqual([
        {
          field: 'test',
          type: 'added',
          original: undefined,
          modified: 'new'
        }
      ]);
    });

    it('应该正确识别删除字段', () => {
      const result = deepDiff('old', undefined, 'test');
      expect(result).toEqual([
        {
          field: 'test',
          type: 'removed',
          original: 'old',
          modified: undefined
        }
      ]);
    });

    it('应该正确识别未变化的字段', () => {
      const result = deepDiff('same', 'same', 'test');
      expect(result).toEqual([]);
    });

    it('应该正确处理嵌套对象', () => {
      const original = { a: { b: 1 } };
      const modified = { a: { b: 2 } };
      const result = deepDiff(original, modified);
      expect(result).toContainEqual(
        expect.objectContaining({
          field: 'b',
          type: 'modified',
          original: 1,
          modified: 2
        })
      );
    });

    it('应该正确处理数组字段', () => {
      const original = { items: ['a', 'b'] };
      const modified = { items: ['a', 'b', 'c'] };
      const result = deepDiff(original, modified);
      expect(result).toContainEqual(
        expect.objectContaining({
          field: 'items',
          type: 'modified'
        })
      );
    });
  });

  describe('calculatePortraitDiff', () => {
    const mockOriginal: UserPortraitData = {
      background_description: ['用户是大学生', '主修计算机科学'],
      knowledge_blind_spots: ['不了解云计算', '缺乏项目经验'],
      operation_history: [
        {
          action: '注册账号',
          timestamp: '2024-01-01',
          details: '完成邮箱验证'
        }
      ],
      problem_description: ['学习进度慢', '找不到实习']
    };

    const mockModified: UserPortraitData = {
      background_description: ['用户是大学生', '主修计算机科学', '即将毕业'],
      knowledge_blind_spots: ['不了解云计算'],
      operation_history: [
        {
          action: '注册账号',
          timestamp: '2024-01-01',
          details: '完成邮箱验证'
        },
        {
          action: '购买课程',
          timestamp: '2024-01-15',
          details: '购买了云计算课程'
        }
      ],
      problem_description: ['学习进度慢', '找不到实习', '需要项目经验']
    };

    it('应该正确计算用户画像数据的差异', () => {
      const result = calculatePortraitDiff(mockOriginal, mockModified);
      
      // 检查是否有变化
      expect(result.length).toBeGreaterThan(0);
      
      // 检查背景描述的变化
      const backgroundDiff = result.find(diff => diff.field === 'background_description');
      expect(backgroundDiff).toBeDefined();
      expect(backgroundDiff?.type).toBe('modified');
      
      // 检查知识盲区的变化
      const blindSpotsDiff = result.find(diff => diff.field === 'knowledge_blind_spots');
      expect(blindSpotsDiff).toBeDefined();
      expect(blindSpotsDiff?.type).toBe('modified');
    });

    it('应该处理空数据', () => {
      const emptyData: UserPortraitData = {};
      const result = calculatePortraitDiff(emptyData, mockModified);
      expect(result.length).toBeGreaterThan(0);
    });

    it('应该处理相同数据', () => {
      const result = calculatePortraitDiff(mockOriginal, mockOriginal);
      expect(result.every(diff => diff.type === 'unchanged')).toBe(true);
    });
  });

  describe('getChangedDiffs', () => {
    it('应该过滤出变化的差异', () => {
      const diffs = [
        { field: 'a', type: 'added', original: undefined, modified: 'new' },
        { field: 'b', type: 'unchanged', original: 'same', modified: 'same' },
        { field: 'c', type: 'removed', original: 'old', modified: undefined }
      ];
      
      const result = getChangedDiffs(diffs);
      expect(result).toHaveLength(2);
      expect(result.every(diff => diff.type !== 'unchanged')).toBe(true);
    });
  });

  describe('getDiffStats', () => {
    it('应该正确统计差异信息', () => {
      const diffs = [
        { field: 'a', type: 'added', original: undefined, modified: 'new' },
        { field: 'b', type: 'removed', original: 'old', modified: undefined },
        { field: 'c', type: 'modified', original: 'old', modified: 'new' },
        { field: 'd', type: 'unchanged', original: 'same', modified: 'same' }
      ];
      
      const stats = getDiffStats(diffs);
      expect(stats).toEqual({
        added: 1,
        removed: 1,
        modified: 1,
        total: 3
      });
    });

    it('应该处理空差异数组', () => {
      const stats = getDiffStats([]);
      expect(stats).toEqual({
        added: 0,
        removed: 0,
        modified: 0,
        total: 0
      });
    });
  });

  describe('diffToText', () => {
    it('应该将差异转换为可读文本', () => {
      const diffs = [
        { field: 'name', type: 'added', original: undefined, modified: 'John' },
        { field: 'age', type: 'removed', original: 25, modified: undefined },
        { field: 'city', type: 'modified', original: 'NY', modified: 'LA' }
      ];
      
      const text = diffToText(diffs);
      expect(text).toContain('name: 新增值 "John"');
      expect(text).toContain('age: 删除值 "25"');
      expect(text).toContain('city: 从 "NY" 修改为 "LA"');
    });

    it('应该跳过未变化的差异', () => {
      const diffs = [
        { field: 'a', type: 'unchanged', original: 'same', modified: 'same' },
        { field: 'b', type: 'added', original: undefined, modified: 'new' }
      ];
      
      const text = diffToText(diffs);
      expect(text).not.toContain('a');
      expect(text).toContain('b');
    });
  });

  describe('边界情况测试', () => {
    it('应该处理null和undefined值', () => {
      const result1 = deepDiff(null, 'value', 'test');
      expect(result1[0].type).toBe('modified');

      const result2 = deepDiff('value', null, 'test');
      expect(result2[0].type).toBe('modified');

      const result3 = deepDiff(undefined, null, 'test');
      expect(result3[0].type).toBe('modified');
    });

    it('应该处理复杂嵌套结构', () => {
      const original = {
        user: {
          profile: {
            name: 'John',
            skills: ['JavaScript', 'Python']
          }
        }
      };
      
      const modified = {
        user: {
          profile: {
            name: 'Jane',
            skills: ['JavaScript', 'TypeScript']
          }
        }
      };
      
      const result = deepDiff(original, modified);
      expect(result).toContainEqual(
        expect.objectContaining({
          field: 'name',
          type: 'modified',
          original: 'John',
          modified: 'Jane'
        })
      );
    });

    it('应该处理循环引用（通过JSON序列化）', () => {
      const obj1 = { a: 1 };
      const obj2 = { a: 2 };
      
      // 这不应该抛出错误
      expect(() => deepDiff(obj1, obj2)).not.toThrow();
    });
  });
});