import json
import os
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any

class AnnotationMetadataManager:
    """标注元信息管理器"""
    
    def __init__(self, storage_dir: str):
        """初始化元信息管理器
        
        Args:
            storage_dir: 存储目录路径
        """
        self.storage_dir = Path(storage_dir)
        self.metadata_file = self.storage_dir / "copies_metadata.json"
        self._ensure_metadata_file()
    
    def _ensure_metadata_file(self):
        """确保元信息文件存在，如果不存在则创建"""
        if not self.metadata_file.exists():
            self.metadata_file.parent.mkdir(parents=True, exist_ok=True)
            self._write_metadata({"version": "2.0", "datasets": {}})
    
    def _read_metadata(self) -> Dict[str, Any]:
        """读取元信息
        
        Returns:
            元信息字典
        """
        try:
            with open(self.metadata_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (FileNotFoundError, json.JSONDecodeError) as e:
            # 如果文件损坏，创建新的元信息文件
            print(f"读取元信息文件失败: {e}，创建新的元信息文件")
            self._write_metadata({"version": "2.0", "datasets": {}})
            return {"version": "2.0", "datasets": {}}
    
    def _write_metadata(self, metadata: Dict[str, Any]):
        """写入元信息
        
        Args:
            metadata: 要写入的元信息字典
        """
        with open(self.metadata_file, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, ensure_ascii=False, indent=2)
    
    def register_dataset(self, dataset_id: str, item_count: int, **kwargs):
        """注册新的标注数据集
        
        Args:
            dataset_id: 数据集ID
            item_count: 数据项总数
            **kwargs: 其他可选参数
        """
        metadata = self._read_metadata()
        
        if "datasets" not in metadata:
            metadata["datasets"] = {}
        
        # 检查数据集是否已存在
        if dataset_id in metadata["datasets"]:
            print(f"数据集 {dataset_id} 已存在，更新元信息")
            existing_data = metadata["datasets"][dataset_id]
        else:
            existing_data = {}
        
        metadata["datasets"][dataset_id] = {
            "annotation_id_format": "ann_{dataset_id}_{timestamp}_{uuid}_{sequence}",
            "created_at": datetime.now().isoformat(),
            "last_annotation_at": None,
            "total_items": item_count,
            "annotated_items": 0,
            "annotation_progress": 0.0,
            "statistics": {
                "total_annotations": 0,
                "quality_distribution": {},
                "tag_distribution": {},
                "annotator_distribution": {}
            },
            "metadata_version": "2.1",
            **{k: v for k, v in existing_data.items() if k != "items"},  # 保留现有数据但不包括items
            **kwargs
        }
        
        self._write_metadata(metadata)
    
    def update_annotation_stats(self, dataset_id: str, total_annotated: int, 
                               annotator_id: str = "", **kwargs):
        """更新标注统计数据（不保存单条记录）
        
        Args:
            dataset_id: 数据集ID
            total_annotated: 已标注的总数量
            annotator_id: 标注者ID
            **kwargs: 其他统计信息（quality_rating, tags等）
        """
        metadata = self._read_metadata()
        
        if dataset_id not in metadata.get("datasets", {}):
            print(f"数据集 {dataset_id} 不存在，跳过更新")
            return
        
        dataset_meta = metadata["datasets"][dataset_id]
        
        # 更新统计数据
        dataset_meta["last_annotation_at"] = datetime.now().isoformat()
        dataset_meta["annotated_items"] = total_annotated
        dataset_meta["annotation_progress"] = (total_annotated / 
                                             dataset_meta["total_items"] * 100)
        
        # 更新质量分布统计
        quality_rating = kwargs.get('quality_rating')
        if quality_rating is not None:
            if str(quality_rating) not in dataset_meta["statistics"]["quality_distribution"]:
                dataset_meta["statistics"]["quality_distribution"][str(quality_rating)] = 0
            dataset_meta["statistics"]["quality_distribution"][str(quality_rating)] += 1
        
        # 更新标签分布统计
        tags = kwargs.get('tags', [])
        for tag in tags:
            if tag not in dataset_meta["statistics"]["tag_distribution"]:
                dataset_meta["statistics"]["tag_distribution"][tag] = 0
            dataset_meta["statistics"]["tag_distribution"][tag] += 1
        
        # 更新标注者分布统计
        if annotator_id not in dataset_meta["statistics"]["annotator_distribution"]:
            dataset_meta["statistics"]["annotator_distribution"][annotator_id] = 0
        dataset_meta["statistics"]["annotator_distribution"][annotator_id] += 1
        
        dataset_meta["statistics"]["total_annotations"] = total_annotated
        
        self._write_metadata(metadata)
    
    def get_dataset_info(self, dataset_id: str) -> Optional[Dict[str, Any]]:
        """获取数据集信息
        
        Args:
            dataset_id: 数据集ID
            
        Returns:
            数据集信息字典，如果不存在返回None
        """
        metadata = self._read_metadata()
        return metadata.get("datasets", {}).get(dataset_id)
    
    def update_annotation(self, dataset_id: str, annotation_id: str, line_number: int, 
                         annotator_id: str, status: str = "annotated", **kwargs):
        """[兼容方法] 更新标注信息，实际只更新统计数据
        
        Args:
            dataset_id: 数据集ID
            annotation_id: 标注ID（保留参数，用于日志记录）
            line_number: 行号（保留参数，用于日志记录）
            annotator_id: 标注者ID
            status: 标注状态
            **kwargs: 其他标注信息（quality_rating, tags等）
        
        注意：此方法仅更新统计数据，单条记录应保存在具体副本文件中
        """
        # 这里不实际更新，由调用方负责计算正确的annotated_items数量
        # 调用方应使用update_annotation_stats方法
        pass
    
    def get_annotation_count(self, dataset_id: str) -> int:
        """获取数据集的已标注数量
        
        Args:
            dataset_id: 数据集ID
            
        Returns:
            已标注的数据项数量
        """
        dataset_info = self.get_dataset_info(dataset_id)
        if not dataset_info:
            return 0
        return dataset_info.get("annotated_items", 0)
    
    def get_all_datasets(self) -> Dict[str, Dict[str, Any]]:
        """获取所有数据集信息
        
        Returns:
            所有数据集信息的字典
        """
        metadata = self._read_metadata()
        return metadata.get("datasets", {})
    
    def delete_dataset(self, dataset_id: str) -> bool:
        """删除数据集元信息
        
        Args:
            dataset_id: 数据集ID
            
        Returns:
            True如果删除成功，False如果数据集不存在
        """
        metadata = self._read_metadata()
        
        if dataset_id not in metadata.get("datasets", {}):
            return False
        
        del metadata["datasets"][dataset_id]
        self._write_metadata(metadata)
        return True
    
    def get_statistics(self, dataset_id: str) -> Optional[Dict[str, Any]]:
        """获取数据集统计信息
        
        Args:
            dataset_id: 数据集ID
            
        Returns:
            统计信息字典，如果不存在返回None
        """
        dataset_info = self.get_dataset_info(dataset_id)
        if not dataset_info:
            return None
        return dataset_info.get("statistics", {})