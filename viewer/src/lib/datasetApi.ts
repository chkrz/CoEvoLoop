export type DatasetType = "PORTRAIT" | "DIALOGUE" | "EVALUATION" | "HUMAN_HUMAN_DIALOGUE";
export type DatasetSource = "TASK" | "UPLOAD" | "ANNOTATION" | "ANNOTATION_V2";

export interface EvaluationStats {
	total_evaluated: number;
	passed_count: number;
	pass_rate: number;
}

export interface DatasetRecord {
	id: string;
	name: string;
	data_type: DatasetType;
	source: DatasetSource;
	source_task_id?: string;
	file_path: string;
	file_name: string;
	file_format: "json" | "jsonl" | string;
	size_bytes?: number;
	item_count?: number;
	evaluation_stats?: EvaluationStats;
	kappa_score?: number;
	turing_score?: number;
	created_at: string;
	updated_at?: string;
}

export interface DatasetListResponse {
	datasets: DatasetRecord[];
	count: number;
}

export interface DatasetPreviewResponse {
	dataset_id: string;
	format?: string;
	items: any[];
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/datasets';

export async function listDatasets(params?: {
	type?: DatasetType;
	source?: DatasetSource;
	search?: string;
}): Promise<DatasetListResponse> {
	const searchParams = new URLSearchParams();
	if (params?.type) searchParams.append("type", params.type);
	if (params?.source) searchParams.append("source", params.source);
	if (params?.search) searchParams.append("search", params.search);

	const url = `${API_BASE_URL}/?${searchParams.toString()}`;
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error("获取数据集列表失败");
	}
	return response.json();
}

export async function getDataset(datasetId: string): Promise<DatasetRecord> {
	const response = await fetch(`${API_BASE_URL}/${datasetId}/`);
	if (!response.ok) {
		throw new Error("获取数据集详情失败");
	}
	return response.json();
}

export async function getDatasetPreview(datasetId: string, limit: number = 10): Promise<DatasetPreviewResponse> {
	const response = await fetch(`${API_BASE_URL}/${datasetId}/preview/?limit=${limit}`);
	if (!response.ok) {
		throw new Error("获取预览数据失败");
	}
	return response.json();
}

export async function uploadDataset(payload: {
	file: File;
	dataType: DatasetType;
	name?: string;
}): Promise<DatasetRecord> {
	const formData = new FormData();
	formData.append("file", payload.file);
	formData.append("data_type", payload.dataType);
	if (payload.name) {
		formData.append("name", payload.name);
	}

	const response = await fetch(`${API_BASE_URL}/upload/`, {
		method: "POST",
		body: formData,
	});

	if (!response.ok) {
		const error = await response.json().catch(() => ({}));
		throw new Error(error.error || "上传失败");
	}

	return response.json();
}

export async function deleteDataset(datasetId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/${datasetId}/delete/`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "删除失败");
  }
}

// 从标注数据创建新数据集
export async function createDatasetFromAnnotations(payload: {
  name: string;
  annotation_ids?: string[];  // 选中的标注ID列表（可选）
  source_dataset_id: string; // 源数据集ID
  description?: string;
  data_selection?: 'ALL' | 'ANNOTATED'; // 数据选择策略（简化版）
}): Promise<DatasetRecord> {
  const response = await fetch(`${API_BASE_URL}/from_annotations/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "从标注创建数据集失败");
  }

  return response.json();
}

// 获取数据集的关联关系（显示数据流转历史）
export async function getDatasetRelations(datasetId: string): Promise<{
  source_datasets: DatasetRecord[];
  derived_datasets: DatasetRecord[];
  annotation_batches: any[];
}> {
  try {
    const response = await fetch(`${API_BASE_URL}/${datasetId}/relations/`);
    if (!response.ok) {
      // 如果API不存在，返回空数据而不是报错
      if (response.status === 404) {
        return {
          source_datasets: [],
          derived_datasets: [],
          annotation_batches: []
        };
      }
      throw new Error("获取数据集关联关系失败");
    }
    return response.json();
  } catch (error) {
    // 网络错误或其他错误，返回空数据
    console.warn('Relations API not available, returning empty data');
    return {
      source_datasets: [],
      derived_datasets: [],
      annotation_batches: []
    };
  }
}

// 对比两个数据集（获取差异数据）
export async function compareDatasets(datasetId: string, otherDatasetId: string): Promise<{
  original: DatasetRecord;
  annotated: DatasetRecord;
  differences: Array<{
    sample_index: number;
    original_item: any;
    annotated_item: any;
    differences: string[];
    quality_score?: number;
    accuracy?: string;
    category?: string;
  }>;
  summary: {
    total_items: number;
    modified_items: number;
    added_items: number;
    removed_items: number;
    quality_improvements: number;
    accuracy_distribution: { [key: string]: number };
    category_changes: { [key: string]: { from: string; to: string; count: number } };
  };
}> {
  try {
    const response = await fetch(`${API_BASE_URL}/${datasetId}/compare/${otherDatasetId}/`);
    if (!response.ok) {
      throw new Error("对比数据集失败");
    }
    return response.json();
  } catch (error) {
    console.warn('Comparison API not available, using mock data');
    // 如果API不存在，返回模拟数据
    const mockComparisonData = {
      original: {} as DatasetRecord,
      annotated: {} as DatasetRecord,
      differences: [],
      summary: {
        total_items: 100,
        modified_items: 45,
        added_items: 0,
        removed_items: 0,
        quality_improvements: 38,
        accuracy_distribution: {
          'correct': 58,
          'partial': 27,
          'incorrect': 15
        },
        category_changes: {}
      }
    };
    return mockComparisonData;
  }
}

export function getDatasetDownloadUrl(datasetId: string): string {
	return `${API_BASE_URL}/${datasetId}/download/`;
}

// 获取标注数据对比结果
export async function getAnnotationComparison(datasetId: string): Promise<any[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/${datasetId}/annotation_comparison/`);
    if (!response.ok) {
      if (response.status === 404) {
        console.warn('Annotation comparison API not available, using mock data');
        return generateMockComparisonData(datasetId);
      }
      throw new Error("获取标注对比数据失败");
    }
    const data = await response.json();
    return data.comparisons || [];
  } catch (error) {
    console.warn('Annotation comparison API error, using mock data:', error);
    return generateMockComparisonData(datasetId);
  }
}

// 生成模拟对比数据
function generateMockComparisonData(datasetId: string): any[] {
  const mockData = [];
  for (let i = 0; i < 20; i++) {
    const hasChanges = Math.random() > 0.5;
    mockData.push({
      id: `comparison_${i}`,
      original_data: {
        id: `item_${i}`,
        content: `这是第${i + 1}条原始数据内容`,
        category: Math.random() > 0.5 ? 'A类' : 'B类',
        score: Math.floor(Math.random() * 100),
        metadata: {
          created_at: new Date().toISOString(),
          source: 'original'
        }
      },
      annotated_data: hasChanges ? {
        id: `item_${i}`,
        content: `这是第${i + 1}条标注后的数据内容${Math.random() > 0.5 ? '（已修改）' : ''}`,
        category: Math.random() > 0.7 ? 'C类' : (Math.random() > 0.5 ? 'A类' : 'B类'),
        score: Math.floor(Math.random() * 100),
        metadata: {
          created_at: new Date().toISOString(),
          source: 'annotated',
          annotation_notes: '人工标注修正'
        }
      } : {
        id: `item_${i}`,
        content: `这是第${i + 1}条原始数据内容`,
        category: Math.random() > 0.5 ? 'A类' : 'B类',
        score: Math.floor(Math.random() * 100),
        metadata: {
          created_at: new Date().toISOString(),
          source: 'annotated'
        }
      },
      has_changes: hasChanges,
      change_type: hasChanges ? (Math.random() > 0.5 ? 'modified' : 'added') : 'none',
      changes: hasChanges ? [
        {
          type: Math.random() > 0.5 ? 'modified' : 'added',
          field: 'content',
          old_value: '原始内容',
          new_value: '标注后的内容'
        },
        ...(Math.random() > 0.5 ? [{
          type: 'modified',
          field: 'category',
          old_value: 'A类',
          new_value: 'C类'
        }] : [])
      ] : []
    });
  }
  return mockData;
}

// 创建默认导出对象，包含所有函数
const datasetApi = {
	listDatasets,
	getDataset,
	getDatasetPreview,
	uploadDataset,
	deleteDataset,
	createDatasetFromAnnotations,
	getDatasetRelations,
	getDatasetDownloadUrl,
	compareDatasets,
	getAnnotationComparison,
};

export { datasetApi };
export default datasetApi;
