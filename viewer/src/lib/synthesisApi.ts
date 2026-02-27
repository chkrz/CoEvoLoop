/**
 * 数据合成任务 API 服务
 */

export interface SynthesisTask {
  id: string;
  name: string;
  type: 'DIALOGUE' | 'PORTRAIT' | 'EVALUATION';
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  config: {
    // 数据源配置
    source_type?: 'task' | 'upload';
    source_portrait_task_id?: string;  // 画像任务ID（对话合成用）
    source_dialogue_task_id?: string;  // 对话任务ID（质量评估用）
    uploaded_portraits?: string;  // 上传的 JSON 内容
    uploaded_dialogues?: string;  // 画像抽取任务上传的对话内容
    uploaded_evaluation_dialogues?: string;  // 质量评估任务上传的对话内容
    
    // 数据蒸馏配置
    model_url?: string;
    batch_size?: number;
    max_samples?: number;
    
    // 对话合成配置
    user_simulator?: {
      model: string;
      model_url?: string;
    };
    assistant_model?: {
      model: string;
      model_url?: string;
    };
    num_dialogues?: number;
    temperature?: number;
    max_turns?: number;
    prompt_version?: string;
    with_rag?: boolean;
    with_sop?: boolean;
  };
  progress: {
    total: number;
    completed: number;
    failed: number;
    success_rate: number;
  };
  // 质量评估统计（仅EVALUATION类型任务）
  evaluation_stats?: {
    total_evaluated: number;    // 总评估数
    passed_count: number;       // 通过数
    pass_rate: number;          // 通过率（百分比）
  };
  output_dataset_id?: string;
  error_message?: string;
  created_by: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

export interface SynthesisTaskListResponse {
  tasks: SynthesisTask[];
  count: number;
}

export interface SynthesisTaskStats {
  total: number;
  by_type: {
    DIALOGUE: number;
    PORTRAIT: number;
    EVALUATION: number;
  };
  by_status: {
    PENDING: number;
    RUNNING: number;
    COMPLETED: number;
    FAILED: number;
    CANCELLED: number;
  };
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/synthesis/tasks';

/**
 * 获取任务列表
 */
export async function getSynthesisTasks(params?: {
  type?: string;
  status?: string;
  search?: string;
}): Promise<SynthesisTaskListResponse> {
  const searchParams = new URLSearchParams();
  
  if (params?.type) searchParams.append('type', params.type);
  if (params?.status) searchParams.append('status', params.status);
  if (params?.search) searchParams.append('search', params.search);
  
  const url = `${API_BASE_URL}/?${searchParams.toString()}`;
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error('获取任务列表失败');
  }
  
  return response.json();
}

/**
 * 获取任务详情
 */
export async function getSynthesisTask(id: string): Promise<SynthesisTask> {
  const response = await fetch(`${API_BASE_URL}/${id}/`);
  
  if (!response.ok) {
    throw new Error('获取任务详情失败');
  }
  
  return response.json();
}

/**
 * 创建任务
 */
export async function createSynthesisTask(data: Partial<SynthesisTask>): Promise<SynthesisTask> {
  const response = await fetch(`${API_BASE_URL}/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || '创建任务失败');
  }
  
  return response.json();
}

/**
 * 更新任务
 */
export async function updateSynthesisTask(
  id: string,
  data: Partial<SynthesisTask>
): Promise<SynthesisTask> {
  const response = await fetch(`${API_BASE_URL}/${id}/`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || '更新任务失败');
  }
  
  return response.json();
}

/**
 * 删除任务
 */
export async function deleteSynthesisTask(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/${id}/`, {
    method: 'DELETE',
  });
  
  if (!response.ok) {
    throw new Error('删除任务失败');
  }
}

/**
 * 启动任务
 */
export async function startSynthesisTask(id: string): Promise<{ message: string; task_id: string; status: string }> {
  const response = await fetch(`${API_BASE_URL}/${id}/start/`, {
    method: 'POST',
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || '启动任务失败');
  }
  
  return response.json();
}

/**
 * 取消任务
 */
export async function cancelSynthesisTask(id: string): Promise<{ message: string; task_id: string; status: string }> {
  const response = await fetch(`${API_BASE_URL}/${id}/cancel/`, {
    method: 'POST',
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || '取消任务失败');
  }
  
  return response.json();
}

/**
 * 获取统计信息
 */
export async function getSynthesisTaskStats(): Promise<SynthesisTaskStats> {
  const response = await fetch(`${API_BASE_URL}/stats/`);
  
  if (!response.ok) {
    throw new Error('获取统计信息失败');
  }
  
  return response.json();
}

/**
 * 获取成功的画像抽取任务列表
 */
export interface PortraitTask {
  id: string;
  name: string;
  created_at: string;
  completed_at?: string;
  progress: {
    total: number;
    completed: number;
    failed: number;
    success_rate: number;
  };
}

export async function getPortraitTasks(): Promise<{
  tasks: PortraitTask[];
  count: number;
}> {
  const response = await fetch('/api/synthesis/portraits/');
  
  if (!response.ok) {
    throw new Error('获取画像任务列表失败');
  }
  
  return response.json();
}

/**
 * 获取成功的对话合成任务列表
 */
export interface DialogueTask {
  id: string;
  name: string;
  created_at: string;
  completed_at?: string;
  progress: {
    total: number;
    completed: number;
    failed: number;
    success_rate: number;
  };
}

export async function getDialogueTasks(): Promise<{
  tasks: DialogueTask[];
  count: number;
}> {
  const response = await fetch('/api/synthesis/dialogues/');
  
  if (!response.ok) {
    throw new Error('获取对话任务列表失败');
  }
  
  return response.json();
}

/**
 * 预览任务生成的对话数据
 */
export async function previewSynthesisTask(id: string, limit: number = 10): Promise<{
  task_id: string;
  total_previewed: number;
  dialogues: any[];
}> {
  const response = await fetch(`${API_BASE_URL}/${id}/preview/?limit=${limit}`);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || '预览失败');
  }
  
  return response.json();
}

/**
 * 下载任务生成的对话数据
 */
export async function downloadSynthesisTask(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/${id}/download/`);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || '下载失败');
  }
  
  // 处理文件下载
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;

  const disposition = response.headers.get('Content-Disposition');
  const filenameMatch = disposition?.match(/filename="?([^";]+)"?/i);
  a.download = filenameMatch?.[1] || `synthesis_${id}.jsonl`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}
