"""
评测任务存储模块
"""
import json
import os
import uuid
from datetime import datetime
from typing import List, Dict, Optional

# 存储文件路径
STORAGE_FILE = os.path.join(os.path.dirname(__file__), 'eval_tasks.json')


def _load_tasks() -> Dict[str, Dict]:
    """加载所有评测任务"""
    if not os.path.exists(STORAGE_FILE):
        return {}
    
    with open(STORAGE_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)


def _save_tasks(tasks: Dict[str, Dict]):
    """保存评测任务到文件"""
    with open(STORAGE_FILE, 'w', encoding='utf-8') as f:
        json.dump(tasks, f, ensure_ascii=False, indent=2)


def _generate_task_id() -> str:
    """生成任务ID: eval_YYYYMMDD_<12位UUID>"""
    date_str = datetime.now().strftime('%Y%m%d')
    uuid_str = str(uuid.uuid4()).replace('-', '')[:12]
    return f"eval_{date_str}_{uuid_str}"


def list_tasks(status: Optional[str] = None, model_id: Optional[str] = None) -> List[Dict]:
    """获取评测任务列表"""
    tasks = _load_tasks()
    result = list(tasks.values())
    
    # 按状态过滤
    if status:
        result = [t for t in result if t.get('status') == status]
    
    # 按模型过滤
    if model_id:
        result = [t for t in result if t.get('model_id') == model_id]
    
    # 按创建时间倒序排序
    result.sort(key=lambda x: x.get('created_at', ''), reverse=True)
    
    return result


def get_task(task_id: str) -> Optional[Dict]:
    """获取单个评测任务"""
    tasks = _load_tasks()
    return tasks.get(task_id)


def create_task(data: Dict) -> Dict:
    """创建评测任务"""
    tasks = _load_tasks()
    
    task_id = _generate_task_id()
    now = datetime.now().isoformat()
    
    # 如果没有提供任务名称，生成默认名称（包含时间）
    if not data.get('name'):
        model_name = data.get('model_name', 'Unknown Model')
        time_str = datetime.now().strftime('%m月%d日 %H:%M')
        task_name = f"{model_name} 评测 - {time_str}"
    else:
        task_name = data.get('name')
    
    task = {
        'task_id': task_id,
        'name': task_name,
        'model_id': data['model_id'],
        'model_name': data.get('model_name', ''),
        'model_path': data.get('model_path', ''),
        'model_snapshot': data.get('model_snapshot', {}),
        'benchmarks': data.get('benchmarks', []),
        'eval_params': data.get('eval_params', {
            'gpu_num': 2,
            'model_type': 'base',
            'temperature': 0.6,
            'top_p': 0.95,
            'max_seq_len': 400000
        }),
        'status': 'PENDING',
        'progress': 0.0,
        'ucloud_job_id': None,  # UCloud 任务 ID
        'output_path': None,    # 评测结果输出路径
        'created_by': data.get('created_by', 'unknown'),
        'created_at': now,
        'started_at': None,
        'completed_at': None,
        'duration': 0,
        'error': None
    }
    
    tasks[task_id] = task
    _save_tasks(tasks)
    
    return task


def update_task(task_id: str, data: Dict) -> Optional[Dict]:
    """更新评测任务"""
    tasks = _load_tasks()
    
    if task_id not in tasks:
        return None
    
    task = tasks[task_id]
    
    # 更新允许的字段
    allowed_fields = ['name', 'status', 'progress', 'benchmarks', 'ucloud_job_id', 
                     'output_path', 'started_at', 'completed_at', 'duration', 'error']
    for field in allowed_fields:
        if field in data:
            task[field] = data[field]
    
    tasks[task_id] = task
    _save_tasks(tasks)
    
    return task


def delete_task(task_id: str) -> bool:
    """删除评测任务"""
    tasks = _load_tasks()
    
    if task_id not in tasks:
        return False
    
    del tasks[task_id]
    _save_tasks(tasks)
    
    return True


def update_benchmark_status(task_id: str, benchmark_id: str, status: str, result_id: Optional[str] = None) -> Optional[Dict]:
    """更新任务中某个数据集的状态"""
    tasks = _load_tasks()
    
    if task_id not in tasks:
        return None
    
    task = tasks[task_id]
    
    # 更新对应 benchmark 的状态
    for benchmark in task.get('benchmarks', []):
        if benchmark['benchmark_id'] == benchmark_id:
            benchmark['status'] = status
            if result_id:
                benchmark['result_id'] = result_id
            break
    
    # 重新计算整体进度
    total = len(task['benchmarks'])
    completed = sum(1 for b in task['benchmarks'] if b['status'] == 'COMPLETED')
    task['progress'] = completed / total if total > 0 else 0
    
    # 更新整体状态
    if completed == total:
        task['status'] = 'COMPLETED'
        task['completed_at'] = datetime.now().isoformat()
    elif any(b['status'] == 'RUNNING' for b in task['benchmarks']):
        task['status'] = 'RUNNING'
        if not task.get('started_at'):
            task['started_at'] = datetime.now().isoformat()
    elif any(b['status'] == 'FAILED' for b in task['benchmarks']):
        if completed > 0:
            task['status'] = 'PARTIAL_FAILED'
        else:
            task['status'] = 'FAILED'
    
    tasks[task_id] = task
    _save_tasks(tasks)
    
    return task


def add_ucloud_job(task_id: str, benchmark_id: str, job_id: str, queue_id: str) -> Optional[Dict]:
    """添加 UCloud 任务信息"""
    tasks = _load_tasks()
    
    if task_id not in tasks:
        return None
    
    task = tasks[task_id]
    
    job_info = {
        'benchmark_id': benchmark_id,
        'job_id': job_id,
        'queue_id': queue_id,
        'started_at': datetime.now().isoformat(),
        'completed_at': None
    }
    
    if 'ucloud_jobs' not in task:
        task['ucloud_jobs'] = []
    
    task['ucloud_jobs'].append(job_info)
    
    tasks[task_id] = task
    _save_tasks(tasks)
    
    return task


def get_stats() -> Dict:
    """获取任务统计信息"""
    tasks = _load_tasks()
    
    total = len(tasks)
    running = sum(1 for t in tasks.values() if t.get('status') == 'RUNNING')
    completed = sum(1 for t in tasks.values() if t.get('status') == 'COMPLETED')
    failed = sum(1 for t in tasks.values() if t.get('status') in ['FAILED', 'PARTIAL_FAILED'])
    
    return {
        'total': total,
        'running': running,
        'completed': completed,
        'failed': failed,
        'pending': total - running - completed - failed
    }
