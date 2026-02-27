import axios from 'axios';
import { getApiBaseUrl, getApiConfig } from './apiConfig';

const API_BASE_URL = getApiBaseUrl();

export interface AnnotationItem {
  id: string;
  dataset_id: string;
  data_type: 'PORTRAIT' | 'DIALOGUE' | 'EVALUATION' | 'HUMAN_HUMAN_DIALOGUE';
  original_content: any;
  edited_content?: any;
  tags: string[];
  notes: string;
  quality_rating?: number;
  intent?: object;
  roles?: object;
  custom_fields?: object;
  line_number: number;
  annotation_metadata?: {
    created_at?: string;
    last_updated?: string;
    version?: number;
    annotator_id?: string;
  };
}

export interface DatasetContent {
  dataset: {
    id: string;
    name: string;
    description: string;
    data_type: string;
    total_samples: number;
    file_path: string;
  };
  items: AnnotationItem[];
  pagination: {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
    has_next: boolean;
    has_previous: boolean;
  };
}

export interface AnnotationProgress {
  dataset_id: string;
  total_items: number;
  annotated_items: number;
  progress: number;
  quality_distribution: { [key: string]: number };
  tag_distribution: { [key: string]: number };
  last_update: string;
}

export interface AnnotationStatistics {
  assistant_model_score: number;
  turing_score: number;
  kappa_score: number;
  total_annotations: number;
  dataset_id?: string;
  message?: string;
  category_distribution?: Record<string, any>;
  accuracy_distribution?: Record<string, number>;
  quality_distribution?: Record<string, number>;
  progress?: number;
  tag_distribution?: { [key: string]: number };
  last_update?: string;
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
}

export class AnnotationApiV2Service {
  // 获取数据集内容用于标注
  async getDatasetContent(
    datasetId: string,
    page: number = 1,
    pageSize: number = 20
  ): Promise<DatasetContent> {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/v2/datasets/${datasetId}/content/`,
        {
          params: { page, page_size: pageSize }
        }
      );
      return response.data;
    } catch (error) {
      console.error('Failed to fetch dataset content:', error);
      throw new Error('获取数据集内容失败');
    }
  }

  // 保存标注数据
  async saveAnnotation(data: {
    dataset_id: string;
    item_id: string;
    annotation_data: {
      edited_content?: any;
      tags: string[];
      notes: string;
      quality_rating?: number;
      intent?: object;
      roles?: object;
      custom_fields?: object;
    };
    auto_save?: boolean;
  }): Promise<{ success: boolean; message: string; item_id: string; timestamp: string; copy_path?: string }> {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/v2/annotations/save/`,
        data
      );
      return response.data;
    } catch (error) {
      console.error('Failed to save annotation:', error);
      throw new Error('保存标注失败');
    }
  }

  // 导出标注数据集（简化版）
  async exportAnnotatedDataset(data: {
    source_dataset_id: string;
    new_dataset_name: string;
    new_dataset_description?: string;
    data_filter?: 'ALL' | 'ANNOTATED';  // 数据筛选：所有数据或已标注数据
  }): Promise<{
    id: string;
    name: string;
    data_type: string;
    source: string;
    source_dataset_id: string;
    item_count: number;
    file_count: number;
    size_bytes: number;
    created_at: string;
    message: string;
  }> {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/v2/datasets/export/`,
        data
      );
      return response.data;
    } catch (error) {
      console.error('Failed to export dataset:', error);
      throw new Error('导出数据集失败');
    }
  }

  // 获取标注进度
  async getAnnotationProgress(datasetId: string): Promise<AnnotationProgress> {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/v2/progress/${datasetId}/`
      );
      return response.data;
    } catch (error) {
      console.error('Failed to fetch annotation progress:', error);
      // 返回默认进度
      return {
        dataset_id: datasetId,
        total_items: 0,
        annotated_items: 0,
        progress: 0,
        quality_distribution: {},
        tag_distribution: {},
        last_update: new Date().toISOString()
      };
    }
  }

  // 获取已标注的数据集列表
  async getAnnotatedDatasets(): Promise<{
    datasets: AnnotatedDatasetInfo[];
    count: number;
  }> {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/v2/annotated-datasets/`
      );
      return response.data;
    } catch (error) {
      console.error('Failed to fetch annotated datasets:', error);
      return {
        datasets: [],
        count: 0
      };
    }
  }

  // 批量保存标注
  async batchSaveAnnotations(annotations: Array<{
    dataset_id: string;
    item_id: string;
    annotation_data: AnnotationItem['annotation_data'];
    auto_save?: boolean;
  }>): Promise<Array<{ success: boolean; item_id: string; error?: string }>> {
    const results = [];
    for (const annotation of annotations) {
      try {
        const result = await this.saveAnnotation(annotation);
        results.push({ success: true, item_id: annotation.item_id });
      } catch (error) {
        results.push({
          success: false,
          item_id: annotation.item_id,
          error: error instanceof Error ? error.message : '未知错误'
        });
      }
    }
    return results;
  }

  // 获取标注统计信息
  async getAnnotationStatistics(datasetId?: string): Promise<AnnotationStatistics> {
    try {
      const params = datasetId ? { dataset_id: datasetId } : {};
      const response = await axios.get(
        `${API_BASE_URL}/annotations/statistics/`,
        { params }
      );
      return response.data;
    } catch (error) {
      console.error('Failed to get annotation statistics:', error);
      throw new Error('获取标注统计信息失败');
    }
  }

  // 获取详细标注统计信息
  async getDetailedAnnotationStatistics(datasetId?: string): Promise<AnnotationStatistics> {
    try {
      const params = datasetId ? { dataset_id: datasetId } : {};
      const response = await axios.get(
        `${API_BASE_URL}/annotations/statistics/detailed/`,
        { params }
      );
      return response.data;
    } catch (error) {
      console.error('Failed to get detailed annotation statistics:', error);
      throw new Error('获取详细标注统计信息失败');
    }
  }

  // 获取数据集基本信息
  async getDatasetInfo(datasetId: string): Promise<{
    id: string;
    name: string;
    description: string;
    data_type: string;
    total_samples: number;
    file_path: string;
    created_at: string;
    updated_at: string;
  }> {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/datasets/${datasetId}/`
      );
      const data = response.data;
      return {
        id: data.id,
        name: data.name,
        description: data.description || '',
        data_type: data.data_type,
        total_samples: data.sample_count || 0,
        file_path: data.file_path || '',
        created_at: data.created_at || new Date().toISOString(),
        updated_at: data.updated_at || new Date().toISOString(),
      };
    } catch (error) {
      console.error('Failed to fetch dataset info:', error);
      throw new Error('获取数据集信息失败');
    }
  }

  // 获取所有标注建议标签
  getSuggestedTags(dataType: string): string[] {
    const tagSuggestions: { [key: string]: string[] } = {
      PORTRAIT: ['信息完整', '描述清晰', '需要补充', '知识盲区明确', '历史全面'],
      DIALOGUE: ['流程顺畅', '解决用户问题', '回复专业', '响应及时', '需要改进'],
      EVALUATION: ['评分准确', '评价客观', '建议中肯', '维度全面', '标准统一'],
      HUMAN_HUMAN_DIALOGUE: ['协作良好', '交接顺畅', '效率较高', '沟通清晰', '优化空间']
    };
    return tagSuggestions[dataType] || [];
  }

  // 批量标记标注完成状态
  async batchMarkComplete(data: {
    dataset_id: string;
    item_ids?: string[];
    mark_as_annotated: boolean;
  }): Promise<{
    success: boolean;
    message: string;
    updated_count: number;
    mark_as_annotated: boolean;
    timestamp: string;
  }> {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/v2/annotations/batch-complete/`,
        data
      );
      return response.data;
    } catch (error) {
      console.error('Failed to batch mark complete:', error);
      throw new Error('批量标记完成状态失败');
    }
  }

  // 单个标记标注完成状态
  async markComplete(data: {
    dataset_id: string;
    item_id: string;
    mark_as_annotated: boolean;
  }): Promise<{
    success: boolean;
    message: string;
    item_id: string;
    mark_as_annotated: boolean;
    timestamp: string;
  }> {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/v2/annotations/mark-complete/`,
        data
      );
      return response.data;
    } catch (error) {
      console.error('Failed to mark complete:', error);
      throw new Error('标记完成状态失败');
    }
  }

  // 撤销标注完成状态
  async unmarkComplete(data: {
    dataset_id: string;
    item_id: string;
  }): Promise<{
    success: boolean;
    message: string;
    item_id: string;
    mark_as_annotated: boolean;
    timestamp: string;
  }> {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/v2/annotations/unmark-complete/`,
        data
      );
      return response.data;
    } catch (error) {
      console.error('Failed to unmark complete:', error);
      throw new Error('撤销标注完成状态失败');
    }
  }

  // 获取角色标注选项
  getRoleOptions(dataType: string): { role: string; options: string[] }[] {
    const roleOptions: { [key: string]: { role: string; options: string[] }[] } = {
      PORTRAIT: [
        { role: 'background_quality', options: ['优秀', '良好', '一般', '不足', '缺失'] },
        { role: 'knowledge_gap_clarity', options: ['非常清晰', '清晰', '一般', '模糊', '极模糊'] },
        { role: 'operation_history_completeness', options: ['完整', '较完整', '一般', '不完整', '缺失'] }
      ],
      DIALOGUE: [
        { role: 'user_behavior', options: ['明确', '配合', '模糊', '不满', '反复'] },
        { role: 'assistant_performance', options: ['优秀', '良好', '合格', '不佳', '很差'] },
        { role: 'dialogue_flow', options: ['顺畅', '较顺畅', '一般', '混乱', '中断'] }
      ],
      EVALUATION: [
        { role: 'evaluation_fairness', options: ['非常公平', '公平', '一般', '不公平', '严重不公'] },
        { role: 'scoring_accuracy', options: ['精确', '较准确', '一般', '有偏差', '严重偏差'] },
        { role: 'feedback_quality', options: ['高质量', '较好', '一般', '较少', '无用'] }
      ],
      HUMAN_HUMAN_DIALOGUE: [
        { role: 'collaboration_quality', options: ['优秀', '良好', '一般', '较差', '很差'] },
        { role: 'coordination_effectiveness', options: ['高效', '较有效', '一般', '低效', '无效'] },
        { role: 'handover_smoothness', options: ['无缝', '顺畅', '一般', '生硬', '冲突'] }
      ]
    };
    return roleOptions[dataType] || [];
  }

  // 获取意图标注选项
  getIntentOptions(dataType: string): { field: string; options: string[] }[] {
    const intentOptions: { [key: string]: { field: string; options: string[] }[] } = {
      PORTRAIT: [
        { field: 'profile_purpose', options: ['客户服务', '风险评估', '个性推荐', '其他'] },
        { field: 'confidence_level', options: ['高', '中', '低', '未知'] }
      ],
      DIALOGUE: [
        { field: 'conversation_purpose', options: ['咨询', '投诉', '办理业务', '反馈建议', '其他'] },
        { field: 'resolution_status', options: ['已解决', '部分解决', '未解决', '转移处理'] }
      ],
      EVALUATION: [
        { field: 'evaluation_purpose', options: ['质量评估', '模型对比', '性能优化', '其他'] },
        { field: 'improvement_suggestion', options: ['急需改进', '建议优化', '可保持', '优秀'] }
      ],
      HUMAN_HUMAN_DIALOGUE: [
        { field: 'collaboration_purpose', options: ['问题解决', '信息共享', '任务分工', '培训指导'] },
        { field: 'success_criterion', options: ['问题解决', '效率提升', '客户满意', '知识传递'] }
      ]
    };
    return intentOptions[dataType] || [];
  }
}

export const annotationApiV2 = new AnnotationApiV2Service();