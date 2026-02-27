import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

export interface ConversationAnnotation {
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
  annotation_time?: string;
  annotated_by?: string;
  created_at: string;
  updated_at: string;
}

export interface ConversationListItem {
  dataset_id: string;
  sample_index: number;
  conversation_id: string;
  is_annotated: boolean;
  quality_score?: number;
  preview: string;
  updated_at?: string;
  original_data: any;
  accuracy?: 'correct' | 'partial' | 'incorrect';
  category?: string;
  tags?: string[];
  notes?: string;
}

export interface AnnotationStats {
  total: number;
  annotated: number;
  pending: number;
  quality_distribution: {
    [key: string]: number;
  };
  accuracy_distribution: {
    [key: string]: number;
  };
}

export interface AnnotationBatch {
  id: string;
  name: string;
  dataset_id: string;
  description: string;
  total_samples: number;
  annotated_count: number;
  progress: number;
  is_active: boolean;
  created_by: string;
  created_at: string;
}

class AnnotationApiService {
  // 获取对话列表（支持分页）
  async getConversations(datasetId: string, page: number = 1, pageSize: number = 20): Promise<{
    conversations: ConversationAnnotation[];
    pagination: {
      page: number;
      page_size: number;
      total: number;
      total_pages: number;
      has_next: boolean;
      has_previous: boolean;
    };
  }> {
    try {
      // 使用新的分页API
      const response = await axios.get(`${API_BASE_URL}/annotations/list_conversations/`, {
        params: { 
          dataset_id: datasetId,
          page,
          page_size: pageSize
        }
      });
      
      const data = response.data;
      return {
        conversations: data.conversations || [],
        pagination: data.pagination || {
          page,
          page_size: pageSize,
          total: data.total || 0,
          total_pages: Math.ceil((data.total || 0) / pageSize),
          has_next: false,
          has_previous: false
        }
      };
    } catch (error) {
      console.warn('API endpoint not found, using mock conversations');
      // 返回模拟对话数据
      const mockConversations = [
        {
          id: 'mock-1',
          dataset_id: datasetId,
          conversation_id: 'mock-1',
          sample_index: 0,
          original_data: {
            conversations: [
              {
                from: "user",
                value: "你好，我需要绑定一个外币银行账户..."
              },
              {
                from: "assistant",
                value: "您好，很抱歉给您带来不便了..."
              }
            ]
          },
          is_annotated: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
      ];
      
      return {
        conversations: mockConversations.slice(0, pageSize),
        pagination: {
          page,
          page_size: pageSize,
          total: mockConversations.length,
          total_pages: Math.ceil(mockConversations.length / pageSize),
          has_next: false,
          has_previous: false
        }
      };
    }
  }

  // 提取预览文本
  private extractPreviewText(conversations: any[]): string {
    if (!conversations || !Array.isArray(conversations)) {
      return '无对话内容';
    }
    
    const firstMessage = conversations.find(c => c.role === 'user' || c.from === 'user');
    if (firstMessage) {
      const content = firstMessage.content || firstMessage.value || '';
      return content.length > 50 ? content.substring(0, 50) + '...' : content;
    }
    
    return '对话内容预览';
  }

  // 获取单个对话详情
  async getConversation(datasetId: string, sampleIndex: number): Promise<ConversationAnnotation> {
    try {
      // 如果是本地数据集，使用本地数据集API
      if (datasetId.startsWith('local-')) {
        const response = await axios.get(`${API_BASE_URL}/local-datasets/${datasetId}/content/`);
        const data = response.data;
        
        if (data.conversations && data.conversations[sampleIndex]) {
          const conv = data.conversations[sampleIndex];
          return {
            id: conv.metadata?.uuid || `local-${datasetId}-${sampleIndex}`,
            dataset_id: datasetId,
            conversation_id: conv.metadata?.uuid || `conv-${sampleIndex}`,
            sample_index: sampleIndex,
            original_data: {
              conversations: this.formatConversations(conv.conversations)
            },
            is_annotated: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
        }
      }
      
      // 原有API调用
      const response = await axios.get(`${API_BASE_URL}/annotations/get_conversation/`, {
        params: { dataset_id: datasetId, sample_index: sampleIndex }
      });
      return response.data;
    } catch (error) {
      console.warn('API endpoint not found, using mock conversation');
      // 返回模拟对话数据
      return {
        id: `mock-${datasetId}-${sampleIndex}`,
        dataset_id: datasetId,
        conversation_id: `conv-${sampleIndex}`,
        sample_index: sampleIndex,
        original_data: {
          conversations: [
            {
              from: "user",
              value: "你好，我需要绑定一个外币银行账户，并确认一下我的账户是否符合180天的提现条件。但目前我在绑定银行卡时遇到了问题，系统发送验证码到我的手机号，现在这个号码无法使用，能不能通过邮箱协助我完成绑定？"
            },
            {
              from: "assistant",
              value: "您好，很抱歉给您带来不便了。\n\n绑定银行账户时，验证码是默认发送到您账户绑定的安全手机号上的哦。\n\n不过，如果您原来的手机号已经不用了，**是可以操作修改的**。请问您需要了解如何修改绑定的手机号码吗？"
            }
          ]
        },
        is_annotated: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }
  }

  // 格式化对话数据
  private formatConversations(conversations: any[]): any[] {
    if (!conversations || !Array.isArray(conversations)) {
      return [];
    }
    
    return conversations.map(conv => {
      if (typeof conv === 'string') {
        return { from: 'user', value: conv };
      }
      
      if (conv.role && conv.content) {
        return { from: conv.role, value: conv.content };
      }
      
      if (conv.from && conv.value) {
        return conv;
      }
      
      return { from: 'user', value: JSON.stringify(conv) };
    });
  }

  // 更新标注信息 - 使用v2接口
  async updateAnnotation(id: string, data: Partial<ConversationAnnotation>): Promise<any> {
    // 将v1数据格式转换为v2格式
    const v2Data = {
      dataset_id: data.dataset_id || '',
      item_id: data.sample_index ? `${data.dataset_id}_${data.sample_index}` : id,
      annotation_data: {
        edited_content: data.edited_data || data.original_data,
        tags: data.tags || [],
        notes: data.notes || '',
        quality_rating: data.quality_score,
        intent: data.intent,
        roles: data.roles,
        custom_fields: {
          category: data.category,
          accuracy: data.accuracy,
          annotated_by: data.annotated_by || 'current_user',
          annotation_time: data.annotation_time || new Date().toISOString(),
          is_annotated: data.is_annotated !== false,
          ...data.custom_fields
        }
      },
      auto_save: data.auto_save || false
    };

    // 调用v2保存接口
    const response = await this.saveAnnotationV2(v2Data);
    return {
      ...data,
      id: response.item_id || id,
      timestamp: response.timestamp
    };
  }

  // 使用v2接口保存标注数据
  async saveAnnotationV2(data: {
    dataset_id: string;
    item_id: string;
    annotation_data: any;
    auto_save?: boolean;
  }) {
    try {
      const url = `${API_BASE_URL}/v2/annotations/save/`;
      console.log('Saving annotation to:', url);
      console.log('Request data:', JSON.stringify(data, null, 2));

      const response = await axios.post(url, data);
      return response.data;
    } catch (error: any) {
      console.error('Save annotation v2 error:', error);
      if (error.response) {
        console.error('Error response status:', error.response.status);
        console.error('Error response data:', error.response.data);
      }
      throw error;
    }
  }

  // 创建标注信息
  async createAnnotation(data: Omit<ConversationAnnotation, 'id' | 'created_at' | 'updated_at'>): Promise<ConversationAnnotation> {
    const response = await axios.post(`${API_BASE_URL}/annotations/`, data);
    return response.data;
  }

  // 获取或创建标注记录
  async getOrCreateAnnotation(datasetId: string, conversationId: string, sampleIndex: number) {
    try {
      // 首先尝试获取现有记录
      const response = await axios.get(`${API_BASE_URL}/annotations/`, {
        params: {
          dataset_id: datasetId,
          conversation_id: conversationId,
          sample_index: sampleIndex
        }
      });

      // 如果找到了记录，返回第一个
      if (response.data.results && response.data.results.length > 0) {
        return response.data.results[0];
      }
    } catch (error) {
      // 如果获取失败（比如404），继续创建新记录
      console.log('Annotation not found, creating new one');
    }

    // 创建新记录
    const newData = {
      dataset_id: datasetId,
      conversation_id: conversationId,
      sample_index: sampleIndex,
      original_data: {},
      edited_data: null,
      quality_score: null,
      accuracy: null,
      category: null,
      tags: [],
      notes: '',
      is_annotated: false,
      annotated_by: '',
    };

    const createResponse = await axios.post(`${API_BASE_URL}/annotations/`, newData);
    return createResponse.data;
  }

  // 获取标注统计
  async getStats(datasetId?: string): Promise<AnnotationStats> {
    try {
      const params = datasetId ? { dataset_id: datasetId } : {};
      const response = await axios.get(`${API_BASE_URL}/annotations/stats/`, { params });
      return response.data;
    } catch (error) {
      // 如果API不存在，返回默认统计
      console.warn('API endpoint not found, using mock stats');
      return {
        total: 100,
        annotated: 45,
        pending: 55,
        quality_distribution: {
          '5': 20,
          '4': 15,
          '3': 8,
          '2': 2,
          '1': 0
        },
        accuracy_distribution: {
          'correct': 30,
          'partial': 10,
          'incorrect': 5
        }
      };
    }
  }

  // 批次管理
  async getBatches(): Promise<AnnotationBatch[]> {
    const response = await axios.get(`${API_BASE_URL}/batches/`);
    return response.data;
  }

  async createBatch(batch: Omit<AnnotationBatch, 'id' | 'created_at'>): Promise<AnnotationBatch> {
    const response = await axios.post(`${API_BASE_URL}/batches/`, batch);
    return response.data;
  }

  async initializeBatchFromDataset(batchId: string): Promise<{ message: string }> {
    const response = await axios.post(`${API_BASE_URL}/batches/${batchId}/initialize_from_dataset/`);
    return response.data;
  }

// 关联关系管理
  async getAnnotationRelations(datasetId: string): Promise<any[]> {
    try {
      const response = await axios.get(`${API_BASE_URL}/annotations/relations/`, {
        params: { dataset_id: datasetId }
      });
      return response.data;
    } catch (error) {
      console.warn('Relation API not available, returning empty array');
      return [];
    }
  }

  async saveAnnotationRelation(relation: {
    dataset_id: string;
    original_sample_index: number;
    annotation_id: string;
    relation_type: string;
  }): Promise<any> {
    try {
      const response = await axios.post(`${API_BASE_URL}/annotations/relations/`, relation);
      return response.data;
    } catch (error) {
      console.warn('Failed to save relation:', error);
      return null;
    }
  }

  // 获取可转换为数据集的标注数据
  async getAnnotatedConversations(datasetId: string, filters?: {
    min_quality_score?: number;
    accuracy?: string[];
    category?: string[];
    annotator?: string[];
    start_date?: string;
    end_date?: string;
    data_types?: string[];
  }): Promise<ConversationAnnotation[]> {
    try {
      const params: any = { dataset_id: datasetId, is_annotated: true };
      if (filters) {
        if (filters.min_quality_score !== undefined) {
          params.min_quality_score = filters.min_quality_score;
        }
        if (filters.accuracy && filters.accuracy.length > 0) {
          params.accuracy = filters.accuracy.join(',');
        }
        if (filters.category && filters.category.length > 0) {
          params.category = filters.category.join(',');
        }
        if (filters.annotator && filters.annotator.length > 0) {
          params.annotator = filters.annotator.join(',');
        }
        if (filters.start_date) {
          params.start_date = filters.start_date;
        }
        if (filters.end_date) {
          params.end_date = filters.end_date;
        }
        if (filters.data_types && filters.data_types.length > 0) {
          params.data_types = filters.data_types.join(',');
        }
      }

      const response = await axios.get(`${API_BASE_URL}/annotations/filter/`, { params });
      return response.data;
    } catch (error) {
      console.warn('Filter API not available, returning empty array');
      return [];
    }
  }

  // 保存标注信息 - 兼容v1数据格式
  async saveAnnotation(data: {
    dataset_id: string;
    conversation_id: string;
    sample_index: number;
    original_data: any;
    edited_data?: any;
    quality_score?: number;
    accuracy?: 'correct' | 'partial' | 'incorrect';
    category?: string;
    tags?: string[];
    notes?: string;
    annotated_by?: string;
    annotation_time?: string;
    is_annotated: boolean;
    auto_save?: boolean;
  }): Promise<any> {
    try {
      // 转换为v2数据格式
      const v2Data = {
        dataset_id: data.dataset_id,
        // 确保使用正确的行号格式，从0开始
        item_id: `${data.dataset_id}_${data.sample_index + 1}`,
        annotation_data: {
          edited_content: data.edited_data || data.original_data,
          tags: data.tags || [],
          notes: data.notes || '',
          quality_rating: data.quality_score,
          intent: {},
          roles: {},
          custom_fields: {
            category: data.category,
            accuracy: data.accuracy,
            annotated_by: data.annotated_by || 'current_user',
            annotation_time: data.annotation_time || new Date().toISOString(),
            is_annotated: data.is_annotated,
          }
        },
        auto_save: data.auto_save || false
      };

      console.log('Saving annotation with v2 format:', JSON.stringify(v2Data, null, 2));

      // 调用v2保存接口
      const response = await this.saveAnnotationV2(v2Data);
      return {
        id: response.item_id,
        timestamp: response.timestamp
      };
    } catch (error: any) {
      console.error('Save annotation error:', error);
      if (error.response) {
        console.error('Error response:', error.response.data);
      }
      throw error;
    }
  }
}

export const annotationApi = new AnnotationApiService();