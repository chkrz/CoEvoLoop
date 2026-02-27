"""
RL Log Storage - 管理 RL 训练日志数据
使用分离存储策略：
- 元数据存储在 rl_logs.json
- 实际数据存储在单独的 .jsonl 文件中（按 log_id 命名）
"""

import json
import os
import uuid
import shutil
from datetime import datetime
from typing import Dict, List, Optional, Any
from pathlib import Path


class RLLogStorage:
    """RL 训练日志存储管理器（分离存储版本）"""
    
    def __init__(self, storage_path: str = None):
        """
        初始化存储管理器
        
        Args:
            storage_path: JSON 存储文件路径，默认为 backend/storage/rl_logs.json
        """
        if storage_path is None:
            base_dir = Path(__file__).resolve().parent
            storage_path = base_dir / "rl_logs.json"
        
        self.storage_path = Path(storage_path)
        self.data_dir = self.storage_path.parent / "rl_log_data"
        self._ensure_storage_exists()
        # 尝试迁移旧格式数据
        self._migrate_old_format()
    
    def _ensure_storage_exists(self):
        """确保存储文件和目录存在"""
        if not self.storage_path.exists():
            self._save_metadata({"logs": {}})
        # 确保数据目录存在
        self.data_dir.mkdir(exist_ok=True)
    
    def _load_metadata(self) -> Dict:
        """加载元数据（不含实际日志数据）"""
        try:
            with open(self.storage_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                # 兼容旧格式：如果 logs 中包含 data 字段，需要迁移
                return data
        except (json.JSONDecodeError, FileNotFoundError):
            return {"logs": {}}
    
    def _save_metadata(self, data: Dict):
        """保存元数据到存储"""
        with open(self.storage_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    
    def _get_data_file_path(self, log_id: str) -> Path:
        """获取日志数据文件路径"""
        return self.data_dir / f"{log_id}.json"
    
    def _save_log_data(self, log_id: str, data: List[Dict]):
        """保存日志数据到单独文件"""
        data_path = self._get_data_file_path(log_id)
        with open(data_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False)
    
    def _load_log_data(self, log_id: str) -> Optional[List[Dict]]:
        """从单独文件加载日志数据"""
        data_path = self._get_data_file_path(log_id)
        if data_path.exists():
            try:
                with open(data_path, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except (json.JSONDecodeError, FileNotFoundError):
                return None
        return None
    
    def _delete_log_data(self, log_id: str) -> bool:
        """删除日志数据文件"""
        data_path = self._get_data_file_path(log_id)
        if data_path.exists():
            data_path.unlink()
            return True
        return False
    
    def _generate_id(self) -> str:
        """生成唯一 ID"""
        timestamp = datetime.now().strftime("%Y%m%d")
        unique_id = uuid.uuid4().hex[:12]
        return f"rl_{timestamp}_{unique_id}"
    
    def _migrate_old_format(self):
        """迁移旧格式数据（data 内嵌在元数据中）到新格式"""
        metadata = self._load_metadata()
        migrated = False
        
        for log_id, log in list(metadata["logs"].items()):
            if "data" in log and log["data"]:
                # 保存数据到单独文件
                self._save_log_data(log_id, log["data"])
                # 更新元数据中的 batch_count
                metadata["logs"][log_id]["batch_count"] = len(log["data"])
                # 删除元数据中的 data
                del metadata["logs"][log_id]["data"]
                migrated = True
        
        if migrated:
            self._save_metadata(metadata)
    
    def create_log(
        self,
        name: str,
        description: str,
        data: List[Dict],
        file_size: int,
        stats: Dict
    ) -> str:
        """
        创建新的 RL 日志记录
        
        Args:
            name: 日志名称
            description: 描述
            data: 日志数据（解析后的 JSONL 内容）
            file_size: 原始文件大小
            stats: 统计信息
        
        Returns:
            新创建的日志 ID
        """
        metadata = self._load_metadata()
        log_id = self._generate_id()
        
        # 保存数据到单独文件
        self._save_log_data(log_id, data)
        
        # 元数据中不包含 data，只包含 batch_count
        metadata["logs"][log_id] = {
            "id": log_id,
            "name": name,
            "description": description,
            "batch_count": len(data),
            "file_size": file_size,
            "stats": stats,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }
        
        self._save_metadata(metadata)
        return log_id
    
    def get_log(self, log_id: str, include_data: bool = True) -> Optional[Dict]:
        """
        获取指定 ID 的日志
        
        Args:
            log_id: 日志 ID
            include_data: 是否包含完整数据
        
        Returns:
            日志数据，不存在返回 None
        """
        metadata = self._load_metadata()
        log_meta = metadata["logs"].get(log_id)
        
        if not log_meta:
            return None
        
        result = dict(log_meta)
        
        if include_data:
            # 从单独文件加载数据
            data = self._load_log_data(log_id)
            if data is not None:
                result["data"] = data
            else:
                # 兼容旧格式
                result["data"] = log_meta.get("data", [])
        
        return result
    
    def list_logs(self, include_data: bool = False) -> List[Dict]:
        """
        获取所有日志列表
        
        Args:
            include_data: 是否包含完整数据（默认不包含以提高性能）
        
        Returns:
            日志列表（按创建时间降序排列）
        """
        metadata = self._load_metadata()
        logs = []
        
        for log_id, log in metadata["logs"].items():
            log_info = {
                "id": log["id"],
                "name": log["name"],
                "description": log.get("description", ""),
                "file_size": log.get("file_size", 0),
                "stats": log.get("stats", {}),
                "batch_count": log.get("batch_count", 0),
                "created_at": log["created_at"],
                "updated_at": log.get("updated_at", log["created_at"])
            }
            
            if include_data:
                data = self._load_log_data(log_id)
                log_info["data"] = data if data else log.get("data", [])
            
            logs.append(log_info)
        
        # 按创建时间降序排列
        logs.sort(key=lambda x: x["created_at"], reverse=True)
        return logs
    
    def update_log(self, log_id: str, updates: Dict) -> bool:
        """
        更新日志信息
        
        Args:
            log_id: 日志 ID
            updates: 要更新的字段
        
        Returns:
            是否更新成功
        """
        metadata = self._load_metadata()
        
        if log_id not in metadata["logs"]:
            return False
        
        # 允许更新的字段
        allowed_fields = {"name", "description"}
        for field, value in updates.items():
            if field in allowed_fields:
                metadata["logs"][log_id][field] = value
        
        metadata["logs"][log_id]["updated_at"] = datetime.now().isoformat()
        self._save_metadata(metadata)
        return True
    
    def delete_log(self, log_id: str) -> bool:
        """
        删除指定日志
        
        Args:
            log_id: 日志 ID
        
        Returns:
            是否删除成功
        """
        metadata = self._load_metadata()
        
        if log_id not in metadata["logs"]:
            return False
        
        # 删除数据文件
        self._delete_log_data(log_id)
        
        # 删除日志专属目录（包含 tfevents 文件）
        log_dir = self._get_log_dir(log_id)
        if log_dir.exists() and log_dir.is_dir():
            shutil.rmtree(log_dir)
        
        # 删除元数据
        del metadata["logs"][log_id]
        self._save_metadata(metadata)
        return True
    
    def delete_all_logs(self) -> int:
        """
        删除所有日志
        
        Returns:
            删除的日志数量
        """
        metadata = self._load_metadata()
        count = len(metadata["logs"])
        
        # 删除所有数据文件和日志目录
        for log_id in list(metadata["logs"].keys()):
            # 删除数据文件
            self._delete_log_data(log_id)
            
            # 删除日志专属目录（包含 tfevents 文件）
            log_dir = self._get_log_dir(log_id)
            if log_dir.exists() and log_dir.is_dir():
                shutil.rmtree(log_dir)
        
        # 清空元数据
        metadata["logs"] = {}
        self._save_metadata(metadata)
        
        return count
    
    def get_log_data(self, log_id: str) -> Optional[List[Dict]]:
        """
        获取日志的完整数据
        
        Args:
            log_id: 日志 ID
        
        Returns:
            日志数据列表
        """
        # 首先尝试从单独文件加载
        data = self._load_log_data(log_id)
        if data is not None:
            return data
        
        # 兼容旧格式
        log = self.get_log(log_id, include_data=False)
        if log:
            metadata = self._load_metadata()
            return metadata["logs"].get(log_id, {}).get("data", [])
        return None
    
    def get_batch(self, log_id: str, batch_index: int) -> Optional[Dict]:
        """
        获取指定 batch 的数据
        
        Args:
            log_id: 日志 ID
            batch_index: batch 索引
        
        Returns:
            batch 数据
        """
        data = self.get_log_data(log_id)
        if data and 0 <= batch_index < len(data):
            return data[batch_index]
        return None
    
    # ==================== TensorBoard 文件支持 ====================
    
    def _get_log_dir(self, log_id: str) -> Path:
        """获取日志专属目录路径"""
        return self.data_dir / log_id
    
    def save_tfevents_file(self, log_id: str, file_content: bytes, filename: str) -> bool:
        """
        保存 TensorBoard events 文件
        
        Args:
            log_id: 日志 ID
            file_content: 文件内容
            filename: 原始文件名
        
        Returns:
            是否保存成功
        """
        log_dir = self._get_log_dir(log_id)
        log_dir.mkdir(parents=True, exist_ok=True)
        
        # 保存文件直接到日志目录（让 TensorBoard 能正确识别）
        file_path = log_dir / filename
        with open(file_path, 'wb') as f:
            f.write(file_content)
        
        # 更新元数据
        metadata = self._load_metadata()
        if log_id in metadata["logs"]:
            metadata["logs"][log_id]["has_tfevents"] = True
            metadata["logs"][log_id]["tfevents_filename"] = filename
            metadata["logs"][log_id]["updated_at"] = datetime.now().isoformat()
            self._save_metadata(metadata)
        
        return True
    
    def get_tfevents_path(self, log_id: str) -> Optional[Path]:
        """
        获取 TensorBoard events 文件路径
        
        Args:
            log_id: 日志 ID
        
        Returns:
            文件路径，不存在返回 None
        """
        log_dir = self._get_log_dir(log_id)
        if not log_dir.exists():
            return None
        
        # 查找 events 文件（直接在日志目录下）
        for f in log_dir.iterdir():
            if f.is_file() and 'tfevents' in f.name:
                return f
        
        # 兼容旧结构：检查 tfevents 子目录
        old_tfevents_dir = log_dir / "tfevents"
        if old_tfevents_dir.exists():
            for f in old_tfevents_dir.iterdir():
                if f.is_file() and 'tfevents' in f.name:
                    return f
        
        return None
    
    def has_tfevents(self, log_id: str) -> bool:
        """检查日志是否有 TensorBoard 数据"""
        return self.get_tfevents_path(log_id) is not None
    
    def delete_tfevents(self, log_id: str) -> bool:
        """删除 TensorBoard 文件"""
        log_dir = self._get_log_dir(log_id)
        deleted = False
        
        if log_dir.exists():
            # 删除日志目录下的 tfevents 文件
            for f in log_dir.iterdir():
                if f.is_file() and 'tfevents' in f.name:
                    f.unlink()
                    deleted = True
            
            # 兼容旧结构：删除 tfevents 子目录
            old_tfevents_dir = log_dir / "tfevents"
            if old_tfevents_dir.exists():
                shutil.rmtree(old_tfevents_dir)
                deleted = True
        
        if deleted:
            # 更新元数据
            metadata = self._load_metadata()
            if log_id in metadata["logs"]:
                metadata["logs"][log_id]["has_tfevents"] = False
                metadata["logs"][log_id].pop("tfevents_filename", None)
                self._save_metadata(metadata)
        
        return deleted
    
    def get_storage_info(self) -> Dict:
        """
        获取存储使用情况
        
        Returns:
            存储信息
        """
        metadata = self._load_metadata()
        total_logs = len(metadata["logs"])
        
        # 计算数据目录大小
        data_size = 0
        if self.data_dir.exists():
            for f in self.data_dir.iterdir():
                if f.is_file():
                    data_size += f.stat().st_size
        
        # 元数据文件大小
        meta_size = self.storage_path.stat().st_size if self.storage_path.exists() else 0
        
        return {
            "total_logs": total_logs,
            "metadata_size": meta_size,
            "data_size": data_size,
            "total_size": meta_size + data_size,
            "data_dir": str(self.data_dir)
        }


# 全局单例
rl_log_storage = RLLogStorage()
