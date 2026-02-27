import axios from 'axios';

// 使用Flask测试服务器在8001端口，Django生产服务器在8000端口
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

export interface ConversationAnnotation {
  id: string;
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
  is_annotated: boolean;
  annotation_time?: string;
  annotated_by?: string;
  created_at: string;
  updated_at: string;
}

export interface ConversationListItem {
  id: string;
  dataset_id: string;
  conversation_id: string;
  sample_index: number;
  preview: string;
  is_annotated: boolean;
  quality_score?: number;
  accuracy?: 'correct' | 'partial' | 'incorrect';
  category?: string;
  tags?: string[];
  notes?: string;
  updated_at?: string;
  original_data: any;
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

export interface AnnotatedDatasetInfo {
  dataset_id: string;
  dataset_name: string;
  copy_path: string;
  created_at?: string;
  last_updated?: string;
  item_count: number;
  progress: number;
  data_type: string;
  annotated_items: number;
  total_items: number;
  progress_percentage: number;
  total_count: number;
  annotated_count: number;
}

class AnnotationApiFileBasedService {
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
      const response = await axios.get(`${API_BASE_URL}/conversations/list/`, {
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
      console.error('Failed to fetch conversations:', error);
      // 如果API不存在，返回模拟数据
      return {
        conversations: [],
        pagination: {
          page,
          page_size: pageSize,
          total: 0,
          total_pages: 0,
          has_next: false,
          has_previous: false
        }
      };
    }
  }

  // 获取单个对话详情
  async getConversation(datasetId: string, sampleIndex: number): Promise<ConversationAnnotation> {
    try {
      const response = await axios.get(`${API_BASE_URL}/conversations/get/`, {
        params: {
          dataset_id: datasetId,
          sample_index: sampleIndex
        }
      });

      return response.data;
    } catch (error) {
      console.error('Failed to fetch conversation:', error);
      // 返回模拟数据
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
        edited_data: null,
        quality_score: undefined,
        accuracy: undefined,
        category: undefined,
        tags: [],
        notes: '',
        is_annotated: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }
  }

  // 保存标注数据
  async saveAnnotation(data: {
    id?: string;
    dataset_id: string;
    conversation_id: string;
    sample_index: number;
    original_data?: any;
    edited_data?: any;
    quality_score?: number;
    accuracy?: 'correct' | 'partial' | 'incorrect';
    category?: string;
    tags?: string[];
    notes?: string;
    annotated_by?: string;
    annotation_time?: string;
    is_annotated?: boolean;
    created_at?: string;
  }): Promise<ConversationAnnotation> {
    try {
      const response = await axios.post(`${API_BASE_URL}/annotations/save/`, data);
      return response.data;
    } catch (error) {
      console.error('Failed to save annotation:', error);
      throw error;
    }
  }

  // 更新标注信息
  async updateAnnotation(id: string, data: Partial<ConversationAnnotation>): Promise<any> {
    return this.saveAnnotation({
      dataset_id: data.dataset_id || '',
      conversation_id: data.conversation_id || '',
      sample_index: data.sample_index || 0,
      ...data
    } as any);
  }

  // 使用v2接口保存标注数据（保持兼容性）
  async saveAnnotationV2(data: {
    dataset_id: string;
    item_id: string;
    annotation_data: any;
    auto_save?: boolean;
  }) {
    try {
      // 将v2格式转换为v1格式
      const [conversationId, sampleIndexStr] = data.item_id.split('_').slice(-2);
      const sampleIndex = parseInt(sampleIndexStr);

      const v1Data = {
        dataset_id: data.dataset_id,
        conversation_id: conversationId,
        sample_index: sampleIndex,
        edited_content: data.annotation_data.edited_content,
        quality_score: data.annotation_data.quality_rating,
        accuracy: data.annotation_data.custom_fields?.accuracy,
        category: data.annotation_data.custom_fields?.category,
        tags: data.annotation_data.tags,
        notes: data.annotation_data.notes,
        annotated_by: data.annotation_data.custom_fields?.annotated_by,
        annotation_time: data.annotation_data.custom_fields?.annotation_time,
        is_annotated: true
      };

      const response = await this.saveAnnotation(v1Data);
      return {
        item_id: response.id,
        timestamp: response.updated_at
      };
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
    return this.saveAnnotation(data as any);
  }

  // 获取或创建标注记录
  async getOrCreateAnnotation(datasetId: string, conversationId: string, sampleIndex: number) {
    try {
      // 首先尝试获取现有记录
      const response = await axios.get(`${API_BASE_URL}/conversations/get/`, {
        params: {
          dataset_id: datasetId,
          sample_index: sampleIndex
        }
      });

      return response.data;
    } catch (error) {
      // 如果获取失败，创建新记录
      console.log('Annotation not found, creating new one');
      const newData = {
        dataset_id: datasetId,
        conversation_id: conversationId,
        sample_index: sampleIndex,
        original_data: {},
        edited_data: null,
        quality_score: undefined,
        accuracy: undefined,
        category: undefined,
        tags: [],
        notes: '',
        is_annotated: false,
        annotated_by: '',
      };

      return this.createAnnotation(newData);
    }
  }

  // 获取标注统计
  async getStats(datasetId?: string): Promise<AnnotationStats> {
    try {
      const params = datasetId ? { dataset_id: datasetId } : {};
      const response = await axios.get(`${API_BASE_URL}/annotations/stats/`, { params });
      return response.data;
    } catch (error) {
      console.warn('Stats API not available, returning default stats');
      return {
        total: 0,
        annotated: 0,
        pending: 0,
        quality_distribution: {},
        accuracy_distribution: {}
      };
    }
  }

  // 批次管理
  async getBatches(): Promise<AnnotationBatch[]> {
    // 文件存储版本暂不支持批次管理
    return [];
  }

  async createBatch(batch: Omit<AnnotationBatch, 'id' | 'created_at'>): Promise<AnnotationBatch> {
    // 文件存储版本暂不支持批次管理
    throw new Error('Batches are not supported in file-based storage');
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
      const response = await axios.post(`${API_BASE_URL}/annotations/relations/save/`, relation);
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
      }

      const response = await axios.get(`${API_BASE_URL}/annotations/filter/`, { params });
      return response.data;
    } catch (error) {
      console.warn('Filter API not available, returning empty array');
      return [];
    }
  }

  // 从标注数据创建新数据集
  async createDatasetFromAnnotations(data: {
    name: string;
    description?: string;
    source_dataset_id: string;
    annotation_ids?: string[];
  }): Promise<any> {
    try {
      const response = await axios.post(`${API_BASE_URL}/datasets/from-annotations/`, data);
      return response.data;
    } catch (error) {
      console.error('Failed to create dataset from annotations:', error);
      throw error;
    }
  }

  // 添加缺失的方法以保持兼容性
  async getAnnotatedDatasets(): Promise<{
    datasets: AnnotatedDatasetInfo[];
    count: number;
  }> {
    try {
      const response = await axios.get(`${API_BASE_URL}/annotated-datasets/`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch annotated datasets:', error);
      return {
        datasets: [],
        count: 0
      };
    }
  }

  // 添加 v2 兼容的方法
  async getDatasetContent(
    datasetId: string,
    page: number = 1,
    pageSize: number = 20
  ): Promise<any> {
    try {
      // 这个方法主要用于 v2，v1 通过 getConversations 获取数据
      const response = await this.getConversations(datasetId, page, pageSize);
      return {
        dataset: {
          id: datasetId,
          name: `Dataset ${datasetId}`,
          description: '',
          data_type: 'DIALOGUE',
          total_samples: response.pagination.total,
          file_path: ''
        },
        items: response.conversations.map(conv => ({
          id: conv.id,
          dataset_id: conv.dataset_id,
          data_type: 'DIALOGUE',
          original_content: conv.original_data,
          edited_content: conv.edited_data,
          tags: conv.tags || [],
          notes: conv.notes || '',
          quality_rating: conv.quality_score,
          intent: {},
          roles: {},
          custom_fields: {
            accuracy: conv.accuracy,
            category: conv.category
          },
          line_number: conv.sample_index + 1,
          annotation_metadata: {
            created_at: conv.created_at,
            last_updated: conv.updated_at,
            version: 1
          }
        })),
        pagination: response.pagination
      };
    } catch (error) {
      console.error('Failed to get dataset content:', error);
      throw new Error('获取数据集内容失败');
    }
  }

  async getAnnotationProgress(datasetId: string): Promise<{
    dataset_id: string;
    total_items: number;
    annotated_items: number;
    progress: number;
  }> {
    try {
      const stats = await this.getStats(datasetId);
      return {
        dataset_id: datasetId,
        total_items: stats.total,
        annotated_items: stats.annotated,
        progress: stats.total > 0 ? Math.round((stats.annotated / stats.total) * 100) : 0
      };
    } catch (error) {
      console.error('Failed to get annotation progress:', error);
      return {
        dataset_id: datasetId,
        total_items: 0,
        annotated_items: 0,
        progress: 0
      };
    }
  }

  async exportAnnotatedDataset(data: {
    source_dataset_id: string;
    new_dataset_name: string;
    new_dataset_description?: string;
    data_filter?: 'ALL' | 'ANNOTATED';
  }): Promise<any> {
    try {
      const response = await this.createDatasetFromAnnotations({
        name: data.new_dataset_name,
        description: data.new_dataset_description,
        source_dataset_id: data.source_dataset_id,
        data_filter: data.data_filter || 'ALL'
      });
      return {
        id: response.id,
        name: response.name,
        ...response
      };
    } catch (error) {
      console.error('Failed to export dataset:', error);
      throw error;
    }
  }

  // 获取所有正在进行标注的数据集（有标注记录的数据集）
  async getInProgressAnnotations(): Promise<AnnotatedDatasetInfo[]> {
    try {
      const response = await axios.get(`${API_BASE_URL}/annotations/in-progress/`);
      return response.data.datasets || [];
    } catch (error) {
      console.warn('In-progress annotations API not available, returning empty array');
      return [];
    }
  }
}

export const annotationApiFileBased = new AnnotationApiFileBasedService();