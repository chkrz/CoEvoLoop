/**
 * RL Playground API 客户端
 * 
 * 支持功能:
 * 1. Overview - 整体统计概览
 * 2. Dimension Scores - 维度分数趋势分析
 * 3. Rollout Trends - 训练趋势分析
 * 4. Case Inspector - 单条数据查看
 * 5. Step Comparison - 跨 Step 对比
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

// ==================== Types ====================

export interface RLLogStats {
  total_batches: number;
  total_rollouts: number;
  steps_range: [number, number] | [];
  missing_fields?: Array<{ line: number; field: string }>;
}

export interface RLLog {
  id: string;
  name: string;
  description: string;
  file_size: number;
  stats: RLLogStats;
  batch_count?: number;
  created_at: string;
  updated_at: string;
  data?: any[];
}

export interface RLLogListResponse {
  logs: RLLog[];
  total: number;
}

export interface ParsedRollout {
  penalty: {
    response_length?: number;
    token_penalty?: number;
    user_login?: string;
    switch_human_count?: number;
    user_info?: Record<string, unknown>;
  };
  rag_knowledge: string;
  system_prompt: string;
  trajectory: Array<{
    role: string;
    content: string;
  }>;
  raw: string;
  user_info?: Record<string, unknown>;
}

export interface BatchStatistics {
  switch_human_counts: {
    "0": number;
    "1": number;
    "2": number;
  };
  token_penalty_count: number;
  mean_score: number;
  num_rollouts: number;
}

export interface BatchAnalysis {
  step: number;
  parsed_rollouts: ParsedRollout[];
  scores: number[];
  list_base_score_jsons: Record<string, number>[];
  avg_dimensions: Record<string, number>;
  user_profile: Record<string, string>;
  user_info?: Record<string, unknown>;
  statistics: BatchStatistics;
}

export interface LogAnalysis {
  log_id: string;
  total_batches: number;
  steps: number[];
  mean_scores: number[];
  token_penalty_counts: number[];
  switch_human_series: {
    "0": number[];
    "1": number[];
    "2": number[];
  };
  dimension_trends: Record<string, number[]>;
}

export interface ValidationResult {
  valid: boolean;
  error: string | null;
  stats: RLLogStats;
}

// New types for enhanced features
export interface LogOverview {
  log_id: string;
  log_name: string;
  // 核心统计
  total_cases: number;        // Case 数量（测试用例数）
  total_steps: number;        // Step 数量（训练步数）
  total_rollouts: number;     // Rollout 总数
  rollouts_per_batch: number; // 每 batch 的 rollout 数
  // 分数统计
  avg_score: number;
  min_score: number;
  max_score: number;
  total_token_penalties: number;
  // 趋势数据
  mean_scores: number[];
  // 兼容旧字段
  total_batches: number;
}

export interface DimensionTrends {
  log_id: string;
  total_batches: number;
  dimensions: string[];
  batch_dimension_scores: Array<{
    batch_index: number;
    step: number;
    dimensions: Record<string, number>;
  }>;
  dimension_series: Record<string, (number | null)[]>;
}

export interface SessionInfo {
  session_id: string;
  batch_indices: number[];
  num_occurrences: number;
  preview: string;
}

export interface StepComparison {
  log_id: string;
  total_batches: number;
  comparable_sessions: SessionInfo[];
  has_comparable_sessions: boolean;
}

export interface BatchCompareResult {
  batch_a: {
    index: number;
    step: number;
    statistics: BatchStatistics;
    avg_dimensions: Record<string, number>;
    parsed_rollouts: ParsedRollout[];
    scores: number[];
  };
  batch_b: {
    index: number;
    step: number;
    statistics: BatchStatistics;
    avg_dimensions: Record<string, number>;
    parsed_rollouts: ParsedRollout[];
    scores: number[];
  };
  delta: {
    score: number;
    token_penalty: number;
  };
}

// ==================== New Case-Based Types ====================

export interface CaseInfo {
  case_id: number;
  batch_indices: number[];
  num_steps: number;
  preview: string;
  user_info: Record<string, unknown>;
}

export interface StepComparisonV2 {
  log_id: string;
  total_batches: number;
  cases_per_step: number;
  total_cases: number;
  total_steps: number;
  steps: number[];
  cases: CaseInfo[];
  // Backward compatibility
  comparable_sessions?: SessionInfo[];
  has_comparable_sessions?: boolean;
}

export interface CaseTrendData {
  step: number;
  batch_index: number;
  avg_score: number;
  max_score: number;
  min_score: number;
  score_std: number;
  rollout_count: number;
  token_penalty_count: number;
}

export interface CaseTrend {
  log_id: string;
  case_id: number;
  cases_per_step: number;
  total_steps: number;
  trend_data: CaseTrendData[];
}

export interface CaseStepDetail {
  log_id: string;
  case_id: number;
  step: number;
  batch_index: number;
  rollout_count: number;
  avg_score: number;
  max_score: number;
  min_score: number;
  scores: number[];
  parsed_rollouts: ParsedRollout[];
  user_info: Record<string, unknown>;
}

export interface StepCompareResult {
  log_id: string;
  case_id: number;
  step_a: {
    step: number;
    batch_index: number;
    rollout_count: number;
    avg_score: number;
    max_score: number;
    min_score: number;
    scores: number[];
    parsed_rollouts: ParsedRollout[];
    statistics: BatchStatistics;
  };
  step_b: {
    step: number;
    batch_index: number;
    rollout_count: number;
    avg_score: number;
    max_score: number;
    min_score: number;
    scores: number[];
    parsed_rollouts: ParsedRollout[];
    statistics: BatchStatistics;
  };
  delta: {
    score: number;
    score_improved: boolean;
  };
}

// ==================== API Functions ====================

/**
 * 获取所有 RL 日志列表
 */
export async function getRLLogs(): Promise<RLLogListResponse> {
  const response = await fetch(`${API_BASE}/rl-logs/`);
  if (!response.ok) {
    throw new Error('Failed to fetch RL logs');
  }
  return response.json();
}

/**
 * 获取单个 RL 日志详情
 */
export async function getRLLog(logId: string): Promise<RLLog> {
  const response = await fetch(`${API_BASE}/rl-logs/${logId}/`);
  if (!response.ok) {
    throw new Error('Failed to fetch RL log');
  }
  return response.json();
}

/**
 * 上传新的 RL 日志文件
 */
export async function uploadRLLog(
  file: File,
  name: string,
  description: string
): Promise<{ message: string; log_id: string; stats: RLLogStats }> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('name', name);
  formData.append('description', description);
  
  const response = await fetch(`${API_BASE}/rl-logs/`, {
    method: 'POST',
    body: formData,
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || 'Failed to upload RL log');
  }
  
  return data;
}

/**
 * 删除 RL 日志
 */
export async function deleteRLLog(logId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/rl-logs/${logId}/`, {
    method: 'DELETE',
  });
  
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Failed to delete RL log');
  }
}

/**
 * 删除所有 RL 日志
 */
export async function deleteAllRLLogs(): Promise<{ message: string; deleted_count: number }> {
  const response = await fetch(`${API_BASE}/rl-logs/delete-all/`, {
    method: 'DELETE',
  });
  
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Failed to delete all RL logs');
  }
  
  return response.json();
}

/**
 * 获取存储使用情况
 */
export interface StorageInfo {
  total_logs: number;
  metadata_size: number;
  data_size: number;
  total_size: number;
  data_dir: string;
}

export async function getRLLogStorageInfo(): Promise<StorageInfo> {
  const response = await fetch(`${API_BASE}/rl-logs/storage-info/`);
  if (!response.ok) {
    throw new Error('Failed to fetch storage info');
  }
  return response.json();
}

/**
 * 获取指定 batch 的详细分析
 */
export async function getRLLogBatch(
  logId: string,
  batchIndex: number
): Promise<BatchAnalysis> {
  const response = await fetch(`${API_BASE}/rl-logs/${logId}/batch/${batchIndex}/`);
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Failed to fetch batch data');
  }
  return response.json();
}

/**
 * 获取整体分析数据（用于图表）
 */
export async function getRLLogAnalysis(logId: string): Promise<LogAnalysis> {
  const response = await fetch(`${API_BASE}/rl-logs/${logId}/analysis/`);
  if (!response.ok) {
    throw new Error('Failed to fetch log analysis');
  }
  return response.json();
}

/**
 * 获取概览数据（用于 Overview 页面）
 */
export async function getRLLogOverview(logId: string): Promise<LogOverview> {
  const response = await fetch(`${API_BASE}/rl-logs/${logId}/overview/`);
  if (!response.ok) {
    throw new Error('Failed to fetch log overview');
  }
  return response.json();
}

/**
 * 获取维度分数趋势（用于 Dimension Scores 页面）
 */
export async function getRLLogDimensionTrends(logId: string): Promise<DimensionTrends> {
  const response = await fetch(`${API_BASE}/rl-logs/${logId}/dimension-trends/`);
  if (!response.ok) {
    throw new Error('Failed to fetch dimension trends');
  }
  return response.json();
}

/**
 * 获取可对比的 Session 列表（用于 Step Comparison 页面）
 */
export async function getRLLogStepComparison(logId: string): Promise<StepComparison> {
  const response = await fetch(`${API_BASE}/rl-logs/${logId}/step-comparison/`);
  if (!response.ok) {
    throw new Error('Failed to fetch step comparison data');
  }
  return response.json();
}

/**
 * 对比两个 batch（用于 Step Comparison 详情）
 */
export async function compareRLLogBatches(
  logId: string,
  batchA: number,
  batchB: number
): Promise<BatchCompareResult> {
  const response = await fetch(`${API_BASE}/rl-logs/${logId}/compare/${batchA}/${batchB}/`);
  if (!response.ok) {
    throw new Error('Failed to compare batches');
  }
  return response.json();
}

/**
 * 验证日志文件格式（不保存）
 */
export async function validateRLLogFile(file: File): Promise<ValidationResult> {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await fetch(`${API_BASE}/rl-logs/validate/`, {
    method: 'POST',
    body: formData,
  });
  
  return response.json();
}

// ==================== Case-Based API Functions ====================

/**
 * 获取 Step Comparison 信息（V2: Case-Based）
 */
export async function getRLLogStepComparisonV2(logId: string): Promise<StepComparisonV2> {
  const response = await fetch(`${API_BASE}/rl-logs/${logId}/step-comparison/`);
  if (!response.ok) {
    throw new Error('Failed to fetch step comparison');
  }
  return response.json();
}

/**
 * 获取单个 Case 在所有 Step 的趋势数据
 */
export async function getRLLogCaseTrend(logId: string, caseId: number): Promise<CaseTrend> {
  const response = await fetch(`${API_BASE}/rl-logs/${logId}/case/${caseId}/trend/`);
  if (!response.ok) {
    throw new Error('Failed to fetch case trend');
  }
  return response.json();
}

/**
 * 获取指定 Case 在指定 Step 的详细数据
 */
export async function getRLLogCaseStepDetail(
  logId: string, 
  caseId: number, 
  step: number
): Promise<CaseStepDetail> {
  const response = await fetch(`${API_BASE}/rl-logs/${logId}/case/${caseId}/step/${step}/`);
  if (!response.ok) {
    throw new Error('Failed to fetch case step detail');
  }
  return response.json();
}

/**
 * 对比同一 Case 在两个不同 Step 的数据
 */
export async function compareRLLogSteps(
  logId: string,
  caseId: number,
  stepA: number,
  stepB: number
): Promise<StepCompareResult> {
  const response = await fetch(`${API_BASE}/rl-logs/${logId}/case/${caseId}/compare/${stepA}/${stepB}/`);
  if (!response.ok) {
    throw new Error('Failed to compare steps');
  }
  return response.json();
}

// ==================== Utility Functions ====================

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * 格式化时间
 */
export function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * 计算移动平均（用于图表平滑）
 */
export function movingAverage(data: number[], windowSize: number): number[] {
  if (windowSize <= 1) return data;
  
  const result: number[] = [];
  const halfWindow = Math.floor(windowSize / 2);
  
  for (let i = 0; i < data.length; i++) {
    const start = Math.max(0, i - halfWindow);
    const end = Math.min(data.length, i + halfWindow + 1);
    const window = data.slice(start, end);
    const avg = window.reduce((a, b) => a + b, 0) / window.length;
    result.push(avg);
  }
  
  return result;
}

// ==================== TensorBoard Types ====================

export interface TensorBoardStatus {
  log_id: string;
  has_tfevents: boolean;
  filename: string | null;
  file_size: number | null;
}

export interface TensorBoardTags {
  log_id: string;
  tags: string[];
  total: number;
}

export interface ScalarData {
  values: number[];
  steps: number[];
  wall_times: number[];
  count: number;
}

export interface TensorBoardScalars {
  log_id: string;
  scalars: Record<string, ScalarData>;
  requested_tags: string[];
  found_tags: string[];
}

// 核心指标定义
export const CORE_TB_METRICS = [
  'critic/rewards/mean',
  'critic/score/mean',
  'actor/ppo_kl',
  'actor/entropy',
  'actor/pg_clipfrac',
  'actor/lr'
] as const;

export const TB_METRIC_LABELS: Record<string, string> = {
  'critic/rewards/mean': 'Rewards Mean',
  'critic/score/mean': 'Score Mean',
  'actor/ppo_kl': 'PPO KL',
  'actor/entropy': 'Entropy',
  'actor/pg_clipfrac': 'PG Clip Fraction',
  'actor/lr': 'Learning Rate',
  // Actor 指标
  'actor/kl_loss': 'KL Loss',
  'actor/kl_coef': 'KL Coefficient',
  'actor/pg_loss': 'PG Loss',
  'actor/pg_clipfrac_lower': 'PG Clip Frac Lower',
  'actor/grad_norm': 'Gradient Norm',
  // Critic 指标
  'critic/score/max': 'Score Max',
  'critic/score/min': 'Score Min',
  'critic/rewards/max': 'Rewards Max',
  'critic/rewards/min': 'Rewards Min',
  'critic/advantages/mean': 'Advantages Mean',
  'critic/advantages/max': 'Advantages Max',
  'critic/advantages/min': 'Advantages Min',
  'critic/returns/mean': 'Returns Mean',
  'critic/returns/max': 'Returns Max',
  'critic/returns/min': 'Returns Min',
  // Response 指标
  'response_length/mean': 'Response Length Mean',
  'response_length/max': 'Response Length Max',
  'response_length/min': 'Response Length Min',
  'response_length/clip_ratio': 'Response Clip Ratio',
  'prompt_length/mean': 'Prompt Length Mean',
  'prompt_length/max': 'Prompt Length Max',
  'prompt_length/min': 'Prompt Length Min',
  'num_turns/mean': 'Num Turns Mean',
  'num_turns/max': 'Num Turns Max',
  'num_turns/min': 'Num Turns Min',
  // 性能指标
  'perf/mfu/actor': 'MFU Actor',
  'perf/max_memory_allocated_gb': 'Max Memory Allocated (GB)',
  'perf/max_memory_reserved_gb': 'Max Memory Reserved (GB)',
  'perf/cpu_memory_used_gb': 'CPU Memory Used (GB)',
  'perf/total_num_tokens': 'Total Tokens',
  'perf/time_per_step': 'Time per Step',
  'perf/throughput': 'Throughput',
  // 训练进度
  'training/global_step': 'Global Step',
  'training/epoch': 'Epoch',
};

// TensorBoard 指标分组
export const TB_METRIC_GROUPS = {
  actor: {
    label: 'Actor 指标',
    metrics: ['actor/entropy', 'actor/ppo_kl', 'actor/pg_loss', 'actor/kl_loss', 'actor/pg_clipfrac', 'actor/pg_clipfrac_lower', 'actor/grad_norm', 'actor/lr', 'actor/kl_coef']
  },
  critic: {
    label: 'Critic 指标',
    metrics: ['critic/rewards/mean', 'critic/rewards/max', 'critic/rewards/min', 'critic/score/mean', 'critic/score/max', 'critic/score/min', 'critic/advantages/mean', 'critic/returns/mean']
  },
  response: {
    label: 'Response 指标',
    metrics: ['response_length/mean', 'response_length/max', 'response_length/min', 'prompt_length/mean', 'num_turns/mean', 'num_turns/max']
  },
  performance: {
    label: '性能指标',
    metrics: ['perf/throughput', 'perf/time_per_step', 'perf/total_num_tokens', 'perf/mfu/actor', 'perf/max_memory_allocated_gb']
  },
  training: {
    label: '训练进度',
    metrics: ['training/global_step', 'training/epoch']
  }
} as const;

// ==================== TensorBoard API Functions ====================

/**
 * 上传 TensorBoard events 文件
 */
export async function uploadTensorBoardFile(
  logId: string,
  file: File
): Promise<{ message: string; filename: string; size: number }> {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await fetch(`${API_BASE}/rl-logs/${logId}/tfevents/`, {
    method: 'POST',
    body: formData,
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || 'Failed to upload TensorBoard file');
  }
  
  return data;
}

/**
 * 获取 TensorBoard 状态
 */
export async function getTensorBoardStatus(logId: string): Promise<TensorBoardStatus> {
  const response = await fetch(`${API_BASE}/rl-logs/${logId}/tensorboard/status/`);
  if (!response.ok) {
    throw new Error('Failed to fetch TensorBoard status');
  }
  return response.json();
}

/**
 * 获取 TensorBoard 可用的 tags
 */
export async function getTensorBoardTags(logId: string): Promise<TensorBoardTags> {
  const response = await fetch(`${API_BASE}/rl-logs/${logId}/tensorboard/tags/`);
  if (!response.ok) {
    throw new Error('Failed to fetch TensorBoard tags');
  }
  return response.json();
}

/**
 * 获取 TensorBoard scalar 数据
 * @param logId 日志 ID
 * @param tags 可选的 tags 列表，不指定则返回核心指标
 */
export async function getTensorBoardScalars(
  logId: string, 
  tags?: string[]
): Promise<TensorBoardScalars> {
  let url = `${API_BASE}/rl-logs/${logId}/tensorboard/scalars/`;
  if (tags && tags.length > 0) {
    url += `?tags=${encodeURIComponent(tags.join(','))}`;
  }
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch TensorBoard scalars');
  }
  return response.json();
}

/**
 * 删除 TensorBoard 文件
 */
export async function deleteTensorBoardFile(logId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/rl-logs/${logId}/tfevents/delete/`, {
    method: 'DELETE',
  });
  
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Failed to delete TensorBoard file');
  }
}
