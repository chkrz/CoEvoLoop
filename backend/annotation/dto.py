"""
标注数据传输对象 (DTO)
"""
from typing import Dict, Optional
from dataclasses import dataclass


@dataclass
class AnnotationStatsDTO:
    """标注统计信息DTO"""
    assistant_model_score: float
    turing_score: float
    kappa_score: float
    total_annotations: int
    dataset_id: Optional[str] = None
    message: Optional[str] = None
    
    def to_dict(self) -> Dict:
        """转换为字典格式"""
        return {
            "assistant_model_score": self.assistant_model_score,
            "turing_score": self.turing_score,
            "kappa_score": self.kappa_score,
            "total_annotations": self.total_annotations,
            "dataset_id": self.dataset_id,
            "message": self.message
        }


@dataclass
class DetailedAnnotationStatsDTO(AnnotationStatsDTO):
    """详细标注统计信息DTO"""
    category_distribution: Optional[Dict] = None
    accuracy_distribution: Optional[Dict] = None
    quality_distribution: Optional[Dict] = None
    
    def to_dict(self) -> Dict:
        """转换为字典格式"""
        base_dict = super().to_dict()
        base_dict.update({
            "category_distribution": self.category_distribution or {},
            "accuracy_distribution": self.accuracy_distribution or {},
            "quality_distribution": self.quality_distribution or {}
        })
        return base_dict