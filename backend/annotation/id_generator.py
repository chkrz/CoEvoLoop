import uuid
from datetime import datetime
from typing import Optional

class AnnotationIdGenerator:
    """标注唯一ID生成器"""
    
    @staticmethod
    def generate_id(dataset_id: str, sequence: int, prefix: str = "ann") -> str:
        """生成全局唯一标注ID
        
        Args:
            dataset_id: 数据集ID
            sequence: 序列号
            prefix: ID前缀，默认为"ann"
            
        Returns:
            格式为: {prefix}_{dataset_id}_{timestamp}_{uuid}_{sequence} 的唯一ID
        """
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S%f")[:-3]  # 毫秒级时间戳
        short_uuid = uuid.uuid4().hex[:8]
        return f"{prefix}_{dataset_id}_{timestamp}_{short_uuid}_{sequence:06d}"
    
    @staticmethod
    def parse_id(annotation_id: str) -> dict:
        """解析标注ID的各个组成部分
        
        Args:
            annotation_id: 标注ID字符串
            
        Returns:
            包含ID各组成部分的字典，如果格式不正确返回空字典
        """
        parts = annotation_id.split("_")
        if len(parts) >= 5 and parts[0] == "ann":
            return {
                "prefix": parts[0],
                "dataset_id": parts[1],
                "timestamp": parts[2],
                "uuid": parts[3],
                "sequence": int(parts[4])
            }
        return {}
    
    @staticmethod
    def is_valid_id(annotation_id: str) -> bool:
        """验证标注ID格式是否有效
        
        Args:
            annotation_id: 待验证的标注ID
            
        Returns:
            True如果ID格式有效，否则False
        """
        parts = annotation_id.split("_")
        if len(parts) != 5:
            return False
        
        if parts[0] != "ann":
            return False
        
        try:
            # 验证时间戳格式
            datetime.strptime(parts[2], "%Y%m%d%H%M%S%f")
            # 验证序列号
            int(parts[4])
            return True
        except (ValueError, IndexError):
            return False