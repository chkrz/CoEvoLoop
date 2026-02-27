"""
标注数据统计服务
"""
import json
import os
from typing import Dict, Optional
from pathlib import Path
from django.conf import settings
from django.db.models import Avg, Count, Q

from .models import ConversationAnnotation
from .views_v2 import _get_annotation_copy_path, _standardize_data_for_annotation


class AnnotationStatsService:
    """标注数据统计服务类"""
    
    @staticmethod
    def _get_dataset_type(dataset_id: str) -> str:
        """
        根据数据集ID获取数据类型
        
        Args:
            dataset_id: 数据集ID
            
        Returns:
            数据类型字符串 (EVALUATION, DIALOGUE, 等)
        """
        if not dataset_id:
            return 'DIALOGUE'  # 默认类型
            
        # 从数据集存储中获取数据类型
        try:
            import sys
            import os
            sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
            from coevoloop.dataset_views import dataset_storage
            
            dataset = dataset_storage.get_dataset(dataset_id)
            if dataset:
                return dataset.get('data_type', 'DIALOGUE')
        except Exception as e:
            pass
            
        return 'DIALOGUE'  # 默认类型
    
    @staticmethod
    def _calculate_assistant_model_score_for_evaluation(queryset) -> float:
        """
        计算质量评估类型的assistant_model_score
        
        计算逻辑：已标注的数据中评估详情中得分为1的维度数之和 / 已评估的数据中总的维度数之和
        
        Args:
            queryset: 已标注的查询集
            
        Returns:
            assistant_model_score (0-1)
        """
        total_score_1_convs = 0
        total_convs = 0
        
        for annotation in queryset:
            evaluation_data = {}
            
            # 优先从edited_data获取评估数据
            if annotation.get("edited_content") and isinstance(annotation['edited_content'], dict):
                # 支持多种路径的评估数据
                evaluation_data = (annotation['edited_content'].get('evaluation') or
                                 annotation['edited_content'].get('metadata', {}).get('evaluation') or
                                 annotation['edited_content'].get('original_data', {}).get('evaluation') or
                                 {})
            
            # 如果没有edited_data，从original_data获取
            elif annotation.get("original_content") and isinstance(annotation['original_content'], dict):
                evaluation_data = (annotation['original_content'].get('evaluation') or
                                 annotation['original_content'].get('metadata', {}).get('evaluation') or
                                 annotation['original_content'].get('original_data', {}).get('evaluation') or
                                 {})
            if isinstance(evaluation_data, dict) and evaluation_data:
                total_convs += 1
                # 计算得分为1的维度数
                for dimension, score in evaluation_data.items():
                    if dimension.endswith('评分'):
                        try:
                            score = int(score)
                        except Exception:
                            score = 0
                        if score != 1:
                            break
                else:
                    total_score_1_convs += 1

        # print("total_convs", total_convs, "total_score_1_convs", total_score_1_convs)
        if total_convs == 0:
            return 0.0
            
        score_ratio = total_score_1_convs * 1.0 / total_convs
        return round(score_ratio, 3)

    @staticmethod
    def _calculate_kappa_score_for_evaluation(queryset) -> float:
        """
        计算质量评估类型的assistant_model_score

        计算逻辑：已标注的数据中评估详情中得分为1的维度数之和 / 已评估的数据中总的维度数之和

        Args:
            queryset: 已标注的查询集

        Returns:
            kappa score (0-100)
        """
        total_same_dims = 0
        total_dims = 0

        for annotation in queryset:
            original_data = {}
            edited_data = {}

            if annotation.get("edited_content") and isinstance(annotation['edited_content'], dict):
                # 支持多种路径的评估数据
                edited_data = (annotation['edited_content'].get('evaluation') or
                                   annotation['edited_content'].get('metadata', {}).get('evaluation') or
                                   annotation['edited_content'].get('original_data', {}).get('evaluation') or
                                   {})

            if annotation.get("original_content") and isinstance(annotation['original_content'], dict):
                original_data = (annotation['original_content'].get('evaluation') or
                                   annotation['original_content'].get('metadata', {}).get('evaluation') or
                                   annotation['original_content'].get('original_data', {}).get('evaluation') or
                                   {})
            edited_dimension_dict = {}
            edited = True
            if not edited_data:
                edited = False
            elif isinstance(edited_data, dict) and edited_data:
                # 计算得分为1的维度数
                for dimension, score in edited_data.items():
                    if dimension.endswith('评分'):
                        try:
                            score = int(score)
                        except Exception as e:
                            score = 0
                        edited_dimension_dict[dimension] = score
            if isinstance(original_data, dict) and original_data:
                for dimension, score in original_data.items():
                    if dimension.endswith("评分"):
                        try:
                            score = int(score)
                        except Exception as e:
                            score = 0
                        total_dims += 1
                        if not edited:
                            total_same_dims += 1
                        elif score == edited_dimension_dict.get(dimension, -1):
                            total_same_dims += 1


        # print("total_dims", total_dims, "total_same_dims", total_same_dims)
        if total_dims == 0:
            return 0.0

        score_ratio = total_same_dims *1.0 / total_dims
        return round(score_ratio, 3)
    
    @staticmethod
    def get_annotation_statistics(dataset_id: str = None) -> Dict:
        """
        获取标注数据的统计信息
        
        根据数据类型计算不同的指标：
        - 质量评估类型：计算 kappa_score 和 assistant_model_score，turing_score返回-1
        - 对话合成类型：计算 turing_score，kappa_score和assistant_model_score返回-1
        
        Args:
            dataset_id: 可选的数据集ID过滤
            
        Returns:
            根据数据类型返回相应的统计信息
        """
        # 获取数据类型
        data_type = AnnotationStatsService._get_dataset_type(dataset_id)
        
        # 检查是否存在标注工作副本
        working_copy_path = _get_annotation_copy_path(dataset_id)
        if working_copy_path and os.path.exists(working_copy_path):
            # 从工作副本读取
            full_path = Path(working_copy_path)
            use_working_copy = True
        else:
            return {
                "assistant_model_score": 0.0,
                "turing_score": 0.0,
                "kappa_score": 0.0,
                "total_annotations": 0,
                "data_type": data_type,
                "message": "暂无标注数据"
            }

        # 读取文件内容并解析
        items = []
        with open(full_path, 'r', encoding='utf-8') as f:
            for line_num, line in enumerate(f, 1):
                line = line.strip()
                if not line:
                    continue

                try:
                    data = json.loads(line)

                    if use_working_copy:
                        # 工作副本已经是扁平化结构，直接使用
                        items.append(data)
                    else:
                        # 原始数据需要标准化处理
                        standardized_item = _standardize_data_for_annotation(data, data_type, line_num, dataset_id)
                        items.append(standardized_item)

                except json.JSONDecodeError as e:
                    # logger.warning(f"解析第{line_num}行失败: {e}")
                    # 创建错误项目
                    items.append({
                        'id': f'error_{line_num}',
                        'dataset_id': dataset_id,
                        'data_type': data_type,
                        'original_data': {'raw_content': line, 'parse_error': str(e)},
                        'annotation_data': {},
                        'line_number': line_num
                    })
        # 基础查询集
        # queryset = ConversationAnnotation.objects.filter(is_annotated=True)

        # if dataset_id:
        #     queryset = queryset.filter(dataset_id=dataset_id)
        # for i in items:
        #     print(i)
        #     break
        # print(data_type)
        # 计算基础统计
        annotations = list(i for i in items if i.get("is_annotated"))
        total_annotations = len(annotations)

        
        if total_annotations == 0:
            return {
                "assistant_model_score": 0.0,
                "turing_score": 0.0,
                "kappa_score": 0.0,
                "total_annotations": 0,
                "data_type": data_type,
                "message": "暂无标注数据"
            }
        
        # 根据数据类型计算不同的指标
        if data_type == 'EVALUATION':
            # 质量评估类型：计算 kappa_score 和 assistant_model_score
            assistant_model_score = AnnotationStatsService._calculate_assistant_model_score_for_evaluation(annotations)
            kappa_score = AnnotationStatsService._calculate_kappa_score_for_evaluation(annotations)  # 暂不实现，返回0
            turing_score = -1  # 不计算，返回-1
            
        elif data_type == 'DIALOGUE':
            # 对话合成类型：计算 turing_score
            turing_score = -1  # 暂不实现，返回-1
            kappa_score = -1   # 不计算，返回-1
            assistant_model_score = -1  # 不计算，返回-1
            
        else:
            # 其他类型：所有指标都返回-1
            assistant_model_score = -1
            turing_score = -1
            kappa_score = -1
        
        return {
            "assistant_model_score": assistant_model_score,
            "turing_score": turing_score,
            "kappa_score": kappa_score,
            "total_annotations": total_annotations,
            "data_type": data_type
        }
    
    @staticmethod
    def get_detailed_statistics(dataset_id: str = None) -> Dict:
        """
        获取详细的标注统计信息
        
        Args:
            dataset_id: 可选的数据集ID过滤
            
        Returns:
            包含详细统计信息的字典
        """
        base_stats = AnnotationStatsService.get_annotation_statistics(dataset_id)
        
        # 基础查询集
        queryset = ConversationAnnotation.objects.filter(is_annotated=True)
        if dataset_id:
            queryset = queryset.filter(dataset_id=dataset_id)
        
        # 获取数据类型
        data_type = AnnotationStatsService._get_dataset_type(dataset_id)
        
        # 获取分类统计
        category_stats = dict(
            queryset.values('category').annotate(
                count=Count('id'),
                avg_quality=Avg('quality_score')
            ).values_list('category', 'count', 'avg_quality')
        )
        
        # 获取准确性统计
        accuracy_stats = dict(
            queryset.values('accuracy').annotate(
                count=Count('id')
            ).values_list('accuracy', 'count')
        )
        
        # 获取质量分数分布
        quality_distribution = dict(
            queryset.values('quality_score').annotate(
                count=Count('id')
            ).values_list('quality_score', 'count')
        )
        
        # 根据数据类型添加特定统计
        if data_type == 'EVALUATION':
            # 质量评估类型：添加评估维度统计
            evaluation_stats = AnnotationStatsService._get_evaluation_dimension_stats(queryset)
            base_stats.update({
                "evaluation_dimension_stats": evaluation_stats
            })
        
        base_stats.update({
            "category_distribution": category_stats,
            "accuracy_distribution": accuracy_stats,
            "quality_distribution": quality_distribution
        })
        
        return base_stats
    
    @staticmethod
    def _get_evaluation_dimension_stats(queryset) -> Dict:
        """
        获取评估维度的详细统计
        
        Args:
            queryset: 已标注的查询集
            
        Returns:
            评估维度统计信息
        """
        dimension_stats = {}
        total_annotations = queryset.count()
        
        for annotation in queryset:
            evaluation_data = {}
            
            # 获取评估数据
            if annotation.edited_data and isinstance(annotation.edited_data, dict):
                evaluation_data = (annotation.edited_data.get('evaluation') or 
                                 annotation.edited_data.get('metadata', {}).get('evaluation') or 
                                 annotation.edited_data.get('original_data', {}).get('evaluation') or 
                                 {})
            elif annotation.original_data and isinstance(annotation.original_data, dict):
                evaluation_data = (annotation.original_data.get('evaluation') or 
                                 annotation.original_data.get('metadata', {}).get('evaluation') or 
                                 annotation.original_data.get('original_data', {}).get('evaluation') or 
                                 {})
            
            if isinstance(evaluation_data, dict):
                for dimension, score in evaluation_data.items():
                    if isinstance(score, (int, float)):
                        if dimension not in dimension_stats:
                            dimension_stats[dimension] = {
                                'total_count': 0,
                                'score_1_count': 0,
                                'average_score': 0.0,
                                'score_distribution': {}
                            }
                        
                        dimension_stats[dimension]['total_count'] += 1
                        if score == 1:
                            dimension_stats[dimension]['score_1_count'] += 1
                        
                        # 更新分数分布
                        score_str = str(score)
                        if score_str not in dimension_stats[dimension]['score_distribution']:
                            dimension_stats[dimension]['score_distribution'][score_str] = 0
                        dimension_stats[dimension]['score_distribution'][score_str] += 1
        
        # 计算每个维度的平均分和比例
        for dimension, stats in dimension_stats.items():
            if stats['total_count'] > 0:
                stats['score_1_ratio'] = round((stats['score_1_count'] / stats['total_count']) * 100, 2)
                # 计算平均分
                total_score = sum(float(k) * v for k, v in stats['score_distribution'].items())
                stats['average_score'] = round(total_score / stats['total_count'], 2)
        
        return dimension_stats