import * as DiffMatchPatch from 'diff-match-patch';
import { DiffResult, TextDiff, ArrayDiff, UserPortraitData } from './diffUtils';

const dmp = new DiffMatchPatch.diff_match_patch();

/**
 * 性能优化的差异计算配置
 */
export interface DiffOptimizationConfig {
  maxDepth?: number;
  maxStringLength?: number;
  skipLargeArrays?: boolean;
  useWorker?: boolean;
  cacheResults?: boolean;
  maxCacheSize?: number;
}

/**
 * 差异计算缓存
 */
class DiffCache {
  private cache = new Map<string, { result: DiffResult[]; timestamp: number }>();
  private maxSize: number;

  constructor(maxSize = 100) {
    this.maxSize = maxSize;
  }

  get(key: string): DiffResult[] | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    // 5分钟缓存过期
    if (Date.now() - entry.timestamp > 5 * 60 * 1000) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.result;
  }

  set(key: string, result: DiffResult[]) {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, {
      result,
      timestamp: Date.now()
    });
  }

  clear() {
    this.cache.clear();
  }
}

const globalCache = new DiffCache(50);

/**
 * 生成缓存键
 */
function generateCacheKey(original: any, modified: any): string {
  try {
    const originalStr = JSON.stringify(original, Object.keys(original || {}).sort());
    const modifiedStr = JSON.stringify(modified, Object.keys(modified || {}).sort());
    return `${originalStr}::${modifiedStr}`;
  } catch {
    return `${String(original)}::${String(modified)}`;
  }
}

/**
 * 检查对象大小
 */
function checkObjectSize(obj: any, maxSize: number): boolean {
  try {
    const str = JSON.stringify(obj);
    return str.length <= maxSize;
  } catch {
    return false;
  }
}

/**
 * 截断长字符串
 */
function truncateString(str: string, maxLength: number): string {
  if (typeof str !== 'string' || str.length <= maxLength) {
    return str;
  }
  return str.substring(0, maxLength) + '...';
}

/**
 * 性能优化的深度差异计算
 */
export function deepDiffOptimized(
  original: any,
  modified: any,
  fieldName: string = 'root',
  config: DiffOptimizationConfig = {},
  depth = 0
): DiffResult[] {
  const {
    maxDepth = 10,
    maxStringLength = 10000,
    skipLargeArrays = true,
    cacheResults = true
  } = config;

  // 深度限制
  if (depth > maxDepth) {
    return [{
      field: fieldName,
      type: 'modified',
      original: '[深度限制]',
      modified: '[深度限制]'
    }];
  }

  // 缓存检查
  if (cacheResults && depth === 0) {
    const cacheKey = generateCacheKey(original, modified);
    const cached = globalCache.get(cacheKey);
    if (cached) return cached;
  }

  const results: DiffResult[] = [];

  // 快速路径：相同引用
  if (original === modified) {
    return results;
  }

  // 快速路径：基本类型比较
  if (typeof original !== 'object' || typeof modified !== 'object') {
    if (original !== modified) {
      const result: DiffResult = {
        field: fieldName,
        type: 'modified',
        original,
        modified
      };

      // 字符串差异优化
      if (typeof original === 'string' && typeof modified === 'string') {
        const originalStr = truncateString(original, maxStringLength);
        const modifiedStr = truncateString(modified, maxStringLength);
        
        if (originalStr.length < 1000) { // 只对短文本计算详细差异
          result.textDiff = calculateTextDiffOptimized(originalStr, modifiedStr);
        }
      }

      results.push(result);
    }
    return results;
  }

  // 处理null值
  if (original === null || modified === null) {
    if (original !== modified) {
      results.push({
        field: fieldName,
        type: 'modified',
        original,
        modified
      });
    }
    return results;
  }

  // 处理undefined
  if (original === undefined && modified !== undefined) {
    results.push({
      field: fieldName,
      type: 'added',
      original,
      modified
    });
    return results;
  }

  if (original !== undefined && modified === undefined) {
    results.push({
      field: fieldName,
      type: 'removed',
      original,
      modified
    });
    return results;
  }

  // 数组处理
  if (Array.isArray(original) && Array.isArray(modified)) {
    // 大数组跳过详细比较
    if (skipLargeArrays && (original.length > 1000 || modified.length > 1000)) {
      const hasChanges = original.length !== modified.length || 
                        original.some((item, index) => item !== modified[index]);
      
      if (hasChanges) {
        results.push({
          field: fieldName,
          type: 'modified',
          original: `[数组长度: ${original.length}]`,
          modified: `[数组长度: ${modified.length}]`,
          arrayDiff: calculateArrayDiffOptimized(original, modified, config, depth + 1)
        });
      }
      return results;
    }

    const arrayDiff = calculateArrayDiffOptimized(original, modified, config, depth + 1);
    if (arrayDiff.some(diff => diff.type !== 'unchanged')) {
      results.push({
        field: fieldName,
        type: 'modified',
        original,
        modified,
        arrayDiff
      });
    }
    return results;
  }

  // 对象处理
  if (typeof original === 'object' && typeof modified === 'object') {
    // 大对象跳过详细比较
    const originalKeys = Object.keys(original || {});
    const modifiedKeys = Object.keys(modified || {});
    
    if (skipLargeArrays && (originalKeys.length > 100 || modifiedKeys.length > 100)) {
      const hasChanges = originalKeys.length !== modifiedKeys.length ||
                        originalKeys.some(key => original[key] !== modified[key]);
      
      if (hasChanges) {
        results.push({
          field: fieldName,
          type: 'modified',
          original: `[对象字段数: ${originalKeys.length}]`,
          modified: `[对象字段数: ${modifiedKeys.length}]`
        });
      }
      return results;
    }

    const allKeys = new Set([...originalKeys, ...modifiedKeys]);
    
    for (const key of allKeys) {
      const nestedDiffs = deepDiffOptimized(
        original?.[key],
        modified?.[key],
        key,
        config,
        depth + 1
      );
      results.push(...nestedDiffs);
    }
    
    return results;
  }

  // 基本类型差异
  if (original !== modified) {
    results.push({
      field: fieldName,
      type: 'modified',
      original,
      modified
    });
  }

  // 缓存结果
  if (cacheResults && depth === 0) {
    const cacheKey = generateCacheKey(original, modified);
    globalCache.set(cacheKey, results);
  }

  return results;
}

/**
 * 优化的文本差异计算
 */
function calculateTextDiffOptimized(original: string, modified: string): TextDiff[] {
  // 快速路径：相同字符串
  if (original === modified) {
    return [{ type: 'unchanged', text: original, start: 0, end: original.length }];
  }

  // 快速路径：空字符串
  if (!original) {
    return [{ type: 'added', text: modified, start: 0, end: modified.length }];
  }
  if (!modified) {
    return [{ type: 'removed', text: original, start: 0, end: original.length }];
  }

  // 长文本优化：使用简单的字符计数差异
  if (original.length > 1000 || modified.length > 1000) {
    const similarity = calculateStringSimilarity(original, modified);
    if (similarity > 0.9) {
      return [{ type: 'modified', text: modified, start: 0, end: modified.length }];
    }
  }

  const diffs = dmp.diff_main(original, modified);
  dmp.diff_cleanupSemantic(diffs);

  const result: TextDiff[] = [];
  let position = 0;

  for (const [operation, text] of diffs) {
    if (operation === 0) {
      result.push({
        type: 'unchanged',
        text,
        start: position,
        end: position + text.length
      });
      position += text.length;
    } else if (operation === -1) {
      result.push({
        type: 'removed',
        text,
        start: position,
        end: position + text.length
      });
    } else if (operation === 1) {
      result.push({
        type: 'added',
        text,
        start: position,
        end: position + text.length
      });
      position += text.length;
    }
  }

  return result;
}

/**
 * 计算字符串相似度
 */
function calculateStringSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
}

/**
 * Levenshtein距离算法
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

/**
 * 优化的数组差异计算
 */
function calculateArrayDiffOptimized(
  original: any[],
  modified: any[],
  config: DiffOptimizationConfig = {},
  depth = 0
): ArrayDiff[] {
  const {
    maxDepth = 10,
    skipLargeArrays = true
  } = config;

  if (depth > maxDepth) {
    return [];
  }

  // 大数组优化
  if (skipLargeArrays && (original.length > 1000 || modified.length > 1000)) {
    const maxLength = Math.min(10, Math.max(original.length, modified.length));
    const truncatedOriginal = original.slice(0, maxLength);
    const truncatedModified = modified.slice(0, maxLength);
    
    return calculateArrayDiffOptimized(truncatedOriginal, truncatedModified, config, depth);
  }

  const result: ArrayDiff[] = [];
  const maxLength = Math.max(original.length, modified.length);

  for (let i = 0; i < maxLength; i++) {
    const origItem = original[i];
    const modItem = modified[i];

    if (i >= original.length) {
      result.push({
        type: 'added',
        index: i,
        modified: modItem
      });
    } else if (i >= modified.length) {
      result.push({
        type: 'removed',
        index: i,
        original: origItem
      });
    } else if (JSON.stringify(origItem) !== JSON.stringify(modItem)) {
      const arrayDiff: ArrayDiff = {
        type: 'modified',
        index: i,
        original: origItem,
        modified: modItem
      };

      // 字符串元素优化
      if (typeof origItem === 'string' && typeof modItem === 'string') {
        if (origItem.length < 1000 && modItem.length < 1000) {
          arrayDiff.textDiff = calculateTextDiffOptimized(origItem, modItem);
        }
      }

      result.push(arrayDiff);
    } else {
      result.push({
        type: 'unchanged',
        index: i,
        original: origItem,
        modified: modItem
      });
    }
  }

  return result;
}

/**
 * 获取差异统计信息
 */
export function getDiffStats(diffs: DiffResult[]): {
  added: number;
  removed: number;
  modified: number;
  total: number;
} {
  const stats = { added: 0, removed: 0, modified: 0, total: 0 };

  for (const diff of diffs) {
    if (diff.type === 'added') stats.added++;
    else if (diff.type === 'removed') stats.removed++;
    else if (diff.type === 'modified') stats.modified++;
    
    if (diff.type !== 'unchanged') stats.total++;
  }

  return stats;
}

/**
 * 性能优化的用户画像差异计算
 */
export function calculatePortraitDiffOptimized(
  original: UserPortraitData,
  modified: UserPortraitData,
  config: DiffOptimizationConfig = {}
): DiffResult[] {
  return deepDiffOptimized(original, modified, 'portrait', config);
}

/**
 * 清理缓存
 */
export function clearDiffCache() {
  globalCache.clear();
}

/**
 * 获取缓存统计
 */
export function getCacheStats() {
  return {
    size: globalCache['cache'].size,
    maxSize: globalCache['maxSize']
  };
}

/**
 * 批量差异计算
 */
export async function calculateBatchDiffs(
  items: Array<{ id: string; original: UserPortraitData; modified: UserPortraitData }>,
  config: DiffOptimizationConfig = {}
): Promise<Array<{ id: string; diffs: DiffResult[] }>> {
  const results: Array<{ id: string; diffs: DiffResult[] }> = [];
  
  // 分批处理，避免阻塞主线程
  const batchSize = 10;
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    
    for (const item of batch) {
      const diffs = calculatePortraitDiffOptimized(item.original, item.modified, config);
      results.push({ id: item.id, diffs });
    }
    
    // 让出控制权，避免阻塞
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  
  return results;
}