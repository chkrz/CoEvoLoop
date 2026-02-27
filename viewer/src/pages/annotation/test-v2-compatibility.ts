// V2 API兼容性测试脚本
// 用于验证V1到V2的数据格式转换

import { AnnotationItem } from '@/lib/annotationApiV2';

// 模拟V1数据结构
interface V1Conversation {
  id: string;
  dataset_id: string;
  conversation_id: string;
  sample_index: number;
  original_data: any;
  preview: string;
  edited_data?: any;
  quality_score?: number;
  accuracy?: 'correct' | 'partial' | 'incorrect';
  category?: string;
  tags?: string[];
  notes?: string;
  is_annotated: boolean;
}

// 模拟V2数据结构
interface V2Item {
  id: string;
  dataset_id: string;
  data_type: string;
  original_content: any;
  edited_content?: any;
  tags: string[];
  notes: string;
  quality_rating?: number;
  custom_fields?: any;
}

// 数据格式转换函数
export function convertV1ToV2(v1Data: V1Conversation): AnnotationItem {
  return {
    id: v1Data.id,
    dataset_id: v1Data.dataset_id,
    data_type: 'DIALOGUE', // 默认类型，根据实际情况调整
    original_content: v1Data.original_data,
    edited_content: v1Data.edited_data || v1Data.original_data,
    tags: v1Data.tags || [],
    notes: v1Data.notes || '',
    quality_rating: v1Data.quality_score,
    custom_fields: {
      category: v1Data.category,
      accuracy: v1Data.accuracy,
      is_annotated: v1Data.is_annotated,
      conversation_id: v1Data.conversation_id,
      sample_index: v1Data.sample_index
    },
    line_number: v1Data.sample_index + 1
  };
}

// 反向转换函数
export function convertV2ToV1(v2Data: AnnotationItem): V1Conversation {
  return {
    id: v2Data.id,
    dataset_id: v2Data.dataset_id,
    conversation_id: v2Data.custom_fields?.conversation_id || `${v2Data.dataset_id}_${v2Data.line_number - 1}`,
    sample_index: v2Data.custom_fields?.sample_index ?? (v2Data.line_number - 1),
    original_data: v2Data.original_content,
    edited_data: v2Data.edited_content,
    preview: extractPreviewText(v2Data.original_content),
    quality_score: v2Data.quality_rating,
    accuracy: v2Data.custom_fields?.accuracy,
    category: v2Data.custom_fields?.category,
    tags: v2Data.tags,
    notes: v2Data.notes,
    is_annotated: v2Data.is_annotated || false
  };
}

// 提取预览文本
function extractPreviewText(content: any): string {
  if (!content) return '无对话内容';
  
  const conversations = content.conversations || content.conversation || content.messages || [];
  if (!Array.isArray(conversations) || conversations.length === 0) {
    return '无对话内容';
  }
  
  const firstMessage = conversations.find(c => c.from === 'user' || c.role === 'user');
  if (firstMessage) {
    const text = firstMessage.value || firstMessage.content || firstMessage.text || '';
    return text.length > 50 ? text.substring(0, 50) + '...' : text;
  }
  
  return '对话内容预览';
}

// 测试用例
export const testCases = {
  v1Sample: {
    id: 'test-123',
    dataset_id: 'dataset-456',
    conversation_id: 'conv-789',
    sample_index: 0,
    original_data: {
      conversations: [
        { from: 'user', value: '你好，我需要帮助' },
        { from: 'assistant', value: '您好，请问需要什么帮助？' }
      ]
    },
    preview: '你好，我需要帮助',
    quality_score: 4,
    accuracy: 'correct' as const,
    category: 'general',
    tags: ['友好', '有效'],
    notes: '对话质量良好',
    is_annotated: true
  },
  
  v2Sample: {
    id: 'test-123',
    dataset_id: 'dataset-456',
    data_type: 'DIALOGUE' as const,
    original_content: {
      conversations: [
        { from: 'user', value: '你好，我需要帮助' },
        { from: 'assistant', value: '您好，请问需要什么帮助？' }
      ]
    },
    edited_content: {
      conversations: [
        { from: 'user', value: '你好，我需要帮助' },
        { from: 'assistant', value: '您好，请问需要什么帮助？' }
      ]
    },
    tags: ['友好', '有效'],
    notes: '对话质量良好',
    quality_rating: 4,
    custom_fields: {
      category: 'general',
      accuracy: 'correct',
      is_annotated: true,
      conversation_id: 'conv-789',
      sample_index: 0
    },
    line_number: 1
  }
};

// 运行测试
export function runCompatibilityTests() {
  console.log('=== V1 to V2 转换测试 ===');
  const v2Converted = convertV1ToV2(testCases.v1Sample);
  console.log('V1 -> V2:', v2Converted);
  
  console.log('=== V2 to V1 转换测试 ===');
  const v1Converted = convertV2ToV1(testCases.v2Sample);
  console.log('V2 -> V1:', v1Converted);
  
  console.log('=== 数据完整性验证 ===');
  console.log('V1 -> V2 -> V1 完整性:', 
    JSON.stringify(testCases.v1Sample) === JSON.stringify(convertV2ToV1(convertV1ToV2(testCases.v1Sample)))
  );
}

// 导出兼容性检查函数
export function checkDataCompatibility(data: any): 'v1' | 'v2' | 'unknown' {
  if (data.original_data && data.sample_index !== undefined) {
    return 'v1';
  }
  if (data.original_content && data.line_number !== undefined) {
    return 'v2';
  }
  return 'unknown';
}