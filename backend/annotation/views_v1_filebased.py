import os
import json
import uuid
import logging
from datetime import datetime
from pathlib import Path
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.conf import settings
from django.http import JsonResponse, HttpResponseBadRequest
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from django.core.files.storage import default_storage
from coevoloop.dataset_views import dataset_storage

logger = logging.getLogger(__name__)

# 获取基础目录
try:
    BASE_DIR = settings.BASE_DIR
except AttributeError:
    # 如果Django设置未配置，使用环境变量或默认值
    BASE_DIR = os.environ.get('DJANGO_BASE_DIR', '/Users/zhouyuhong/jobproject2/fintlai-server/backend')

# 存储目录
ANNOTATION_V1_DIR = os.path.join(BASE_DIR, 'storage', 'annotation_v1')
ANNOTATION_WORKING_COPIES_DIR = os.path.join(BASE_DIR, 'storage', 'annotation_working_copies')
ANNOTATION_DATASETS_DIR = os.path.join(BASE_DIR, 'storage', 'annotated_datasets')
METADATA_FILE = os.path.join(ANNOTATION_V1_DIR, 'metadata.json')

# 确保目录存在
os.makedirs(ANNOTATION_V1_DIR, exist_ok=True)
os.makedirs(ANNOTATION_WORKING_COPIES_DIR, exist_ok=True)
os.makedirs(ANNOTATION_DATASETS_DIR, exist_ok=True)

def _get_annotation_file_path(dataset_id, create_if_missing=False):
    """
    获取 v1 风格 的标注文件路径
    """
    annotation_file = os.path.join(ANNOTATION_V1_DIR, f"{dataset_id}_annotations.jsonl")

    if create_if_missing and not os.path.exists(annotation_file):
        # 如果文件不存在且需要创建，则创建空文件
        with open(annotation_file, 'w', encoding='utf-8') as f:
            pass

    return annotation_file if os.path.exists(annotation_file) else None

def _create_initial_annotation_file(dataset_id):
    """
    从原始数据集文件创建初始标注文件
    """
    # 获取数据集信息
    dataset = dataset_storage.get_dataset(dataset_id)
    if not dataset:
        raise ValueError(f"Dataset {dataset_id} not found")

    # 读取原始数据文件
    storage_dir = Path(dataset_storage.storage_dir)
    file_path = storage_dir / dataset.get('file_path')

    if not file_path.exists():
        raise ValueError(f"Source dataset file not found: {file_path}")

    # 确保标注目录存在
    os.makedirs(ANNOTATION_V1_DIR, exist_ok=True)

    # 创建标注文件
    annotation_file = _get_annotation_file_path(dataset_id, create_if_missing=True)

    # 读取原始数据并转换为标注格式
    with open(file_path, 'r', encoding='utf-8') as src, \
         open(annotation_file, 'w', encoding='utf-8') as dest:

        for line_idx, line in enumerate(src):
            if line.strip():
                data = json.loads(line.strip())

                # 获取对话内容，兼容多种格式
                conversations = data.get('conversations', data.get('conversation', data.get('messages', [])))
                conversation_id = data.get('conversation_id', f'conv_{line_idx}')

                # 创建标注记录
                annotation = {
                    'id': str(uuid.uuid4()),
                    'dataset_id': dataset_id,
                    'conversation_id': conversation_id,
                    'sample_index': line_idx,
                    'original_data': {'conversations': conversations},
                    'edited_data': None,
                    'quality_score': None,
                    'accuracy': None,
                    'category': None,
                    'tags': [],
                    'notes': '',
                    'is_annotated': False,
                    'annotation_time': None,
                    'annotated_by': None,
                    'created_at': datetime.now().isoformat(),
                    'updated_at': datetime.now().isoformat()
                }

                # 写入标注文件
                dest.write(json.dumps(annotation, ensure_ascii=False) + '\n')

    logger.info(f"Created initial annotation file for dataset {dataset_id} with {line_idx + 1} items")

def _save_annotation_record(dataset_id, annotation_data):
    """
    保存或更新标注记录
    """
    annotation_file = _get_annotation_file_path(dataset_id, create_if_missing=True)

    # 读取现有标注
    existing_annotations = {}
    if os.path.exists(annotation_file):
        with open(annotation_file, 'r', encoding='utf-8') as f:
            for line in f:
                if line.strip():
                    record = json.loads(line.strip())
                    existing_annotations[record['id']] = record

    # 更新或添加新标注
    existing_annotations[annotation_data['id']] = annotation_data

    # 写回文件
    with open(annotation_file, 'w', encoding='utf-8') as f:
        for record in existing_annotations.values():
            f.write(json.dumps(record, ensure_ascii=False) + '\n')

    return annotation_data

def _get_annotation_by_ids(dataset_id, conversation_id, sample_index):
    """
    根据数据集ID、对话ID和样本索引获取标注记录
    """
    annotation_file = _get_annotation_file_path(dataset_id)
    if not annotation_file:
        return None

    with open(annotation_file, 'r', encoding='utf-8') as f:
        for line in f:
            if line.strip():
                record = json.loads(line.strip())
                if (record.get('dataset_id') == dataset_id and
                    record.get('conversation_id') == conversation_id and
                    record.get('sample_index') == sample_index):
                    return record

    return None

def _get_all_annotations(dataset_id):
    """
    获取数据集的所有标注
    """
    annotation_file = _get_annotation_file_path(dataset_id)
    annotations = []

    if annotation_file:
        with open(annotation_file, 'r', encoding='utf-8') as f:
            for line in f:
                if line.strip():
                    annotations.append(json.loads(line.strip()))

    return annotations

def _get_conversation_list(dataset_id, page=1, page_size=20):
    """
    获取对话列表（支持分页）- 文件存储版本
    """
    # 直接从标注文件读取
    annotation_file = _get_annotation_file_path(dataset_id)

    # 如果标注文件不存在，自动创建
    if not annotation_file or not os.path.exists(annotation_file):
        logger.info(f"No annotation file found for dataset {dataset_id}, creating initial annotation file")
        try:
            _create_initial_annotation_file(dataset_id)
            annotation_file = _get_annotation_file_path(dataset_id)
        except Exception as e:
            logger.error(f"Failed to create initial annotation file for dataset {dataset_id}: {e}")
            # 即使创建失败，也返回空列表而不是报错
            return {
                'conversations': [],
                'pagination': {
                    'page': 1,
                    'page_size': page_size,
                    'total': 0,
                    'total_pages': 0,
                    'has_next': False,
                    'has_previous': False
                }
            }

    conversations = []
    with open(annotation_file, 'r', encoding='utf-8') as f:
        for line in f:
            if line.strip():
                annotation = json.loads(line.strip())
                # 转换为对话格式
                original_data = annotation.get('original_data', {})
                conversations_data = original_data.get('conversations', original_data.get('conversation', original_data.get('messages', [{}])))
                preview = ""
                if conversations_data and len(conversations_data) > 0:
                    first_conv = conversations_data[0]
                    preview = first_conv.get('value', first_conv.get('content', first_conv.get('text', '')))[:50]
                    if len(original_data.get('conversations', original_data.get('conversation', []))) > 0:
                        preview = preview + "..."

                conversations.append({
                    'id': annotation['id'],
                    'dataset_id': dataset_id,  # 从请求参数获取
                    'conversation_id': annotation['conversation_id'],
                    'sample_index': annotation['sample_index'],
                    'original_data': original_data,
                    'preview': preview,
                    'is_annotated': annotation.get('is_annotated', False),
                    'quality_score': annotation.get('quality_score'),
                    'accuracy': annotation.get('accuracy'),
                    'category': annotation.get('category'),
                    'tags': annotation.get('tags', []),
                    'notes': annotation.get('notes', ''),
                    'updated_at': annotation.get('updated_at'),
                })

    # 分页处理
    total = len(conversations)
    start = (page - 1) * page_size
    end = start + page_size

    return {
        'conversations': conversations[start:end],
        'pagination': {
            'page': page,
            'page_size': page_size,
            'total': total,
            'total_pages': (total + page_size - 1) // page_size,
            'has_next': end < total,
            'has_previous': start > 0
        }
    }

@api_view(['GET'])
@permission_classes([AllowAny])
def list_conversations_v1(request):
    """
    获取对话列表（v1 文件存储版本）
    """
    dataset_id = request.query_params.get('dataset_id')
    page = int(request.query_params.get('page', 1))
    page_size = min(int(request.query_params.get('page_size', 20)), 100)

    if not dataset_id:
        return Response({'error': 'dataset_id is required'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        result = _get_conversation_list(dataset_id, page, page_size)
        return Response(result)
    except Exception as e:
        logger.error(f"Failed to get conversations: {e}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
@permission_classes([AllowAny])
def get_conversation_v1(request):
    """
    获取单个对话详情（v1 文件存储版本）
    """
    dataset_id = request.query_params.get('dataset_id')
    sample_index = int(request.query_params.get('sample_index'))

    if not dataset_id or sample_index is None:
        return Response({'error': 'dataset_id and sample_index are required'},
                       status=status.HTTP_400_BAD_REQUEST)

    try:
        # 获取原始数据集
        dataset = dataset_storage.get_dataset(dataset_id)
        if not dataset:
            return Response({'error': 'Dataset not found'}, status=status.HTTP_404_NOT_FOUND)

        # 读取原始数据
        storage_dir = Path(dataset_storage.storage_dir)
        file_path = storage_dir / dataset.get('file_path')

        conversations = []
        with open(file_path, 'r', encoding='utf-8') as f:
            for line_num, line in enumerate(f, 1):
                if line.strip() and line_num - 1 == sample_index:
                    data = json.loads(line.strip())
                    conversations = data.get('conversations', data.get('conversation', data.get('messages', [])))
                    break

        # 获取标注
        annotation = _get_annotation_by_ids(
            dataset_id,
            data.get('conversation_id', f'conv_{sample_index}'),
            sample_index
        )

        if annotation:
            return Response(annotation)
        else:
            # 创建新的标注记录
            new_annotation = {
                'id': str(uuid.uuid4()),
                'dataset_id': dataset_id,
                'conversation_id': data.get('conversation_id', f'conv_{sample_index}'),
                'sample_index': sample_index,
                'original_data': {'conversations': conversations},
                'edited_data': None,
                'quality_score': None,
                'accuracy': None,
                'category': None,
                'tags': [],
                'notes': '',
                'is_annotated': False,
                'created_at': datetime.now().isoformat(),
                'updated_at': datetime.now().isoformat(),
            }
            return Response(new_annotation)

    except Exception as e:
        logger.error(f"Failed to get conversation: {e}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
@permission_classes([AllowAny])
def save_annotation_v1(request):
    """
    保存标注数据（v1 文件存储版本）
    """
    try:
        data = request.data
        dataset_id = data.get('dataset_id')
        conversation_id = data.get('conversation_id')
        sample_index = data.get('sample_index')

        if not all([dataset_id, conversation_id, sample_index is not None]):
            return Response(
                {'error': 'dataset_id, conversation_id, and sample_index are required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 创建或更新标注记录
        annotation_data = {
            'id': data.get('id', str(uuid.uuid4())),
            'dataset_id': dataset_id,
            'conversation_id': conversation_id,
            'sample_index': sample_index,
            'original_data': data.get('original_data', {}),
            'edited_data': data.get('edited_data'),
            'quality_score': data.get('quality_score'),
            'accuracy': data.get('accuracy'),
            'category': data.get('category'),
            'tags': data.get('tags', []),
            'notes': data.get('notes', ''),
            'is_annotated': True,
            'annotated_by': data.get('annotated_by', 'current_user'),
            'annotation_time': data.get('annotation_time', datetime.now().isoformat()),
            'created_at': data.get('created_at', datetime.now().isoformat()),
            'updated_at': datetime.now().isoformat(),
        }

        saved_annotation = _save_annotation_record(dataset_id, annotation_data)

        return Response(saved_annotation)

    except Exception as e:
        logger.error(f"Failed to save annotation: {e}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
@permission_classes([AllowAny])
def get_annotation_stats_v1(request):
    """
    获取标注统计（v1 文件存储版本）
    """
    try:
        dataset_id = request.query_params.get('dataset_id')

        if dataset_id:
            # 获取特定数据集的统计
            annotations = _get_all_annotations(dataset_id)

            stats = {
                'total': len(annotations),
                'annotated': len([a for a in annotations if a.get('is_annotated', False)]),
                'pending': len([a for a in annotations if not a.get('is_annotated', False)]),
                'quality_distribution': {},
                'accuracy_distribution': {}
            }

            # 计算质量分布
            for annotation in annotations:
                if annotation.get('quality_score'):
                    score = str(annotation['quality_score'])
                    stats['quality_distribution'][score] = stats['quality_distribution'].get(score, 0) + 1

                if annotation.get('accuracy'):
                    acc = annotation['accuracy']
                    stats['accuracy_distribution'][acc] = stats['accuracy_distribution'].get(acc, 0) + 1
        else:
            # 获取全局统计
            stats = {
                'total': 0,
                'annotated': 0,
                'pending': 0,
                'quality_distribution': {},
                'accuracy_distribution': {}
            }

            # 扫描所有标注文件
            for filename in os.listdir(ANNOTATION_V1_DIR):
                if filename.endswith('_annotations.jsonl'):
                    dataset_id = filename[:-len('_annotations.jsonl')]
                    dataset_stats = _get_all_annotations(dataset_id)
                    stats['total'] += len(dataset_stats)
                    stats['annotated'] += len([a for a in dataset_stats if a.get('is_annotated', False)])

        stats['pending'] = stats['total'] - stats['annotated']

        return Response(stats)

    except Exception as e:
        logger.error(f"Failed to get stats: {e}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
@permission_classes([AllowAny])
def get_annotated_conversations_v1(request):
    """
    获取已标注的对话（v1 文件存储版本）
    """
    dataset_id = request.query_params.get('dataset_id')
    filters = {
        'min_quality_score': request.query_params.get('min_quality_score'),
        'accuracy': request.query_params.get('accuracy', '').split(',') if request.query_params.get('accuracy') else None,
        'category': request.query_params.get('category', '').split(',') if request.query_params.get('category') else None,
        'annotator': request.query_params.get('annotator', '').split(',') if request.query_params.get('annotator') else None,
    }

    try:
        annotations = _get_all_annotations(dataset_id)

        # 过滤
        filtered_annotations = []
        for annotation in annotations:
            if not annotation.get('is_annotated', False):
                continue

            # 质量分数过滤
            if filters['min_quality_score']:
                if not annotation.get('quality_score') or annotation['quality_score'] < int(filters['min_quality_score']):
                    continue

            # 准确性过滤
            if filters['accuracy']:
                if annotation.get('accuracy') not in filters['accuracy']:
                    continue

            # 分类过滤
            if filters['category']:
                if annotation.get('category') not in filters['category']:
                    continue

            filtered_annotations.append(annotation)

        return Response(filtered_annotations)

    except Exception as e:
        logger.error(f"Failed to get annotated conversations: {e}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
@permission_classes([AllowAny])
def create_dataset_from_annotations_v1(request):
    """
    从标注数据创建新数据集（v1 文件存储版本）
    """
    try:
        name = request.data.get('name')
        description = request.data.get('description', '')
        source_dataset_id = request.data.get('source_dataset_id')

        if not name or not source_dataset_id:
            return Response(
                {'error': 'name and source_dataset_id are required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 获取源数据集信息
        source_dataset = dataset_storage.get_dataset(source_dataset_id)
        if not source_dataset:
            return Response({'error': 'Source dataset not found'}, status=status.HTTP_404_NOT_FOUND)

        # 获取所有标注
        annotations = _get_all_annotations(source_dataset_id)
        annotated_items = [a for a in annotations if a.get('is_annotated', False)]

        if not annotated_items:
            return Response({'error': 'No annotated items found'}, status=status.HTTP_400_BAD_REQUEST)

        # 创建新数据集文件
        dataset_id = str(uuid.uuid4())
        dataset_type = source_dataset.get('data_type', 'DIALOGUE')
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"{dataset_type.lower()}_annotated_{timestamp}.jsonl"

        # 写入标注的数据
        file_path = os.path.join(ANNOTATION_DATASETS_DIR, filename)
        with open(file_path, 'w', encoding='utf-8') as f:
            for annotation in annotated_items:
                # 使用编辑后的数据，如果没有则使用原始数据
                content = annotation.get('edited_data', annotation.get('original_data', {}))

                dataset_item = {
                    'id': annotation['id'],
                    'source_dataset_id': source_dataset_id,
                    'source_conversation_id': annotation['conversation_id'],
                    'content': content,
                    'annotation_metadata': {
                        'quality_score': annotation.get('quality_score'),
                        'accuracy': annotation.get('accuracy'),
                        'category': annotation.get('category'),
                        'tags': annotation.get('tags', []),
                        'notes': annotation.get('notes', ''),
                        'annotated_by': annotation.get('annotated_by'),
                        'annotation_time': annotation.get('annotation_time'),
                    }
                }

                f.write(json.dumps(dataset_item, ensure_ascii=False) + '\n')

        # 保存数据集元信息
        new_dataset = {
            'id': dataset_id,
            'name': name,
            'description': description,
            'data_type': dataset_type,
            'file_path': filename,
            'source_dataset_id': source_dataset_id,
            'total_samples': len(annotated_items),
            'created_at': datetime.now().isoformat(),
        }

        # 更新元数据文件
        metadata = []
        metadata_file = os.path.join(ANNOTATION_DATASETS_DIR, 'metadata.json')
        if os.path.exists(metadata_file):
            with open(metadata_file, 'r', encoding='utf-8') as f:
                metadata = json.load(f)

        metadata.append(new_dataset)

        with open(metadata_file, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, ensure_ascii=False, indent=2)

        return Response({
            'id': dataset_id,
            'name': name,
            'description': description,
            'data_type': dataset_type,
            'total_samples': len(annotated_items),
            'file_path': file_path,
            'created_at': new_dataset['created_at']
        })

    except Exception as e:
        logger.error(f"Failed to create dataset from annotations: {e}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
@permission_classes([AllowAny])
def get_annotation_relations_v1(request):
    """
    获取标注关联关系（v1 文件存储版本）
    """
    dataset_id = request.query_params.get('dataset_id')

    try:
        relations = []

        # 扫描所有标注数据集
        metadata_file = os.path.join(ANNOTATION_DATASETS_DIR, 'metadata.json')
        if os.path.exists(metadata_file):
            with open(metadata_file, 'r', encoding='utf-8') as f:
                datasets = json.load(f)

            for dataset in datasets:
                if dataset.get('source_dataset_id') == dataset_id:
                    relations.append({
                        'source_dataset_id': dataset_id,
                        'target_dataset_id': dataset['id'],
                        'target_dataset_name': dataset['name'],
                        'relation_type': 'annotation',
                        'item_count': dataset['total_samples'],
                        'created_at': dataset['created_at']
                    })

        return Response(relations)

    except Exception as e:
        logger.error(f"Failed to get annotation relations: {e}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
@permission_classes([AllowAny])
def save_annotation_relation_v1(request):
    """
    保存标注关联关系（v1 文件存储版本）
    """
    try:
        # 在 v1 文件存储版本中，关联关系通过数据集元数据管理
        # 这里暂时返回成功，实际的关联关系在 create_dataset_from_annotations_v1 中处理
        return Response({'success': True, 'message': 'Relation saved successfully'})

    except Exception as e:
        logger.error(f"Failed to save annotation relation: {e}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([AllowAny])
def get_in_progress_annotations_v1(request):
    """
    获取所有正在进行标注的数据集（v1 文件存储版本）
    """
    try:
        # 获取所有原始数据集
        datasets = dataset_storage.list_datasets()

        # 检查每个数据集是否有标注
        in_progress_datasets = []

        for dataset in datasets:
            dataset_id = dataset['id']
            annotation_file = _get_annotation_file_path(dataset_id)

            if annotation_file and os.path.exists(annotation_file):
                # 统计标注数据
                stats = _get_annotation_stats_filebased(dataset_id)

                if stats['annotated'] > 0:
                    # 获取数据集的基本信息
                    in_progress_datasets.append({
                        'dataset_id': dataset_id,
                        'dataset_name': dataset.get('name', f'Dataset {dataset_id[:8]}...'),
                        'data_type': dataset.get('data_type', 'DIALOGUE'),
                        'total_items': dataset.get('file_count', dataset.get('item_count', 0)),
                        'annotated_items': stats['annotated'],
                        'progress': stats['annotated'] / max(dataset.get('file_count', dataset.get('item_count', 1)), 1) * 100,
                        'last_updated': stats['last_updated'] or dataset.get('created_at', ''),
                        'annotation_file': annotation_file
                    })

        # 按最后更新时间排序
        in_progress_datasets.sort(key=lambda x: x['last_updated'] or '', reverse=True)

        return Response({
            'datasets': in_progress_datasets,
            'count': len(in_progress_datasets)
        })

    except Exception as e:
        logger.error(f"Failed to get in-progress annotations: {e}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


def _get_annotation_stats_filebased(dataset_id):
    """
    获取数据集的标注统计信息（文件存储版本）
    """
    annotation_file = _get_annotation_file_path(dataset_id)

    if not annotation_file or not os.path.exists(annotation_file):
        return {
            'total': 0,
            'annotated': 0,
            'pending': 0,
            'last_updated': None
        }

    annotated_count = 0
    last_updated = None

    with open(annotation_file, 'r', encoding='utf-8') as f:
        for line in f:
            if line.strip():
                annotation = json.loads(line.strip())
                if annotation.get('is_annotated', False):
                    annotated_count += 1

                    # 更新最后更新时间
                    updated_at = annotation.get('updated_at')
                    if updated_at and (not last_updated or updated_at > last_updated):
                        last_updated = updated_at

    return {
        'total': annotated_count,  # 在文件存储中，总记录数就是已读的记录数
        'annotated': annotated_count,
        'pending': 0,  # 在文件存储中，只有已标注的记录才会被存储
        'last_updated': last_updated
    }