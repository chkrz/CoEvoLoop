/**
 * 文本差异计算工具
 * 提供文本差异计算和高亮渲染功能
 */

// 缓存机制，避免重复计算
const diffCache = new Map<string, DiffResult>();

export interface DiffSegment {
  type: 'equal' | 'insert' | 'delete' | 'replace';
  value: string;
  original?: string;
  modified?: string;
}

export interface DiffResult {
  segments: DiffSegment[];
  similarity: number;
  changes: number;
}

/**
 * Myers差异算法实现
 * 计算两个文本之间的差异
 */
export function computeDiff(original: string, modified: string): DiffResult {
  // 检查缓存
  const cacheKey = `${original}||${modified}`;
  if (diffCache.has(cacheKey)) {
    return diffCache.get(cacheKey)!;
  }

  if (!original && !modified) {
    const result = { segments: [], similarity: 1, changes: 0 };
    diffCache.set(cacheKey, result);
    return result;
  }

  if (!original) {
    const result = {
      segments: [{ type: 'insert', value: modified }],
      similarity: 0,
      changes: 1
    };
    diffCache.set(cacheKey, result);
    return result;
  }

  if (!modified) {
    const result = {
      segments: [{ type: 'delete', value: original }],
      similarity: 0,
      changes: 1
    };
    diffCache.set(cacheKey, result);
    return result;
  }

  // 对于大文本，使用简化的算法以提高性能
  if (original.length > 1000 || modified.length > 1000) {
    const result = optimizedDiff(original, modified);
    diffCache.set(cacheKey, result);
    return result;
  }

  // 使用简单的字符级差异算法
  const segments = simpleDiff(original, modified);
  
  // 计算相似度
  const totalLength = Math.max(original.length, modified.length);
  const unchangedLength = segments
    .filter(s => s.type === 'equal')
    .reduce((sum, s) => sum + s.value.length, 0);
  
  const similarity = totalLength > 0 ? unchangedLength / totalLength : 1;
  const changes = segments.filter(s => s.type !== 'equal').length;

  const result = { segments, similarity, changes };
  diffCache.set(cacheKey, result);
  return result;
}

/**
 * 简单的差异算法实现
 * 基于字符的diff算法
 */
function simpleDiff(original: string, modified: string): DiffSegment[] {
  const segments: DiffSegment[] = [];
  
  // 如果文本完全相同
  if (original === modified) {
    return [{ type: 'equal', value: original }];
  }

  // 使用最长公共子序列算法
  const lcs = longestCommonSubsequence(original, modified);
  
  let originalIndex = 0;
  let modifiedIndex = 0;
  let lcsIndex = 0;

  while (originalIndex < original.length || modifiedIndex < modified.length) {
    if (
      lcsIndex < lcs.length &&
      originalIndex < original.length &&
      modifiedIndex < modified.length &&
      original[originalIndex] === modified[modifiedIndex] &&
      original[originalIndex] === lcs[lcsIndex]
    ) {
      // 匹配的部分
      let equalStr = '';
      while (
        lcsIndex < lcs.length &&
        originalIndex < original.length &&
        modifiedIndex < modified.length &&
        original[originalIndex] === modified[modifiedIndex] &&
        original[originalIndex] === lcs[lcsIndex]
      ) {
        equalStr += original[originalIndex];
        originalIndex++;
        modifiedIndex++;
        lcsIndex++;
      }
      if (equalStr) {
        segments.push({ type: 'equal', value: equalStr });
      }
    } else {
      // 处理差异部分
      let deletedStr = '';
      while (
        originalIndex < original.length &&
        (lcsIndex >= lcs.length || original[originalIndex] !== lcs[lcsIndex])
      ) {
        deletedStr += original[originalIndex];
        originalIndex++;
      }
      if (deletedStr) {
        segments.push({ type: 'delete', value: deletedStr });
      }

      let insertedStr = '';
      while (
        modifiedIndex < modified.length &&
        (lcsIndex >= lcs.length || modified[modifiedIndex] !== lcs[lcsIndex])
      ) {
        insertedStr += modified[modifiedIndex];
        modifiedIndex++;
      }
      if (insertedStr) {
        segments.push({ type: 'insert', value: insertedStr });
      }
    }
  }

  return segments;
}

/**
 * 计算最长公共子序列
 */
function longestCommonSubsequence(str1: string, str2: string): string {
  const m = str1.length;
  const n = str2.length;
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  // 填充动态规划表
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // 回溯构建LCS
  let i = m;
  let j = n;
  let lcs = '';

  while (i > 0 && j > 0) {
    if (str1[i - 1] === str2[j - 1]) {
      lcs = str1[i - 1] + lcs;
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return lcs;
}

/**
 * 将差异结果转换为HTML字符串
 */
export function diffToHtml(segments: DiffSegment[]): string {
  return segments
    .map(segment => {
      const escapedValue = escapeHtml(segment.value);
      switch (segment.type) {
        case 'insert':
          return `<ins class="diff-insert">${escapedValue}</ins>`;
        case 'delete':
          return `<del class="diff-delete">${escapedValue}</del>`;
        case 'replace':
          return `<span class="diff-replace">${escapedValue}</span>`;
        case 'equal':
        default:
          return `<span class="diff-equal">${escapedValue}</span>`;
      }
    })
    .join('');
}

import React from 'react';

/**
 * 将差异结果转换为React节点
 */
export function diffToReactNodes(segments: DiffSegment[]): React.ReactNode[] {
  return segments.map((segment, index) => {
    switch (segment.type) {
      case 'insert':
        return React.createElement('ins', {
          key: index,
          className: 'diff-insert',
          title: '新增内容'
        }, segment.value);
      case 'delete':
        return React.createElement('del', {
          key: index,
          className: 'diff-delete',
          title: '删除内容'
        }, segment.value);
      case 'replace':
        return React.createElement('span', {
          key: index,
          className: 'diff-replace',
          title: '修改内容'
        }, segment.value);
      case 'equal':
      default:
        return React.createElement('span', {
          key: index,
          className: 'diff-equal'
        }, segment.value);
    }
  });
}

/**
 * 获取差异的统计信息
 */
export function getDiffStats(segments: DiffSegment[]): {
  insertions: number;
  deletions: number;
  modifications: number;
} {
  let insertions = 0;
  let deletions = 0;
  let modifications = 0;

  segments.forEach(segment => {
    switch (segment.type) {
      case 'insert':
        insertions += segment.value.length;
        break;
      case 'delete':
        deletions += segment.value.length;
        break;
      case 'replace':
        modifications += segment.value.length;
        break;
    }
  });

  return { insertions, deletions, modifications };
}

/**
 * 转义HTML特殊字符
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * 检查两个文本是否有差异
 */
export function hasDiff(original: string, modified: string): boolean {
  return original !== modified;
}

/**
 * 获取差异摘要
 */
export function getDiffSummary(original: string, modified: string): string {
  if (!hasDiff(original, modified)) {
    return '无修改';
  }

  const diff = computeDiff(original, modified);
  const stats = getDiffStats(diff.segments);

  const parts: string[] = [];
  if (stats.insertions > 0) parts.push(`新增 ${stats.insertions} 字符`);
  if (stats.deletions > 0) parts.push(`删除 ${stats.deletions} 字符`);
  if (stats.modifications > 0) parts.push(`修改 ${stats.modifications} 字符`);

  return parts.join('，');
}

/**
 * 优化的差异算法，适用于大文本
 */
function optimizedDiff(original: string, modified: string): DiffResult {
  // 使用基于行的差异算法，提高大文本性能
  const originalLines = original.split('\n');
  const modifiedLines = modified.split('\n');
  
  // 简化的行级差异算法
  const segments: DiffSegment[] = [];
  let i = 0, j = 0;
  
  while (i < originalLines.length && j < modifiedLines.length) {
    if (originalLines[i] === modifiedLines[j]) {
      segments.push({ type: 'equal', value: originalLines[i] + '\n' });
      i++;
      j++;
    } else {
      // 查找下一个匹配行
      let nextMatch = -1;
      for (let k = j + 1; k < modifiedLines.length; k++) {
        if (modifiedLines[k] === originalLines[i]) {
          nextMatch = k;
          break;
        }
      }
      
      if (nextMatch !== -1 && nextMatch - j <= 5) {
        // 添加删除的行
        for (let k = i; k < originalLines.length && k < i + (nextMatch - j); k++) {
          segments.push({ type: 'delete', value: originalLines[k] + '\n' });
        }
        i += (nextMatch - j);
        
        // 添加新增的行
        for (let k = j; k < nextMatch; k++) {
          segments.push({ type: 'insert', value: modifiedLines[k] + '\n' });
        }
        j = nextMatch;
      } else {
        // 简单的替换
        segments.push({ type: 'delete', value: originalLines[i] + '\n' });
        segments.push({ type: 'insert', value: modifiedLines[j] + '\n' });
        i++;
        j++;
      }
    }
  }
  
  // 处理剩余的行
  while (i < originalLines.length) {
    segments.push({ type: 'delete', value: originalLines[i] + '\n' });
    i++;
  }
  
  while (j < modifiedLines.length) {
    segments.push({ type: 'insert', value: modifiedLines[j] + '\n' });
    j++;
  }
  
  // 计算相似度
  const totalLines = Math.max(originalLines.length, modifiedLines.length);
  const equalLines = segments.filter(s => s.type === 'equal').length;
  const similarity = totalLines > 0 ? equalLines / totalLines : 1;
  const changes = segments.filter(s => s.type !== 'equal').length;
  
  return { segments, similarity, changes };
}

/**
 * 清除缓存
 */
export function clearDiffCache(): void {
  diffCache.clear();
}

/**
 * 获取缓存大小
 */
export function getCacheSize(): number {
  return diffCache.size;
}