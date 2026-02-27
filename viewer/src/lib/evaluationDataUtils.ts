import { AnnotationItem } from './annotationApiV2';

export interface EvaluationDisplayData {
  id: string;
  conversations: Array<{
    role: string;
    content: string;
  }>;
  metadata: {
    dataset_id: string;
    line_number: number;
    source_file: string;
    uuid: string;
    original_data: {
      index: number;
      evaluation_id: string;
      evaluation: Record<string, any>;
      success: boolean;
    };
  };
  original_evaluation: Record<string, any>;
  edited_evaluation: Record<string, any>;
  display_evaluation: Record<string, any>;
  has_edited_content: boolean;
  changed_fields: string[];
  annotation_data?: any;
}

/**
 * 标准化评估数据结构
 * 统一处理API返回的数据格式，确保数据结构一致性
 */
export function normalizeEvaluationData(item: AnnotationItem): EvaluationDisplayData {
  if (!item) {
    throw new Error('评估数据项不能为空');
  }

  const originalContent = item.original_content || {};
  const editedContent = item.edited_content || 
                       (item as any).annotation_data?.edited_content || 
                       {};
  
  // 提取对话内容
  const conversations = extractConversations(originalContent);
  
  // 提取评估数据
  const originalEvaluation = extractEvaluationData(originalContent);
  const editedEvaluation = extractEvaluationData(editedContent);
  
  // 判断是否有编辑内容
  const hasEditedContent = Object.keys(editedEvaluation).length > 0;
  
  // 确定展示的数据（优先级：edited_evaluation > original_evaluation）
  const displayEvaluation = hasEditedContent ? editedEvaluation : originalEvaluation;
  
  // 计算变更的字段（只有当有编辑内容时才计算变更）
  const changedFields = hasEditedContent ? calculateChangedFields(originalEvaluation, editedEvaluation) : [];
  
  return {
    id: item.id || generateId(),
    conversations,
    metadata: {
      dataset_id: item.dataset_id || '',
      line_number: item.line_number || 0,
      source_file: originalContent.source_file || '',
      uuid: originalContent.uuid || item.id,
      original_data: {
        index: originalContent.index || 0,
        evaluation_id: originalContent.evaluation_id || item.id,
        evaluation: originalEvaluation,
        success: originalContent.success || true
      }
    },
    original_evaluation: originalEvaluation,
    edited_evaluation: editedEvaluation,
    display_evaluation: displayEvaluation,
    has_edited_content: hasEditedContent,
    changed_fields: changedFields,
    annotation_data: (item as any).annotation_data
  };
}

/**
 * 提取对话内容
 */
function extractConversations(content: any): Array<{ role: string; content: string }> {
  if (!content) return [];
  
  // 支持多种格式的对话数据
  const conversations = content.conversation || content.conversations || [];
  
  if (Array.isArray(conversations)) {
    return conversations.map(conv => ({
      role: conv.role || 'unknown',
      content: conv.content || String(conv)
    }));
  }
  
  return [];
}

/**
 * 提取评估数据
 */
function extractEvaluationData(content: any): Record<string, any> {
  if (!content) return {};
  
  // 支持多种路径的评估数据
  const evaluation = content.evaluation || 
                   content.metadata?.evaluation || 
                   content.original_data?.evaluation || 
                   {};
  
  return typeof evaluation === 'object' ? evaluation : {};
}

/**
 * 计算变更的字段
 */
function calculateChangedFields(
  original: Record<string, any>,
  edited: Record<string, any>
): string[] {
  const changes: string[] = [];
  
  // 检查所有字段的变更
  const allKeys = new Set([...Object.keys(original), ...Object.keys(edited)]);
  
  for (const key of allKeys) {
    const originalValue = original[key];
    const editedValue = edited[key];
    
    if (!isEqual(originalValue, editedValue)) {
      changes.push(key);
    }
  }
  
  return changes;
}

/**
 * 深度比较两个值是否相等
 */
function isEqual(a: any, b: any): boolean {
  if (a === b) return true;
  
  if (a == null || b == null) return a === b;
  
  if (typeof a !== typeof b) return false;
  
  if (typeof a !== 'object') return a === b;
  
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    return a.every((item, index) => isEqual(item, b[index]));
  }
  
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  
  if (keysA.length !== keysB.length) return false;
  
  return keysA.every(key => isEqual(a[key], b[key]));
}

/**
 * 生成唯一ID
 */
function generateId(): string {
  return `eval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 获取展示优先级数据
 * 根据优先级规则返回应该展示的数据
 */
export function getDisplayData(
  original: Record<string, any>,
  edited: Record<string, any>
): { data: Record<string, any>; source: 'original' | 'edited' } {
  const hasEdited = Object.keys(edited).length > 0;
  
  return {
    data: hasEdited ? edited : original,
    source: hasEdited ? 'edited' : 'original'
  };
}

/**
 * 验证评估数据格式
 */
export function validateEvaluationData(data: any): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!data) {
    errors.push('数据不能为空');
    return { isValid: false, errors, warnings };
  }
  
  if (!data.id) {
    warnings.push('缺少ID字段');
  }
  

  
  if (!data.original_evaluation || Object.keys(data.original_evaluation).length === 0) {
    warnings.push('缺少原始评估数据');
  }
  
  // 验证评估数据格式
  const evaluation = data.display_evaluation || {};
  for (const [key, value] of Object.entries(evaluation)) {
    if (typeof value === 'number' && (value < 0 || value > 1)) {
      warnings.push(`评估字段 ${key} 的数值范围可能不正确: ${value}`);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * 创建变更摘要
 */
export function createChangeSummary(
  original: Record<string, any>,
  edited: Record<string, any>
): {
  totalFields: number;
  changedFields: number;
  addedFields: string[];
  removedFields: string[];
  modifiedFields: Array<{ field: string; oldValue: any; newValue: any }>;
} {
  // 如果edited为空对象，认为没有变更
  if (Object.keys(edited).length === 0) {
    return {
      totalFields: Object.keys(original).length,
      changedFields: 0,
      addedFields: [],
      removedFields: [],
      modifiedFields: []
    };
  }

  const originalKeys = new Set(Object.keys(original));
  const editedKeys = new Set(Object.keys(edited));
  
  const addedFields = Array.from(editedKeys).filter(key => !originalKeys.has(key));
  const removedFields = Array.from(originalKeys).filter(key => !editedKeys.has(key));
  const modifiedFields: Array<{ field: string; oldValue: any; newValue: any }> = [];
  
  for (const key of originalKeys) {
    if (editedKeys.has(key) && !isEqual(original[key], edited[key])) {
      modifiedFields.push({
        field: key,
        oldValue: original[key],
        newValue: edited[key]
      });
    }
  }
  
  return {
    totalFields: Math.max(originalKeys.size, editedKeys.size),
    changedFields: addedFields.length + removedFields.length + modifiedFields.length,
    addedFields,
    removedFields,
    modifiedFields
  };
}