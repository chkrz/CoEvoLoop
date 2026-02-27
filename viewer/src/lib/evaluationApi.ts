/**
 * 评测中心 API 客户端
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

// ==================== 评测数据集 API ====================

export interface Benchmark {
  id: string;
  name: string;
  display_name: string;
  category: string;
  subcategory: string;
  description: string;
  num_samples: number;
  languages: string[];
  tasks: string[];
  opencompass_config: {
    dataset_key: string;
    model_type: string;
    metric: string;
    few_shot: number;
  };
  eval_params: {
    temperature: number;
    top_p: number;
    max_tokens: number;
    gpu_num: number;
  };
  enabled: boolean;
  created_at: string;
  updated_at: string;
  reference_scores: Record<string, number>;
}

export async function getBenchmarks(category?: string, enabledOnly?: boolean) {
  const params = new URLSearchParams();
  if (category) params.append('category', category);
  if (enabledOnly) params.append('enabled_only', 'true');
  
  const response = await fetch(`${API_BASE}/benchmarks/?${params}`);
  return response.json();
}

export async function getBenchmark(id: string) {
  const response = await fetch(`${API_BASE}/benchmarks/${id}/`);
  return response.json();
}

export async function createBenchmark(data: Partial<Benchmark>) {
  const response = await fetch(`${API_BASE}/benchmarks/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return response.json();
}

export async function updateBenchmark(id: string, data: Partial<Benchmark>) {
  const response = await fetch(`${API_BASE}/benchmarks/${id}/`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return response.json();
}

export async function deleteBenchmark(id: string) {
  const response = await fetch(`${API_BASE}/benchmarks/${id}/`, {
    method: 'DELETE',
  });
  return response.ok;
}

export async function toggleBenchmark(id: string) {
  const response = await fetch(`${API_BASE}/benchmarks/${id}/toggle/`, {
    method: 'POST',
  });
  return response.json();
}

export async function getBenchmarkCategories() {
  const response = await fetch(`${API_BASE}/benchmarks/categories/`);
  return response.json();
}

// ==================== 评测任务 API ====================

export interface EvalTask {
  task_id: string;  // 后端返回的是 task_id
  name: string;
  model_id: string;
  model_name?: string;
  model_snapshot: {
    name: string;
    version: string;
    ucloud_path: string;
  };
  benchmarks: Array<{
    benchmark_id: string;
    benchmark_name: string;
    status: string;
    result_id?: string;
  }>;
  status: string;
  progress: number;
  ucloud_job_id?: string;
  output_path?: string;
  created_by: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  duration: number;
  error?: string;
}

export async function getEvalTasks(params?: { status?: string; modelId?: string; search?: string }) {
  const urlParams = new URLSearchParams();
  if (params?.status) urlParams.append('status', params.status);
  if (params?.modelId) urlParams.append('model_id', params.modelId);
  if (params?.search) urlParams.append('search', params.search);
  
  const response = await fetch(`${API_BASE}/eval-tasks/?${urlParams}`);
  return response.json();
}

export async function getEvalTask(id: string) {
  const response = await fetch(`${API_BASE}/eval-tasks/${id}/`);
  return response.json();
}

export async function createEvalTask(data: Partial<EvalTask>) {
  const response = await fetch(`${API_BASE}/eval-tasks/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return response.json();
}

export async function updateEvalTask(id: string, data: Partial<EvalTask>) {
  const response = await fetch(`${API_BASE}/eval-tasks/${id}/`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return response.json();
}

export async function deleteEvalTask(id: string) {
  const response = await fetch(`${API_BASE}/eval-tasks/${id}/`, {
    method: 'DELETE',
  });
  return response.ok;
}

export async function startEvalTask(id: string) {
  const response = await fetch(`${API_BASE}/eval-tasks/${id}/start/`, {
    method: 'POST',
  });
  return response.json();
}

export async function stopEvalTask(id: string) {
  const response = await fetch(`${API_BASE}/eval-tasks/${id}/stop/`, {
    method: 'POST',
  });
  return response.json();
}

export async function getEvalTaskStats() {
  const response = await fetch(`${API_BASE}/eval-tasks/stats/`);
  return response.json();
}

// ==================== 评测结果 API ====================

export interface EvalResult {
  id: string;
  task_id: string;
  model_id: string;
  model_name: string;
  benchmark_id: string;
  benchmark_name: string;
  score: number;
  metric_name: string;
  detailed_metrics: Record<string, any>;
  outputs: {
    log_path?: string;
    result_json?: string;
    predictions?: string;
  };
  ucloud_job_id?: string;
  gpu_type: string;
  gpu_count: number;
  duration: number;
  created_at: string;
}

export async function getEvalResults(modelId?: string, benchmarkId?: string) {
  const params = new URLSearchParams();
  if (modelId) params.append('model_id', modelId);
  if (benchmarkId) params.append('benchmark_id', benchmarkId);
  
  const response = await fetch(`${API_BASE}/eval-results/?${params}`);
  return response.json();
}

export async function getEvalResult(id: string) {
  const response = await fetch(`${API_BASE}/eval-results/${id}/`);
  return response.json();
}

// ==================== Leaderboard API ====================

export async function getOverallLeaderboard() {
  const response = await fetch(`${API_BASE}/leaderboard/overall/`);
  return response.json();
}

export async function getBenchmarkLeaderboard(benchmarkId: string) {
  const response = await fetch(`${API_BASE}/leaderboard/benchmark/${benchmarkId}/`);
  return response.json();
}

// ==================== 临时模型 API (模拟模型中心) ====================

export interface Model {
  id: string;
  name: string;
  version: string;
  model_type: string;
  size: string;
  ucloud_path: string;
  organization: string;
  created_at: string;
}

// 临时模拟数据，未来从模型中心获取
export async function getModels(): Promise<{ models: Model[] }> {
  // 模拟一些测试模型
  return {
    models: [
      {
        id: 'model_qwen3_8b_v1',
        name: 'Qwen3-8B-Base',
        version: 'v1.0',
        model_type: 'base',
        size: '8B',
        ucloud_path: '/upfs/models/Qwen/Qwen3-8B-Base/',
        organization: 'Ant International',
        created_at: '2026-01-10T10:00:00Z',
      },
      {
        id: 'model_qwen3_14b_v1',
        name: 'Qwen3-14B-SFT',
        version: 'v2.3',
        model_type: 'instruct',
        size: '14B',
        ucloud_path: '/upfs/models/Qwen/Qwen3-14B-SFT/',
        organization: 'Ant International',
        created_at: '2026-01-15T10:00:00Z',
      },
    ],
  };
}

export async function getModel(id: string): Promise<Model | null> {
  const { models } = await getModels();
  return models.find(m => m.id === id) || null;
}
