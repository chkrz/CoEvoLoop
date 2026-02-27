"""
数据合成任务存储管理
"""
import os
import json
import uuid
import threading
from datetime import datetime
from typing import Dict, List, Optional
import logging
logger = logging.getLogger(__name__)


class SynthesisStorage:
    """数据合成任务存储（JSON文件存储 - MVP版本）"""
    
    def __init__(self, storage_path: str = None):
        if storage_path is None:
            current_dir = os.path.dirname(__file__)
            storage_path = os.path.join(current_dir, "synthesis_tasks.json")
        
        self.storage_path = storage_path
        self._lock = threading.Lock()  # 添加线程锁
        self._ensure_file_exists()
    
    def _ensure_file_exists(self):
        """确保存储文件存在"""
        if not os.path.exists(self.storage_path):
            self._write_data({"tasks": []})
    
    def _read_data_unlocked(self) -> Dict:
        """读取数据（不加锁，用于内部调用）"""
        with open(self.storage_path, 'r', encoding='utf-8') as f:
            logger.info(self.storage_path)
            return json.load(f)
    
    def _write_data_unlocked(self, data: Dict):
        """写入数据（不加锁，用于内部调用）"""
        with open(self.storage_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    
    def _read_data(self) -> Dict:
        """读取数据"""
        with self._lock:
            return self._read_data_unlocked()
    
    def _write_data(self, data: Dict):
        """写入数据"""
        with self._lock:
            self._write_data_unlocked(data)
    
    def generate_id(self) -> str:
        """生成唯一ID"""
        date_str = datetime.now().strftime("%Y%m%d")
        short_uuid = uuid.uuid4().hex[:12]
        return f"syn_{date_str}_{short_uuid}"
    
    def create_task(self, task_data: Dict) -> Dict:
        """
        创建合成任务
        
        Args:
            task_data: 任务信息
        
        Returns:
            创建的任务（包含生成的 ID）
        """
        with self._lock:
            data = self._read_data_unlocked()
            tasks = data.get("tasks", [])
            
            # 生成任务
            task_type = task_data.get("type", "DIALOGUE")
            if task_type == "DISTILLATION":
                task_type = "DIALOGUE"

            task = {
                "id": self.generate_id(),
                "name": task_data.get("name"),
                "type": task_type,  # DIALOGUE | PORTRAIT | EVALUATION
                "status": "PENDING",  # PENDING | RUNNING | COMPLETED | FAILED | CANCELLED
                "config": task_data.get("config", {}),
                "progress": {
                    "total": task_data.get("total", 0),
                    "completed": 0,
                    "failed": 0,
                    "success_rate": 0.0
                },
                "output_dataset_id": None,
                "error_message": None,
                "created_by": task_data.get("created_by", "system"),
                "created_at": datetime.now().isoformat(),
                "started_at": None,
                "completed_at": None,
            }
            
            tasks.append(task)
            data["tasks"] = tasks
            self._write_data_unlocked(data)
            
            return task
    
    def get_task(self, task_id: str) -> Optional[Dict]:
        """获取单个任务"""
        data = self._read_data()
        tasks = data.get("tasks", [])
        
        for task in tasks:
            if task.get("id") == task_id:
                if task.get("type") == "DISTILLATION":
                    task["type"] = "DIALOGUE"
                return task
        
        return None
    
    def list_tasks(
        self,
        type_filter: Optional[str] = None,
        status_filter: Optional[str] = None,
        search: Optional[str] = None
    ) -> List[Dict]:
        """
        获取任务列表
        
        Args:
            type_filter: 类型筛选
            status_filter: 状态筛选
            search: 搜索关键词
        """
        data = self._read_data()
        tasks = data.get("tasks", [])
        
        # 应用筛选
        # 归一化历史类型
        for task in tasks:
            if task.get("type") == "DISTILLATION":
                task["type"] = "DIALOGUE"

        if type_filter:
            tasks = [t for t in tasks if t.get("type") == type_filter]
        
        if status_filter:
            tasks = [t for t in tasks if t.get("status") == status_filter]
        
        if search:
            search_lower = search.lower()
            tasks = [
                t for t in tasks
                if search_lower in t.get("name", "").lower()
            ]
        
        # 按创建时间倒序
        tasks.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        
        return tasks
    
    def update_task(self, task_id: str, update_data: Dict) -> Optional[Dict]:
        """
        更新任务
        
        Args:
            task_id: 任务 ID
            update_data: 更新的数据
        
        Returns:
            更新后的任务，如果不存在返回 None
        """
        with self._lock:
            data = self._read_data_unlocked()
            tasks = data.get("tasks", [])
            
            for i, task in enumerate(tasks):
                if task.get("id") == task_id:
                    # 更新字段
                    updatable_fields = [
                        "status", "progress", "output_dataset_id", 
                        "error_message", "started_at", "completed_at",
                        "evaluation_stats"
                    ]
                    
                    for field in updatable_fields:
                        if field in update_data:
                            task[field] = update_data[field]

                    if "config" in update_data:
                        existing_config = task.get("config", {}) or {}
                        new_config = update_data.get("config", {}) or {}
                        task["config"] = {
                            **existing_config,
                            **new_config
                        }
                    
                    tasks[i] = task
                    data["tasks"] = tasks
                    self._write_data_unlocked(data)
                    
                    return task
            
            return None
    
    def delete_task(self, task_id: str) -> bool:
        """
        删除任务
        
        Args:
            task_id: 任务 ID
        
        Returns:
            是否删除成功
        """
        with self._lock:
            data = self._read_data_unlocked()
            tasks = data.get("tasks", [])
            
            original_count = len(tasks)
            tasks = [t for t in tasks if t.get("id") != task_id]
            
            if len(tasks) < original_count:
                data["tasks"] = tasks
                self._write_data_unlocked(data)
                return True
            
            return False
    
    def get_stats(self) -> Dict:
        """获取统计信息"""
        data = self._read_data()
        tasks = data.get("tasks", [])
        
        stats = {
            "total": len(tasks),
            "by_type": {
                "DIALOGUE": 0,
                "PORTRAIT": 0,
                "EVALUATION": 0
            },
            "by_status": {
                "PENDING": 0,
                "RUNNING": 0,
                "COMPLETED": 0,
                "FAILED": 0,
                "CANCELLED": 0
            }
        }
        
        for task in tasks:
            task_type = task.get("type", "DIALOGUE")
            if task_type == "DISTILLATION":
                task_type = "DIALOGUE"
            task_status = task.get("status", "PENDING")
            
            if task_type in stats["by_type"]:
                stats["by_type"][task_type] += 1
            
            if task_status in stats["by_status"]:
                stats["by_status"][task_status] += 1
        
        return stats
