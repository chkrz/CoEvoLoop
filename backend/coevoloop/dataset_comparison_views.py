"""
标注数据对比API
提供标注数据集与原数据集的对比功能
"""
import json
import os
from pathlib import Path
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from storage.dataset_storage import DatasetStorage
import difflib
from typing import Dict, List, Any, Optional
import logging

logger = logging.getLogger(__name__)
dataset_storage = DatasetStorage()


@api_view(['GET'])
def annotation_comparison(request, dataset_id):
    """
    获取标注数据与原数据的对比结果
    
    参数:
        dataset_id: 标注数据集的ID
    
    返回:
        对比结果列表，包含每条数据的原始版本和标注版本
    """
    try:
        # 1. 获取标注数据集
        annotated_dataset = dataset_storage.get_dataset(dataset_id)
        if not annotated_dataset:
            return Response(
                {"error": "标注数据集不存在"}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        # 2. 检查是否为标注来源的数据集
        if annotated_dataset.get('source') not in ['ANNOTATION', 'ANNOTATION_V2']:
            return Response(
                {"error": "该数据集不是标注来源的数据集"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # 3. 获取原始数据集信息
        # 从文件名或元数据中提取原始数据集ID
        original_dataset_id = _extract_original_dataset_id(annotated_dataset)
        if not original_dataset_id:
            return Response(
                {"error": "无法确定原始数据集"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        original_dataset = dataset_storage.get_dataset(original_dataset_id)
        if not original_dataset:
            return Response(
                {"error": "原始数据集不存在"}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        # 4. 读取两个数据集的内容
        annotated_data = _read_dataset_content(annotated_dataset)
        original_data = _read_dataset_content(original_dataset)
        
        # 5. 进行对比分析
        comparisons = _compare_datasets(original_data, annotated_data)
        
        return Response({
            "dataset_id": dataset_id,
            "original_dataset_id": original_dataset_id,
            "total_items": len(comparisons),
            "changed_items": len([c for c in comparisons if c.get('has_changes', False)]),
            "comparisons": comparisons
        })
        
    except Exception as e:
        logger.error(f"标注数据对比失败: {e}", exc_info=True)
        return Response(
            {"error": f"标注数据对比失败: {str(e)}"}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
def dataset_relations(request, dataset_id):
    """
    获取数据集的关联关系
    
    参数:
        dataset_id: 数据集ID
    
    返回:
        关联关系信息，包括源数据集、衍生数据集和标注批次
    """
    try:
        dataset = dataset_storage.get_dataset(dataset_id)
        if not dataset:
            return Response(
                {"error": "数据集不存在"}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        # 构建关联关系
        relations = {
            "source_datasets": [],
            "derived_datasets": [],
            "annotation_batches": []
        }
        
        # 如果是标注数据集，尝试找到原始数据集
        if dataset.get('source') in ['ANNOTATION', 'ANNOTATION_V2']:
            original_id = _extract_original_dataset_id(dataset)
            if original_id:
                original = dataset_storage.get_dataset(original_id)
                if original:
                    relations["source_datasets"].append({
                        "id": original["id"],
                        "name": original["name"],
                        "data_type": original["data_type"],
                        "item_count": original.get("item_count", 0),
                        "created_at": original["created_at"]
                    })
        
        # 查找衍生数据集（标注数据集）
        all_datasets_result = dataset_storage.list_datasets()
        all_datasets = all_datasets_result if isinstance(all_datasets_result, list) else all_datasets_result.get("datasets", [])
        for ds in all_datasets:
            if ds.get("source") in ["ANNOTATION", "ANNOTATION_V2"]:
                original_id = _extract_original_dataset_id(ds)
                if original_id == dataset_id:
                    relations["derived_datasets"].append({
                        "id": ds["id"],
                        "name": ds["name"],
                        "data_type": ds["data_type"],
                        "item_count": ds.get("item_count", 0),
                        "created_at": ds["created_at"]
                    })
        
        return Response(relations)
        
    except Exception as e:
        logger.error(f"获取数据集关联关系失败: {e}", exc_info=True)
        return Response(
            {"error": f"获取数据集关联关系失败: {str(e)}"}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


def _extract_original_dataset_id(annotated_dataset: Dict[str, Any]) -> Optional[str]:
    """
    从标注数据集中提取原始数据集ID
    
    策略：
    1. 检查description中是否包含原始数据集ID
    2. 检查文件名模式
    3. 检查是否有source_dataset_id字段
    4. 检查source_task_id字段
    5. 通过文件名模式匹配
    """
    description = annotated_dataset.get('description', '')
    
    # 策略1: 从description中提取
    if 'source_dataset_id:' in description:
        import re
        match = re.search(r'source_dataset_id:\s*([a-zA-Z0-9_-]+)', description)
        if match:
            return match.group(1)
    
    # 策略2: 从文件名模式提取
    file_name = annotated_dataset.get('file_name', '')
    if file_name.startswith('annotated_'):
        # 尝试从文件名中提取原始ID
        original_name = file_name.replace('annotated_', '', 1)
        if original_name.endswith('.jsonl'):
            original_name = original_name[:-6]  # 移除.jsonl
        
        # 查找匹配的数据集
        all_datasets_result = dataset_storage.list_datasets()
        all_datasets = all_datasets_result.get("datasets", []) if isinstance(all_datasets_result, dict) else []
        for ds in all_datasets:
            if ds["id"] == original_name:
                return original_name
    
    # 策略3: 检查source_dataset_id字段
    source_dataset_id = annotated_dataset.get('source_dataset_id')
    if source_dataset_id:
        return source_dataset_id
    
    # 策略4: 检查source_task_id字段
    source_task_id = annotated_dataset.get('source_task_id')
    if source_task_id:
        # 查找对应的数据集
        all_datasets_result = dataset_storage.list_datasets()
        all_datasets = all_datasets_result if isinstance(all_datasets_result, list) else all_datasets_result.get("datasets", [])
        for ds in all_datasets:
            if ds.get('source_task_id') == source_task_id:
                return ds["id"]
    
    # 策略5: 通过文件名模式匹配
    # 如果文件名是 ds_20260212_1135a3c3227d.jsonl，尝试查找类似的数据集
    file_name = annotated_dataset.get('file_name', '')
    if file_name.startswith('ds_') and file_name.endswith('.jsonl'):
        dataset_name = file_name[:-6]  # 移除.jsonl
        
        # 查找所有数据集，尝试找到最匹配的
        all_datasets_result = dataset_storage.list_datasets()
        all_datasets = all_datasets_result if isinstance(all_datasets_result, list) else all_datasets_result.get("datasets", [])
        
        # 优先查找相同名称的数据集
        for ds in all_datasets:
            if ds["id"] == dataset_name and ds.get('source') != 'ANNOTATION_V2':
                return ds["id"]
        
        # 如果没有找到，返回第一个非标注数据集
        for ds in all_datasets:
            if ds.get('source') not in ['ANNOTATION', 'ANNOTATION_V2']:
                return ds["id"]
    
    return None


def _read_dataset_content(dataset: Dict[str, Any]) -> List[Dict[str, Any]]:
    """读取数据集内容"""
    try:
        file_path = dataset.get("file_path")
        if not file_path:
            return []
        
        # 构建完整路径
        backend_dir = Path(__file__).parent.parent
        full_path = backend_dir / "storage" / file_path
        
        if not full_path.exists():
            logger.warning(f"文件不存在: {full_path}")
            return []
        
        content = []
        with open(full_path, 'r', encoding='utf-8') as f:
            for line_num, line in enumerate(f, 1):
                line = line.strip()
                if not line:
                    continue
                
                try:
                    data = json.loads(line)
                    # 添加行号作为标识
                    if isinstance(data, dict):
                        data['_line_number'] = line_num
                        data['_dataset_id'] = dataset["id"]
                    content.append(data)
                except json.JSONDecodeError:
                    logger.warning(f"解析第{line_num}行失败")
                    continue
        
        return content
        
    except Exception as e:
        logger.error(f"读取数据集内容失败: {e}")
        return []


def _compare_datasets(original_data: List[Dict], annotated_data: List[Dict]) -> List[Dict[str, Any]]:
    """对比两个数据集的内容"""
    comparisons = []
    
    # 确保两个数据集长度一致
    max_length = max(len(original_data), len(annotated_data))
    
    for i in range(max_length):
        original_item = original_data[i] if i < len(original_data) else None
        annotated_item = annotated_data[i] if i < len(annotated_data) else None
        
        if original_item is None or annotated_item is None:
            continue
        
        # 计算差异
        changes = _calculate_changes(original_item, annotated_item)
        has_changes = len(changes) > 0
        
        comparison = {
            "id": f"comparison_{i}",
            "sample_index": i,
            "original_data": original_item,
            "annotated_data": annotated_item,
            "has_changes": has_changes,
            "change_type": _determine_change_type(changes),
            "changes": changes,
            "similarity_score": _calculate_similarity(original_item, annotated_item)
        }
        
        comparisons.append(comparison)
    
    return comparisons


def _calculate_changes(original: Dict, annotated: Dict) -> List[Dict[str, Any]]:
    """计算两个数据项之间的具体变化"""
    changes = []
    
    # 递归比较嵌套字典
    def _compare_dict(orig, curr, path=""):
        if not isinstance(orig, dict) or not isinstance(curr, dict):
            if orig != curr:
                changes.append({
                    "type": "modified",
                    "field": path or "value",
                    "old_value": orig,
                    "new_value": curr
                })
            return
        
        all_keys = set(orig.keys()) | set(curr.keys())
        for key in all_keys:
            new_path = f"{path}.{key}" if path else key
            
            if key not in orig:
                changes.append({
                    "type": "added",
                    "field": new_path,
                    "old_value": None,
                    "new_value": curr[key]
                })
            elif key not in curr:
                changes.append({
                    "type": "deleted",
                    "field": new_path,
                    "old_value": orig[key],
                    "new_value": None
                })
            else:
                orig_val = orig[key]
                curr_val = curr[key]
                
                if isinstance(orig_val, dict) and isinstance(curr_val, dict):
                    _compare_dict(orig_val, curr_val, new_path)
                elif isinstance(orig_val, list) and isinstance(curr_val, list):
                    if orig_val != curr_val:
                        changes.append({
                            "type": "modified",
                            "field": new_path,
                            "old_value": orig_val,
                            "new_value": curr_val
                        })
                elif orig_val != curr_val:
                    changes.append({
                        "type": "modified",
                        "field": new_path,
                        "old_value": orig_val,
                        "new_value": curr_val
                    })
    
    _compare_dict(original, annotated)
    return changes


def _determine_change_type(changes: List[Dict]) -> str:
    """根据变化确定变更类型"""
    if not changes:
        return "none"
    
    change_types = {change["type"] for change in changes}
    
    if "added" in change_types and "deleted" in change_types:
        return "mixed"
    elif "added" in change_types:
        return "added"
    elif "deleted" in change_types:
        return "deleted"
    else:
        return "modified"


def _calculate_similarity(original: Dict, annotated: Dict) -> float:
    """计算两个数据项的相似度"""
    try:
        orig_str = json.dumps(original, sort_keys=True, ensure_ascii=False)
        annot_str = json.dumps(annotated, sort_keys=True, ensure_ascii=False)
        
        # 使用difflib计算相似度
        similarity = difflib.SequenceMatcher(None, orig_str, annot_str).ratio()
        return round(similarity, 3)
    except Exception:
        return 0.0