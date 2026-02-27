"""
评测任务状态轮询器
后台线程定期检查 UCloud 任务状态并更新本地记录
"""
import threading
import time
import logging
from typing import Dict, List
from datetime import datetime

import storage.eval_task_storage as eval_task_storage
import storage.eval_result_storage as eval_result_storage
from storage.ucloud_client import ucloud_client

logger = logging.getLogger(__name__)


class EvalTaskPoller:
    """评测任务状态轮询器"""
    
    def __init__(self, interval: int = 30):
        """
        Args:
            interval: 轮询间隔（秒），默认 30 秒
        """
        self.interval = interval
        self.running = False
        self.thread = None
    
    def start(self):
        """启动轮询线程"""
        if self.running:
            logger.warning("Poller already running")
            return
        
        self.running = True
        self.thread = threading.Thread(target=self._poll_loop, daemon=True)
        self.thread.start()
        logger.info(f"Eval task poller started with interval {self.interval}s")
    
    def stop(self):
        """停止轮询线程"""
        self.running = False
        if self.thread:
            self.thread.join(timeout=5)
        logger.info("Eval task poller stopped")
    
    def _poll_loop(self):
        """轮询循环"""
        while self.running:
            try:
                self._poll_once()
            except Exception as e:
                logger.error(f"Error in poll loop: {e}", exc_info=True)
            
            # 等待下一次轮询
            time.sleep(self.interval)
    
    def _poll_once(self):
        """执行一次轮询"""
        # 获取所有非最终态的任务（运行中、待运行、挂起和初始化中）
        # 最终态（COMPLETED/FAILED/CANCELLED）不再轮询
        tasks = eval_task_storage.list_tasks(status='RUNNING')
        tasks.extend(eval_task_storage.list_tasks(status='PENDING'))
        tasks.extend(eval_task_storage.list_tasks(status='SUSPENDED'))
        tasks.extend(eval_task_storage.list_tasks(status='INITIALIZING'))
        
        if not tasks:
            return
        
        logger.info(f"Polling {len(tasks)} active tasks (non-final states)")
        
        for task in tasks:
            task_id = task['task_id']
            ucloud_job_id = task.get('ucloud_job_id')
            
            if not ucloud_job_id:
                logger.warning(f"Task {task_id} has no ucloud_job_id, skipping")
                continue
            
            try:
                # 查询 UCloud 任务状态
                logger.info(f"Polling UCloud job: {ucloud_job_id} for task {task_id}")
                result = ucloud_client.get_job_status(ucloud_job_id)
                
                # 打印完整的 UCloud 返回结果
                logger.info(f"UCloud response for job {ucloud_job_id}:")
                logger.info(f"  Success: {result.get('success')}")
                logger.info(f"  UCloud State: {result.get('state')}")
                logger.info(f"  Mapped Status: {result.get('status')}")
                logger.info(f"  Job ID: {result.get('job_id')}")
                if result.get('raw_data'):
                    raw = result['raw_data']
                    logger.info(f"  Priority: {raw.get('Priority')}")
                    logger.info(f"  GPU Count: {raw.get('GpuCountPerNode')}")
                    logger.info(f"  Job Name: {raw.get('Name')}")
                    logger.info(f"  Message: {raw.get('Message', 'N/A')}")
                
                if not result['success']:
                    logger.error(f"Failed to get status for job {ucloud_job_id}: {result.get('error')}")
                    # API 调用失败，可能是网络问题，跳过此次更新
                    continue
                
                new_status = result['status']
                old_status = task['status']
                
                logger.info(f"Task {task_id}: old_status={old_status}, new_status={new_status}")
                
                # 如果状态有变化，更新任务
                if new_status != old_status:
                    logger.info(f"✅ Task {task_id} status changed: {old_status} -> {new_status}")
                    
                    update_data = {
                        'status': new_status,
                    }
                    
                    # 如果任务完成，获取结果
                    if new_status == 'COMPLETED':
                        logger.info(f"🎉 Task {task_id} completed, fetching results")
                        self._handle_task_completed(task)
                    elif new_status == 'FAILED':
                        error_msg = result.get('raw_data', {}).get('Message', 'Job failed')
                        update_data['error'] = error_msg
                        logger.warning(f"❌ Task {task_id} failed: {error_msg}")
                    elif new_status == 'CANCELLED':
                        update_data['error'] = 'Job was cancelled manually'
                        logger.info(f"🚫 Task {task_id} was cancelled")
                    
                    eval_task_storage.update_task(task_id, update_data)
                    
                    # 到达最终态，后续轮询将自动跳过
                    if new_status in ['COMPLETED', 'FAILED', 'CANCELLED']:
                        logger.info(f"📌 Task {task_id} reached final state, will no longer be polled")
                else:
                    logger.info(f"⏸️  Task {task_id} status unchanged: {old_status}")
                    
            except Exception as e:
                logger.error(f"Error polling task {task_id}: {e}", exc_info=True)
    
    def _handle_task_completed(self, task: Dict):
        """
        处理任务完成
        获取评测结果并存储
        """
        task_id = task['task_id']
        output_path = task.get('output_path')
        
        if not output_path:
            logger.warning(f"Task {task_id} has no output_path")
            return
        
        try:
            # 从 US3 获取评测结果
            eval_results = ucloud_client.get_eval_results(output_path)
            
            if eval_results:
                # 存储评测结果
                result_data = {
                    'task_id': task_id,
                    'model_id': task['model_id'],
                    'model_name': task['model_name'],
                    'benchmarks': eval_results,
                    'overall_score': self._calculate_overall_score(eval_results),
                    'completed_at': datetime.now().isoformat()
                }
                
                eval_result_storage.create_result(result_data)
                logger.info(f"Saved eval results for task {task_id}")
                
                # 更新任务的各个 benchmark 状态
                for benchmark in task['benchmarks']:
                    benchmark_id = benchmark['benchmark_id']
                    if benchmark_id in eval_results:
                        eval_task_storage.update_benchmark_status(
                            task_id,
                            benchmark_id,
                            'COMPLETED',
                            eval_results[benchmark_id]
                        )
            else:
                logger.warning(f"No eval results found for task {task_id}")
                
        except Exception as e:
            logger.error(f"Error handling completed task {task_id}: {e}", exc_info=True)
    
    def _calculate_overall_score(self, benchmarks: Dict) -> float:
        """计算总体分数（平均值）"""
        scores = []
        for benchmark_data in benchmarks.values():
            if isinstance(benchmark_data, dict) and 'score' in benchmark_data:
                scores.append(benchmark_data['score'])
            elif isinstance(benchmark_data, (int, float)):
                scores.append(benchmark_data)
        
        return sum(scores) / len(scores) if scores else 0.0


# 全局轮询器实例
_poller_instance = None


def get_poller() -> EvalTaskPoller:
    """获取全局轮询器实例"""
    global _poller_instance
    if _poller_instance is None:
        _poller_instance = EvalTaskPoller(interval=30)
    return _poller_instance


def start_poller():
    """启动轮询器"""
    poller = get_poller()
    poller.start()


def stop_poller():
    """停止轮询器"""
    poller = get_poller()
    poller.stop()
