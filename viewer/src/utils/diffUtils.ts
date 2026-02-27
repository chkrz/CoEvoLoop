import * as DiffMatchPatch from 'diff-match-patch';

export interface TextDiff {
  type: 'added' | 'removed' | 'unchanged';
  text: string;
  start?: number;
  end?: number;
}

export interface ArrayDiff {
  type: 'added' | 'removed' | 'modified' | 'unchanged';
  index: number;
  original?: any;
  modified?: any;
  textDiff?: TextDiff[];
}

export interface DiffResult {
  field: string;
  type: 'added' | 'removed' | 'modified' | 'unchanged';
  original?: any;
  modified?: any;
  textDiff?: TextDiff[];
  arrayDiff?: ArrayDiff[];
  nestedDiff?: DiffResult[];
}

export interface UserPortraitData {
  background_description?: string[];
  knowledge_blind_spots?: string[];
  operation_history?: Array<{
    action: string;
    timestamp: string;
    details?: string;
  }>;
  problem_description?: string[];
  [key: string]: any;
}

const dmp = new DiffMatchPatch.diff_match_patch();

/**
 * 深度对比两个对象，返回差异结果
 */
export function deepDiff(original: any, modified: any, fieldName: string = 'root'): DiffResult[] {
  const results: DiffResult[] = [];

  if (original === modified) {
    return results;
  }

  if (original === undefined && modified !== undefined) {
    return [{
      field: fieldName,
      type: 'added',
      original,
      modified
    }];
  }

  if (original !== undefined && modified === undefined) {
    return [{
      field: fieldName,
      type: 'removed',
      original,
      modified
    }];
  }

  if (typeof original !== typeof modified) {
    return [{
      field: fieldName,
      type: 'modified',
      original,
      modified
    }];
  }

  if (typeof original === 'string') {
    const textDiff = calculateTextDiff(original, modified);
    return [{
      field: fieldName,
      type: textDiff.some(d => d.type !== 'unchanged') ? 'modified' : 'unchanged',
      original,
      modified,
      textDiff
    }];
  }

  if (Array.isArray(original) && Array.isArray(modified)) {
    const arrayDiff = calculateArrayDiff(original, modified);
    return [{
      field: fieldName,
      type: arrayDiff.some(d => d.type !== 'unchanged') ? 'modified' : 'unchanged',
      original,
      modified,
      arrayDiff
    }];
  }

  if (typeof original === 'object' && original !== null && modified !== null) {
    const allKeys = new Set([...Object.keys(original), ...Object.keys(modified)]);
    
    for (const key of allKeys) {
      const nestedDiffs = deepDiff(original[key], modified[key], key);
      results.push(...nestedDiffs);
    }
    
    return results;
  }

  if (original !== modified) {
    return [{
      field: fieldName,
      type: 'modified',
      original,
      modified
    }];
  }

  return results;
}

/**
 * 计算文本差异
 */
export function calculateTextDiff(original: string, modified: string): TextDiff[] {
  const diffs = dmp.diff_main(original, modified);
  dmp.diff_cleanupSemantic(diffs);

  const result: TextDiff[] = [];
  let position = 0;

  for (const [operation, text] of diffs) {
    if (operation === 0) { // EQUAL
      result.push({
        type: 'unchanged',
        text,
        start: position,
        end: position + text.length
      });
      position += text.length;
    } else if (operation === -1) { // DELETE
      result.push({
        type: 'removed',
        text,
        start: position,
        end: position + text.length
      });
    } else if (operation === 1) { // INSERT
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
 * 计算数组差异
 */
export function calculateArrayDiff(original: any[], modified: any[]): ArrayDiff[] {
  const result: ArrayDiff[] = [];
  const maxLength = Math.max(original.length, modified.length);

  for (let i = 0; i < maxLength; i++) {
    const origItem = original[i];
    const modItem = modified[i];

    if (i >= original.length) {
      // 新增元素
      result.push({
        type: 'added',
        index: i,
        modified: modItem
      });
    } else if (i >= modified.length) {
      // 删除元素
      result.push({
        type: 'removed',
        index: i,
        original: origItem
      });
    } else if (JSON.stringify(origItem) !== JSON.stringify(modItem)) {
      // 修改元素
      if (typeof origItem === 'string' && typeof modItem === 'string') {
        const textDiff = calculateTextDiff(origItem, modItem);
        result.push({
          type: 'modified',
          index: i,
          original: origItem,
          modified: modItem,
          textDiff
        });
      } else {
        result.push({
          type: 'modified',
          index: i,
          original: origItem,
          modified: modItem
        });
      }
    } else {
      // 未变化
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
 * 计算用户画像数据的差异
 */
export function calculatePortraitDiff(original: UserPortraitData, modified: UserPortraitData): DiffResult[] {
  return deepDiff(original, modified, 'portrait');
}

/**
 * 过滤出变化的差异结果
 */
export function getChangedDiffs(diffs: DiffResult[]): DiffResult[] {
  return diffs.filter(diff => diff.type !== 'unchanged');
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
 * 将差异结果转换为可读的文本描述
 */
export function diffToText(diffs: DiffResult[]): string {
  const lines: string[] = [];

  for (const diff of diffs) {
    if (diff.type === 'unchanged') continue;

    let description = `${diff.field}: `;
    
    switch (diff.type) {
      case 'added':
        description += `新增值 "${JSON.stringify(diff.modified)}"`;
        break;
      case 'removed':
        description += `删除值 "${JSON.stringify(diff.original)}"`;
        break;
      case 'modified':
        description += `从 "${JSON.stringify(diff.original)}" 修改为 "${JSON.stringify(diff.modified)}"`;
        break;
    }

    lines.push(description);
  }

  return lines.join('\n');
}