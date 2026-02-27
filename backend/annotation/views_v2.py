from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.conf import settings
from django.http import JsonResponse, HttpResponseBadRequest
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
import os
import json
import uuid
import logging
from datetime import datetime
from pathlib import Path
from .models import ConversationAnnotation
from coevoloop.dataset_views import dataset_storage
from .id_generator import AnnotationIdGenerator
from .metadata_manager import AnnotationMetadataManager

logger = logging.getLogger(__name__)

ANNOTATION_V2_DIR = os.path.join(settings.BASE_DIR, 'storage', 'annotation_v2')
# ANNOTATION_WORKING_COPIES_DIR = os.path.join(settings.BASE_DIR, 'storage', 'annotation_working_copies')
ANNOTATION_WORKING_COPIES_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'storage', 'annotation_working_copies')

ANNOTATION_COPY_METADATA_FILE = os.path.join(ANNOTATION_WORKING_COPIES_DIR, 'copies_metadata.json')

def _get_annotation_copy_path(dataset_id):
    """
    获取数据集的标注工作副本路径
    如果存在则返回最新副本的路径，否则返回 None
    """
    # 确保目录存在
    os.makedirs(ANNOTATION_WORKING_COPIES_DIR, exist_ok=True)

    # 查找该数据集的标注副本
    copy_pattern = f"{dataset_id}_annotated_copy_"
    copies = [f for f in os.listdir(ANNOTATION_WORKING_COPIES_DIR)
              if f.startswith(copy_pattern) and f.endswith('.jsonl')]

    if not copies:
        return None

    # 返回最新的副本（按文件名排序，假设时间戳在文件名中）
    latest_copy = sorted(copies)[-1]
    return os.path.join(ANNOTATION_WORKING_COPIES_DIR, latest_copy)

def _create_annotation_copy(dataset_id, dataset_info):
    """
    创建原始数据集的标注工作副本，使用新的ID生成策略
    将原始数据复制到工作副本目录，并添加标注字段
    """
    timestamp = datetime.now().strftime('%Y%m%d-%H%M%S')
    copy_filename = f"{dataset_id}_annotated_copy_{timestamp}.jsonl"
    copy_path = os.path.join(ANNOTATION_WORKING_COPIES_DIR, copy_filename)
    
    # 初始化元信息管理器
    metadata_manager = AnnotationMetadataManager(ANNOTATION_WORKING_COPIES_DIR)
    
    # 读取原始数据集文件
    storage_dir = Path(dataset_storage.storage_dir)
    original_path = storage_dir / dataset_info.get('file_path')

    copied_items = []
    with open(original_path, 'r', encoding='utf-8') as f:
        for line_num, line in enumerate(f, 1):
            if line.strip():
                try:
                    original_data = json.loads(line.strip())
                    # 生成新的annotation_id - 使用正确的行号（从1开始）
                    annotation_id = AnnotationIdGenerator.generate_id(dataset_id, line_num)
                    
                    item = {
                        'id': annotation_id,  # 使用新的全局唯一ID
                        'dataset_id': dataset_id,
                        'data_type': dataset_info.get('data_type'),
                        'original_content': original_data,
                        'edited_content': None,
                        'tags': [],
                        'notes': '',
                        'quality_rating': None,
                        'intent': None,
                        'roles': {},
                        'custom_fields': {},
                        'line_number': line_num,  # 保持与原始数据一致的行号
                        'annotation_metadata': {
                            'created_at': datetime.now().isoformat(),
                            'last_updated': datetime.now().isoformat(),
                            'version': 2,  # 版本升级到2.0
                            'annotator_id': None,
                            'annotation_id_format': 'ann_{dataset_id}_{timestamp}_{uuid}_{sequence}'
                        }
                    }
                    copied_items.append(item)
                except json.JSONDecodeError:
                    logger.warning(f"解析第{line_num}行失败，跳过")
                    continue

    # 注册数据集到元信息
    metadata_manager.register_dataset(dataset_id, len(copied_items))
    
    # 写入副本文件
    with open(copy_path, 'w', encoding='utf-8') as f:
        for item in copied_items:
            f.write(json.dumps(item, ensure_ascii=False) + '\n')

    # 更新元数据注册表（保持向后兼容）
    _update_copy_metadata(dataset_id, copy_path, timestamp, len(copied_items))

    logger.info(f"已创建标注工作副本: {copy_path}，共 {len(copied_items)} 项")
    return copy_path

def _update_copy_metadata(dataset_id, copy_path, timestamp, item_count):
    """
    更新标注副本的元数据注册表
    """
    metadata = {}
    if os.path.exists(ANNOTATION_COPY_METADATA_FILE):
        try:
            with open(ANNOTATION_COPY_METADATA_FILE, 'r', encoding='utf-8') as f:
                metadata = json.load(f)
        except Exception as e:
            logger.error(f"读取副本元数据失败: {e}")
            metadata = {}

    metadata[dataset_id] = {
        'copy_path': copy_path,
        'created_at': timestamp,
        'last_updated': datetime.now().isoformat(),
        'item_count': item_count,
        'status': 'active'
    }

    with open(ANNOTATION_COPY_METADATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(metadata, f, ensure_ascii=False, indent=2)

def _transform_legacy_item_to_flat(legacy_item):
    """
    将旧格式的标注项转换为新的扁平化格式
    """
    flat_item = {
        'id': legacy_item['id'],
        'dataset_id': legacy_item['dataset_id'],
        'data_type': legacy_item['data_type'],
        'original_content': legacy_item['original_data'],
        'line_number': legacy_item['line_number'],
        'annotation_metadata': {
            'created_at': datetime.now().isoformat(),
            'last_updated': datetime.now().isoformat(),
            'version': 1,
            'annotator_id': None
        }
    }

    # 将 nested 的 annotation_data 展开到顶层
    annotation_data = legacy_item.get('annotation_data', {})
    flat_item.update({
        'edited_content': annotation_data.get('edited_content'),
        'tags': annotation_data.get('tags', []),
        'notes': annotation_data.get('notes', ''),
        'quality_rating': annotation_data.get('quality_rating'),
        'intent': annotation_data.get('intent'),
        'roles': annotation_data.get('roles', {}),
        'custom_fields': annotation_data.get('custom_fields', {})
    })

    return flat_item

@api_view(['GET'])
def get_dataset_content_for_annotation(request, dataset_id):
    """
    获取数据集内容用于标注，支持所有4种数据类型

    参数:
        dataset_id: 数据集ID
        page: 页码（默认1）
        page_size: 每页数量（默认20）

    返回:
        - dataset: 数据集元信息
        - items: 标注项目列表
        - pagination: 分页信息
    """
    try:
        page = int(request.query_params.get('page', 1))
        page_size = min(int(request.query_params.get('page_size', 20)), 100)

        # 获取数据集信息
        dataset = dataset_storage.get_dataset(dataset_id)
        if not dataset:
            return Response({'error': '数据集不存在'}, status=status.HTTP_404_NOT_FOUND)

        data_type = dataset.get('data_type', 'UNKNOWN')
        file_path = dataset.get('file_path')

        # 检查是否存在标注工作副本
        working_copy_path = _get_annotation_copy_path(dataset_id)

        if working_copy_path and os.path.exists(working_copy_path):
            # 从工作副本读取
            full_path = Path(working_copy_path)
            use_working_copy = True
            logger.info(f"加载标注工作副本: {working_copy_path}")
        else:
            # 从原始数据集读取
            if not file_path:
                return Response({'error': '数据集文件路径不存在'}, status=status.HTTP_404_NOT_FOUND)

            storage_dir = Path(dataset_storage.storage_dir)
            full_path = storage_dir / file_path

            if not full_path.exists():
                return Response({'error': f'文件不存在: {file_path}'}, status=status.HTTP_404_NOT_FOUND)

            use_working_copy = False

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
                    logger.warning(f"解析第{line_num}行失败: {e}")
                    # 创建错误项目
                    items.append({
                        'id': f'error_{line_num}',
                        'dataset_id': dataset_id,
                        'data_type': data_type,
                        'original_data': {'raw_content': line, 'parse_error': str(e)},
                        'annotation_data': {},
                        'line_number': line_num
                    })

        # 分页处理
        total_count = len(items)
        start_index = (page - 1) * page_size
        end_index = start_index + page_size
        paginated_items = items[start_index:end_index]

        return Response({
            'dataset': {
                'id': dataset_id,
                'name': dataset.get('name', '未知数据集'),
                'description': dataset.get('description', ''),
                'data_type': data_type,
                'total_samples': total_count,
                'file_path': file_path
            },
            'items': paginated_items,
            'pagination': {
                'page': page,
                'page_size': page_size,
                'total': total_count,
                'total_pages': (total_count + page_size - 1) // page_size,
                'has_next': end_index < total_count,
                'has_previous': start_index > 0
            }
        })

    except Exception as e:
        logger.error(f"获取数据集内容失败: {e}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

def _standardize_data_for_annotation(data, data_type, line_number, dataset_id):
    """
    根据数据类型标准化数据用于标注 - 使用新的扁平化结构
    """
    standardized = {
        'id': f'{dataset_id}_{line_number}',
        'dataset_id': dataset_id,
        'data_type': data_type,
        'original_content': data,
        'edited_content': None,
        'tags': [],
        'notes': '',
        'quality_rating': None,
        'intent': None,
        'roles': {},
        'custom_fields': {},
        'line_number': line_number,
        'annotation_metadata': {
            'created_at': None,  # 将在首次保存时设置
            'last_updated': datetime.now().isoformat(),
            'version': 0,  # 将在首次保存时设置为 1
            'annotator_id': None
        }
    }

    # 根据数据类型初始化特定的标注字段
    if data_type == 'PORTRAIT':
        standardized['roles'] = {
            'background_quality': None,
            'knowledge_gap_clarity': None,
            'operation_history_completeness': None
        }
        standardized['intent'] = {
            'profile_purpose': None,
            'confidence_level': None
        }

    elif data_type == 'DIALOGUE':
        standardized['roles'] = {
            'user_behavior': None,
            'assistant_performance': None,
            'dialogue_flow': None
        }
        standardized['intent'] = {
            'conversation_purpose': None,
            'resolution_status': None
        }

    elif data_type == 'EVALUATION':
        standardized['roles'] = {
            'evaluation_fairness': None,
            'scoring_accuracy': None,
            'feedback_quality': None
        }
        standardized['intent'] = {
            'evaluation_purpose': None,
            'improvement_suggestion': None
        }

    elif data_type == 'HUMAN_HUMAN_DIALOGUE':
        standardized['roles'] = {
            'collaboration_quality': None,
            'coordination_effectiveness': None,
            'handover_smoothness': None
        }
        standardized['intent'] = {
            'collaboration_purpose': None,
            'success_criterion': None
        }

    return standardized

@api_view(['POST'])
def save_annotation(request):
    """
    保存标注数据 - 创建或更新标注工作副本，并更新元信息

    请求参数:
    {
        "dataset_id": string,
        "item_id": string,
        "annotation_data": {
            "edited_content": object,    # 编辑后的内容
            "tags": string[],
            "notes": string,
            "quality_rating": number,   # 1-5分
            "intent": object,
            "roles": object,
            "custom_fields": object
        },
        "auto_save": boolean   // 是否自动保存
    }
    """
    try:
        dataset_id = request.data.get('dataset_id')
        item_id = request.data.get('item_id')
        annotation_data = request.data.get('annotation_data', {})
        auto_save = request.data.get('auto_save', False)

        # 验证参数
        if not all([dataset_id, item_id]):
            return Response({'error': 'dataset_id 和 item_id 是必填参数'},
                          status=status.HTTP_400_BAD_REQUEST)

        # 获取数据集信息
        dataset = dataset_storage.get_dataset(dataset_id)
        if not dataset:
            return Response({'error': '数据集不存在'}, status=status.HTTP_404_NOT_FOUND)

        # 检查或创建标注工作副本
        copy_path = _get_annotation_copy_path(dataset_id)

        if not copy_path:
            # 首次标注 - 创建工作副本
            copy_path = _create_annotation_copy(dataset_id, dataset)
            message = '首次标注 - 已创建工作副本'
        else:
            message = '标注已保存到现有工作副本'

        # 初始化元信息管理器
        metadata_manager = AnnotationMetadataManager(ANNOTATION_WORKING_COPIES_DIR)
        
        # 加载工作副本文件
        items = []
        with open(copy_path, 'r', encoding='utf-8') as f:
            for line in f:
                if line.strip():
                    try:
                        items.append(json.loads(line.strip()))
                    except json.JSONDecodeError:
                        continue

        # 更新特定的标注项
        item_updated = False
        current_time = datetime.now().isoformat()
        annotator_id = request.user.username if hasattr(request, 'user') else 'anonymous'

        for item in items:
            if item.get('id') == item_id:
                # 更新标注字段（扁平化结构）
                item['edited_content'] = annotation_data.get('edited_content')
                item['tags'] = annotation_data.get('tags', [])
                item['notes'] = annotation_data.get('notes', '')
                item['quality_rating'] = annotation_data.get('quality_rating')
                item['intent'] = annotation_data.get('intent')
                item['roles'] = annotation_data.get('roles', {})
                item['custom_fields'] = annotation_data.get('custom_fields', {})

                # 更新标注元数据
                if not item['annotation_metadata']['created_at']:
                    item['annotation_metadata']['created_at'] = current_time
                item['annotation_metadata']['last_updated'] = current_time
                item['annotation_metadata']['version'] = (item['annotation_metadata'].get('version', 0) or 0) + 1

                if not auto_save:
                    item['annotation_metadata']['annotator_id'] = annotator_id

                item_updated = True
                
        # 计算已标注数量
        annotated_count = len([item for item in items 
                             if item.get('annotation_metadata', {}).get('status') == 'annotated' or 
                             item.get('is_annotated', False)])
        
        # 更新统计数据
        metadata_manager.update_annotation_stats(
            dataset_id=dataset_id,
            total_annotated=annotated_count,
            annotator_id=annotator_id,
            has_edits=bool(annotation_data.get('edited_content')),
            tags_count=len(annotation_data.get('tags', [])),
            quality_rating=annotation_data.get('quality_rating'),
            notes_length=len(annotation_data.get('notes', ''))
        )

        # # 如果找不到项目，创建一个新的（保护性代码）
        # if not item_updated:
        #     logger.warning(f"在标注副本中未找到项目 {item_id}，将创建新项目")
        #     new_item = {
        #         'id': item_id,
        #         'dataset_id': dataset_id,
        #         'data_type': dataset.get('data_type'),
        #         'original_content': {},
        #         'edited_content': annotation_data.get('edited_content'),
        #         'tags': annotation_data.get('tags', []),
        #         'notes': annotation_data.get('notes', ''),
        #         'quality_rating': annotation_data.get('quality_rating'),
        #         'intent': annotation_data.get('intent'),
        #         'roles': annotation_data.get('roles', {}),
        #         'custom_fields': annotation_data.get('custom_fields', {}),
        #         'line_number': 0,  # 默认值
        #         'annotation_metadata': {
        #             'created_at': current_time,
        #             'last_updated': current_time,
        #             'version': 1,
        #             'annotator_id': annotator_id
        #         }
        #     }
        #     items.append(new_item)
        #
        #     # 计算已标注数量（包括新添加的项目）
        #     annotated_count = len([item for item in items
        #                          if item.get('annotation_metadata', {}).get('status') == 'annotated' or
        #                          item.get('custom_fields', {}).get('is_annotated')])
        #
        #     # 更新统计数据
        #     metadata_manager.update_annotation_stats(
        #         dataset_id=dataset_id,
        #         total_annotated=annotated_count,
        #         annotator_id=annotator_id,
        #         has_edits=bool(annotation_data.get('edited_content')),
        #         tags_count=len(annotation_data.get('tags', [])),
        #         quality_rating=annotation_data.get('quality_rating'),
        #         notes_length=len(annotation_data.get('notes', ''))
        #     )

        # 保存回文件
        with open(copy_path, 'w', encoding='utf-8') as f:
            for item in items:
                f.write(json.dumps(item, ensure_ascii=False) + '\n')

        # 更新副本元数据（保持向后兼容）
        _update_copy_metadata(dataset_id, copy_path,
                             datetime.now().strftime('%Y%m%d-%H%M%S'),
                             len(items))

        return Response({
            'success': True,
            'message': f'{"自动" if auto_save else "手动"}{message}',
            'item_id': item_id,
            'copy_path': copy_path,
            'timestamp': current_time
        })

    except Exception as e:
        logger.error(f"保存标注失败: {e}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
def annotate_and_export_dataset(request):
    """
    将标注结果导出为新的数据集

    请求参数:
    {
        "source_dataset_id": string,   // 源数据集ID
        "new_dataset_name": string,   // 新数据集名称
        "new_dataset_description": string, // 新数据集描述
        "annotation_ids": string[],    // 要包含的标注项目ID列表（可选，不传则包含所有）
        "export_format": "ORIGINAL"|"EDITED"|"MIXED", // 导出格式
        "include_metadata": boolean,   // 是否包含标注元数据
        "data_selection": "ALL"|"ANNOTATED"|"UNANNOTATED", // 数据选择策略
        "quality_threshold": number,   // 质量评分阈值（1-5分）
        "include_original_id": boolean, // 是否保留原始数据集ID
        "include_original_item_id": boolean // 是否保留原始数据项ID
    }
    """
    try:
        source_dataset_id = request.data.get('source_dataset_id')
        new_dataset_name = request.data.get('new_dataset_name')
        new_dataset_description = request.data.get('new_dataset_description', '')
        annotation_ids = request.data.get('annotation_ids', [])
        export_format = request.data.get('export_format', 'EDITED')
        include_metadata = request.data.get('include_metadata', False)
        data_selection = request.data.get('data_filter', 'ALL')
        quality_threshold = request.data.get('quality_threshold', 0)
        include_original_id = request.data.get('include_original_id', False)
        include_original_item_id = request.data.get('include_original_item_id', False)

        # 验证必填参数
        if not all([source_dataset_id, new_dataset_name]):
            return Response(
                {'error': 'source_dataset_id 和 new_dataset_name 是必填参数'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 获取源数据集信息
        source_dataset = dataset_storage.get_dataset(source_dataset_id)
        if not source_dataset:
            return Response({'error': '源数据集不存在'}, status=status.HTTP_404_NOT_FOUND)

        data_type = source_dataset.get('data_type')

        # 优先检查标注工作副本
        working_copy_path = _get_annotation_copy_path(source_dataset_id)
        is_from_working_copy = False

        if working_copy_path and os.path.exists(working_copy_path):
            # 从工作副本读取
            logger.info(f"从工作副本导出: {working_copy_path}")
            input_path = working_copy_path
            is_from_working_copy = True
        else:
            # 从原始数据集读取
            file_path = source_dataset.get('file_path')
            storage_dir = Path(dataset_storage.storage_dir)
            full_path = storage_dir / file_path

            if not full_path.exists():
                return Response({'error': '源数据集文件不存在'}, status=status.HTTP_404_NOT_FOUND)

            input_path = str(full_path)

        # 创建新数据集
        dataset_id = dataset_storage._generate_id()
        output_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'storage', 'annotated_datasets')
        os.makedirs(output_dir, exist_ok=True)

        export_file = os.path.join(output_dir, f'{dataset_id}.jsonl')
        successful_count = 0

        with open(input_path, 'r', encoding='utf-8') as input_f, \
             open(export_file, 'w', encoding='utf-8') as output_f:

            for line_num, line in enumerate(input_f, 1):
                line = line.strip()
                if not line:
                    continue

                try:
                    dataset_item = json.loads(line)

                    if is_from_working_copy:
                        # 工作副本已经包含所有标注信息
                        item_id = dataset_item.get('id', f'{source_dataset_id}_{line_num}')

                        # 如果指定了 annotation_ids，只处理指定的项目
                        if annotation_ids and item_id not in annotation_ids:
                            continue

                        # 数据选择策略过滤
                        is_annotated = bool(
                            dataset_item.get('is_annotated', False) or
                            dataset_item.get('edited_content') or 
                            dataset_item.get('tags') or 
                            dataset_item.get('notes', '').strip() or
                            dataset_item.get('quality_rating')
                        )
                        
                        # 根据数据选择策略过滤
                        if data_selection == 'ANNOTATED' and not is_annotated:
                            continue
                        elif data_selection == 'UNANNOTATED' and is_annotated:
                            continue

                        # 质量评分过滤
                        item_quality = dataset_item.get('quality_rating')
                        if quality_threshold > 0:
                            if item_quality is None or item_quality < quality_threshold:
                                continue

                        # 根据导出格式决定内容 - 修复数据格式问题
                        if export_format == 'ORIGINAL':
                            content = dataset_item.get('original_content', {})
                        elif export_format == 'EDITED':
                            # 如果有编辑内容，使用编辑内容；否则使用原始内容
                            content = dataset_item.get('edited_content') or dataset_item.get('original_content', {})
                        elif export_format == 'MIXED':
                            # 混合格式：直接输出原始数据结构，不包装在data字段中
                            original_content = dataset_item.get('original_content', {})
                            edited_content = dataset_item.get('edited_content')
                            
                            if edited_content:
                                # 如果有编辑内容，使用编辑内容
                                content = edited_content
                            else:
                                # 如果没有编辑内容，使用原始内容
                                content = original_content
                                
                            # 添加标注元数据（如果启用）
                            if include_metadata:
                                content['_annotation_metadata'] = {
                                    'tags': dataset_item.get('tags', []),
                                    'notes': dataset_item.get('notes', ''),
                                    'quality_rating': dataset_item.get('quality_rating'),
                                    'intent': dataset_item.get('intent'),
                                    'roles': dataset_item.get('roles', {}),
                                    'custom_fields': dataset_item.get('custom_fields', {}),
                                    'annotation_metadata': dataset_item.get('annotation_metadata')
                                }
                        else:
                            # 默认：优先使用编辑内容，没有则使用原始内容
                            content = dataset_item.get('edited_content') or dataset_item.get('original_content', {})

                        # 添加原始ID信息到内容中
                        if include_original_id:
                            content['_original_dataset_id'] = source_dataset_id
                        
                        if include_original_item_id:
                            content['_original_item_id'] = item_id
                            
                        content['_line_number'] = line_num

                        output_f.write(json.dumps(content, ensure_ascii=False) + '\n')
                        successful_count += 1
                    else:
                        # 原始数据集逻辑（修复格式一致性）
                        original_data = dataset_item
                        item_id = f'{source_dataset_id}_{line_num}'

                        # 数据选择策略过滤（原始数据只有未标注的）
                        if data_selection == 'ANNOTATED':
                            continue

                        if not annotation_ids or item_id in annotation_ids:
                            # 直接输出原始数据，不包装在data字段中
                            content = original_data
                            
                            # 添加原始ID信息到内容中
                            if include_original_id:
                                content['_original_dataset_id'] = source_dataset_id
                            
                            if include_original_item_id:
                                content['_original_item_id'] = item_id
                                
                            content['_line_number'] = line_num

                            output_f.write(json.dumps(content, ensure_ascii=False) + '\n')
                            successful_count += 1

                except json.JSONDecodeError:
                    continue

        # 创建数据集记录
        size_bytes = os.path.getsize(export_file)
        dataset_record = dataset_storage.create_dataset({
            'id': dataset_id,
            'name': new_dataset_name,
            'description': f"从标注导出 - {new_dataset_description}",
            'data_type': data_type,
            'source': 'ANNOTATION_V2',
            'file_path': os.path.join('annotated_datasets', f'{dataset_id}.jsonl'),
            'file_name': f'{dataset_id}.jsonl',
            'file_format': 'jsonl',
            'size_bytes': size_bytes,
            'item_count': successful_count,
            'source_dataset_id': source_dataset_id
        })

        return Response({
            'id': dataset_id,
            'name': new_dataset_name,
            'data_type': data_type,
            'source': 'ANNOTATION_V2',
            'source_dataset_id': source_dataset_id,
            'item_count': successful_count,
            'file_count': 1,
            'size_bytes': size_bytes,
            'created_at': dataset_record.get('created_at'),
            'export_config': {
                'data_selection': data_selection,
                'quality_threshold': quality_threshold,
                'export_format': export_format,
                'include_original_id': include_original_id,
                'include_original_item_id': include_original_item_id,
                'include_metadata': include_metadata
            },
            'message': f'成功导出标注数据集，包含{successful_count}条数据'
        }, status=status.HTTP_201_CREATED)

    except Exception as e:
        logger.error(f"导出标注数据集失败: {e}", exc_info=True)
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
def get_annotation_progress(request, dataset_id):
    """
    获取标注进度统计

    参数:
        dataset_id: 数据集ID

    返回:
        - total_items: 总项目数
        - annotated_items: 已标注项目数
        - progress: 进度百分比
        - quality_distribution: 质量评分分布
        - tag_distribution: 标签分布
    """
    try:
        # 获取数据集信息计算总数
        dataset = dataset_storage.get_dataset(dataset_id)
        if not dataset:
            return Response({'error': '数据集不存在'}, status=status.HTTP_404_NOT_FOUND)

        file_path = dataset.get('file_path')
        if not file_path:
            return Response({'error': '数据集文件路径不存在'}, status=status.HTTP_404_NOT_FOUND)

        # 计算总行数
        storage_dir = Path(dataset_storage.storage_dir)
        full_path = storage_dir / file_path

        if not full_path.exists():
            return Response({'error': '数据集文件不存在'}, status=status.HTTP_404_NOT_FOUND)

        with open(full_path, 'r', encoding='utf-8') as f:
            total_items = sum(1 for line in f if line.strip())

        # 读取标注数据
        annotation_file = os.path.join(ANNOTATION_V2_DIR, f'{dataset_id}_annotations.jsonl')
        annotated_items = 0
        quality_distribution = {}
        tag_distribution = {}

        if os.path.exists(annotation_file):
            with open(annotation_file, 'r', encoding='utf-8') as f:
                for line in f:
                    if line.strip():
                        try:
                            annotation = json.loads(line.strip())
                            annotation_data = annotation.get('annotation_data', {})

                            annotated_items += 1

                            # 统计质量评分
                            quality = annotation_data.get('quality_rating')
                            if quality:
                                quality_distribution[str(quality)] = quality_distribution.get(str(quality), 0) + 1

                            # 统计标签
                            tags = annotation_data.get('tags', [])
                            for tag in tags:
                                tag_distribution[tag] = tag_distribution.get(tag, 0) + 1

                        except json.JSONDecodeError:
                            pass

        return Response({
            'dataset_id': dataset_id,
            'total_items': total_items,
            'annotated_items': annotated_items,
            'progress': round(annotated_items / total_items * 100, 2) if total_items > 0 else 0,
            'quality_distribution': quality_distribution,
            'tag_distribution': tag_distribution,
            'last_update': datetime.now().isoformat()
        })

    except Exception as e:
        logger.error(f"获取标注进度失败: {e}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
def get_annotated_datasets(request):
    """
    获取所有已标注的数据集列表（工作副本）

    返回:
    {
        "datasets": [
            {
                "dataset_id": string,
                "dataset_name": string,
                "copy_path": string,
                "created_at": string,
                "last_updated": string,
                "item_count": number,
                "progress": number,
                "data_type": string,
                "annotated_items": number
            }
        ]
    }
    """
    try:
        datasets = []

        # 检查元数据文件
        if not os.path.exists(ANNOTATION_COPY_METADATA_FILE):
            # 如果没有元数据文件，扫描目录
            if os.path.exists(ANNOTATION_WORKING_COPIES_DIR):
                for filename in os.listdir(ANNOTATION_WORKING_COPIES_DIR):
                    if filename.endswith('_annotated_copy_') and filename.endswith('.jsonl'):
                        # 提取数据集ID
                        dataset_id = filename.split('_annotated_copy_')[0]
                        copy_path = os.path.join(ANNOTATION_WORKING_COPIES_DIR, filename)

                        # 获取基础数据集信息
                        dataset = dataset_storage.get_dataset(dataset_id)

                        # 统计项目数量
                        item_count = 0
                        annotated_count = 0
                        if os.path.exists(copy_path):
                            with open(copy_path, 'r', encoding='utf-8') as f:
                                for line in f:
                                    if line.strip():
                                        try:
                                            item = json.loads(line.strip())
                                            item_count += 1
                                            # 检查是否有标注
                                            if (item.get('edited_content') or
                                                item.get('tags') or
                                                item.get('notes', '').strip() or
                                                item.get('quality_rating') or
                                                item.get('is_annotated', False)):
                                                annotated_count += 1
                                        except json.JSONDecodeError:
                                            continue

                        # 计算进度
                        progress = round(annotated_count / item_count * 100, 2) if item_count > 0 else 0

                        datasets.append({
                            'dataset_id': dataset_id,
                            'dataset_name': dataset.get('name', f'数据集 {dataset_id[:8]}...'),
                            'copy_path': copy_path,
                            'created_at': None,  # 从文件名提取时间戳时无法获取完整信息
                            'last_updated': None,
                            'item_count': item_count,
                            'progress': progress,
                            'data_type': dataset.get('data_type') if dataset else 'UNKNOWN',
                            'annotated_items': annotated_count
                        })
        else:
            # 从元数据文件读取
            with open(ANNOTATION_COPY_METADATA_FILE, 'r', encoding='utf-8') as f:
                metadata = json.load(f)

            for dataset_id, copy_info in metadata.items():
                if isinstance(copy_info, dict) and copy_info.get('status') == 'active':
                    # 获取基础数据集信息
                    dataset = dataset_storage.get_dataset(dataset_id)

                    # 统计标注数量
                    annotated_count = 0
                    copy_path = copy_info['copy_path']

                    if os.path.exists(copy_path):
                        with open(copy_path, 'r', encoding='utf-8') as f:
                            for line in f:
                                if line.strip():
                                    try:
                                        item = json.loads(line.strip())
                                        # 检查是否有标注
                                        if (item.get('edited_content') or
                                            item.get('tags') or
                                            item.get('notes', '').strip() or
                                            item.get('quality_rating') or
                                            item.get('is_annotated', False)):
                                            annotated_count += 1
                                    except json.JSONDecodeError:
                                        continue

                    # 计算进度
                    item_count = copy_info.get('item_count', 0)
                    progress = round(annotated_count / item_count * 100, 2) if item_count > 0 else 0

                    datasets.append({
                        'dataset_id': dataset_id,
                        'dataset_name': dataset.get('name', f'数据集 {dataset_id[:8]}...'),
                        'copy_path': copy_info['copy_path'],
                        'created_at': copy_info.get('created_at'),
                        'last_updated': copy_info.get('last_updated'),
                        'item_count': item_count,
                        'progress': progress,
                        'data_type': dataset.get('data_type') if dataset else 'UNKNOWN',
                        'annotated_items': annotated_count
                    })

        # 按照最后更新时间排序
        datasets.sort(key=lambda x: x['last_updated'] or '', reverse=True)

        return Response({
            'datasets': datasets,
            'count': len(datasets)
        })

    except Exception as e:
        logger.error(f"获取已标注数据集列表失败: {e}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
def batch_mark_complete(request):
    """
    批量标记标注完成状态

    请求参数:
    {
        "dataset_id": string,
        "item_ids": [string], // 可选，不传则标记当前页所有
        "mark_as_annotated": true
    }
    """
    try:
        dataset_id = request.data.get('dataset_id')
        item_ids = request.data.get('item_ids', [])
        mark_as_annotated = request.data.get('mark_as_annotated', True)

        if not dataset_id:
            return Response({'error': 'dataset_id 是必填参数'}, status=status.HTTP_400_BAD_REQUEST)

        # 获取标注工作副本路径
        copy_path = _get_annotation_copy_path(dataset_id)
        if not copy_path or not os.path.exists(copy_path):
            return Response({'error': '标注工作副本不存在'}, status=status.HTTP_404_NOT_FOUND)

        # 初始化元信息管理器
        metadata_manager = AnnotationMetadataManager(ANNOTATION_WORKING_COPIES_DIR)
        
        # 加载工作副本文件
        items = []
        with open(copy_path, 'r', encoding='utf-8') as f:
            for line in f:
                if line.strip():
                    try:
                        items.append(json.loads(line.strip()))
                    except json.JSONDecodeError:
                        continue

        # 更新标注状态
        updated_count = 0
        current_time = datetime.now().isoformat()
        annotator_id = request.user.username if hasattr(request, 'user') else 'anonymous'

        for item in items:
            # 如果指定了item_ids，只更新指定的项目
            if item_ids and item.get('id') not in item_ids:
                continue

            # 更新is_annotated字段
            item['is_annotated'] = mark_as_annotated
            
            # 更新标注元数据
            if not item['annotation_metadata']['created_at']:
                item['annotation_metadata']['created_at'] = current_time
            item['annotation_metadata']['last_updated'] = current_time
            item['annotation_metadata']['version'] = (item['annotation_metadata'].get('version', 0) or 0) + 1
            item['annotation_metadata']['annotator_id'] = annotator_id

            updated_count += 1
            
        # 计算已标注数量
        annotated_count = len([item for item in items 
                             if item.get('is_annotated', False)])
        
        # 更新统计数据
        metadata_manager.update_annotation_stats(
            dataset_id=dataset_id,
            total_annotated=annotated_count,
            annotator_id=annotator_id,
            has_edits=bool(item.get('edited_content')),
            tags_count=len(item.get('tags', [])),
            quality_rating=item.get('quality_rating'),
            notes_length=len(item.get('notes', ''))
        )

        # 保存回文件
        with open(copy_path, 'w', encoding='utf-8') as f:
            for item in items:
                f.write(json.dumps(item, ensure_ascii=False) + '\n')

        return Response({
            'success': True,
            'message': f'成功标记 {updated_count} 条数据为{"已标注" if mark_as_annotated else "未标注"}',
            'updated_count': updated_count,
            'mark_as_annotated': mark_as_annotated,
            'timestamp': current_time
        })

    except Exception as e:
        logger.error(f"批量标记完成状态失败: {e}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
def mark_complete(request):
    """
    单个标记标注完成状态

    请求参数:
    {
        "dataset_id": string,
        "item_id": string,
        "mark_as_annotated": true
    }
    """
    try:
        dataset_id = request.data.get('dataset_id')
        item_id = request.data.get('item_id')
        mark_as_annotated = request.data.get('mark_as_annotated', True)

        if not all([dataset_id, item_id]):
            return Response({'error': 'dataset_id 和 item_id 是必填参数'},
                          status=status.HTTP_400_BAD_REQUEST)

        # 获取标注工作副本路径
        copy_path = _get_annotation_copy_path(dataset_id)
        if not copy_path or not os.path.exists(copy_path):
            return Response({'error': '标注工作副本不存在'}, status=status.HTTP_404_NOT_FOUND)

        # 初始化元信息管理器
        metadata_manager = AnnotationMetadataManager(ANNOTATION_WORKING_COPIES_DIR)
        
        # 加载工作副本文件
        items = []
        with open(copy_path, 'r', encoding='utf-8') as f:
            for line in f:
                if line.strip():
                    try:
                        items.append(json.loads(line.strip()))
                    except json.JSONDecodeError:
                        continue

        # 查找并更新指定项目
        item_found = False
        current_time = datetime.now().isoformat()
        annotator_id = request.user.username if hasattr(request, 'user') else 'anonymous'

        for item in items:
            if item.get('id') == item_id:
                # 更新is_annotated字段
                item['is_annotated'] = mark_as_annotated
                
                # 更新标注元数据
                if not item['annotation_metadata']['created_at']:
                    item['annotation_metadata']['created_at'] = current_time
                item['annotation_metadata']['last_updated'] = current_time
                item['annotation_metadata']['version'] = (item['annotation_metadata'].get('version', 0) or 0) + 1
                item['annotation_metadata']['annotator_id'] = annotator_id

                item_found = True
                
                # 计算已标注数量
                annotated_count = len([item for item in items 
                                     if item.get('is_annotated', False)])
                
                # 更新统计数据
                metadata_manager.update_annotation_stats(
                    dataset_id=dataset_id,
                    total_annotated=annotated_count,
                    annotator_id=annotator_id,
                    has_edits=bool(item.get('edited_content')),
                    tags_count=len(item.get('tags', [])),
                    quality_rating=item.get('quality_rating'),
                    notes_length=len(item.get('notes', ''))
                )
                break

        if not item_found:
            return Response({'error': '未找到指定的标注项目'}, status=status.HTTP_404_NOT_FOUND)

        # 保存回文件
        with open(copy_path, 'w', encoding='utf-8') as f:
            for item in items:
                f.write(json.dumps(item, ensure_ascii=False) + '\n')

        return Response({
            'success': True,
            'message': f'成功标记为{"已标注" if mark_as_annotated else "未标注"}',
            'item_id': item_id,
            'mark_as_annotated': mark_as_annotated,
            'timestamp': current_time
        })

    except Exception as e:
        logger.error(f"标记完成状态失败: {e}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
def unmark_complete(request):
    """
    撤销标注完成状态（兼容接口，与mark_complete功能相同，mark_as_annotated=false）

    请求参数:
    {
        "dataset_id": string,
        "item_id": string
    }
    """
    try:
        dataset_id = request.data.get('dataset_id')
        item_id = request.data.get('item_id')

        if not all([dataset_id, item_id]):
            return Response({'error': 'dataset_id 和 item_id 是必填参数'},
                          status=status.HTTP_400_BAD_REQUEST)

        # 获取标注工作副本路径
        copy_path = _get_annotation_copy_path(dataset_id)
        if not copy_path or not os.path.exists(copy_path):
            return Response({'error': '标注工作副本不存在'}, status=status.HTTP_404_NOT_FOUND)

        # 初始化元信息管理器
        metadata_manager = AnnotationMetadataManager(ANNOTATION_WORKING_COPIES_DIR)
        
        # 加载工作副本文件
        items = []
        with open(copy_path, 'r', encoding='utf-8') as f:
            for line in f:
                if line.strip():
                    try:
                        items.append(json.loads(line.strip()))
                    except json.JSONDecodeError:
                        continue

        # 查找并更新指定项目
        item_found = False
        current_time = datetime.now().isoformat()
        annotator_id = request.user.username if hasattr(request, 'user') else 'anonymous'

        for item in items:
            if item.get('id') == item_id:
                # 更新is_annotated字段为False
                item['is_annotated'] = False
                
                # 更新标注元数据
                if not item['annotation_metadata']['created_at']:
                    item['annotation_metadata']['created_at'] = current_time
                item['annotation_metadata']['last_updated'] = current_time
                item['annotation_metadata']['version'] = (item['annotation_metadata'].get('version', 0) or 0) + 1
                item['annotation_metadata']['annotator_id'] = annotator_id

                item_found = True
                
                # 计算已标注数量
                annotated_count = len([item for item in items 
                                     if item.get('is_annotated', False)])
                
                # 更新统计数据
                metadata_manager.update_annotation_stats(
                    dataset_id=dataset_id,
                    total_annotated=annotated_count,
                    annotator_id=annotator_id,
                    has_edits=bool(item.get('edited_content')),
                    tags_count=len(item.get('tags', [])),
                    quality_rating=item.get('quality_rating'),
                    notes_length=len(item.get('notes', ''))
                )
                break

        if not item_found:
            return Response({'error': '未找到指定的标注项目'}, status=status.HTTP_404_NOT_FOUND)

        # 保存回文件
        with open(copy_path, 'w', encoding='utf-8') as f:
            for item in items:
                f.write(json.dumps(item, ensure_ascii=False) + '\n')

        return Response({
            'success': True,
            'message': '成功撤销标注完成状态',
            'item_id': item_id,
            'mark_as_annotated': False,
            'timestamp': current_time
        })

    except Exception as e:
        logger.error(f"撤销标注完成状态失败: {e}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)