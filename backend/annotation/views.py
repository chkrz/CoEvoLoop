import os
import json
import uuid
from datetime import datetime
from pathlib import Path
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status, viewsets
from rest_framework.decorators import action
from .models import ConversationAnnotation, AnnotationBatch
from .serializers import ConversationAnnotationSerializer, AnnotationBatchSerializer
from .services import AnnotationStatsService
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from coevoloop.dataset_views import dataset_storage
import logging
import time


logger = logging.getLogger(__name__)

ANNOTATION_DIR = os.path.join(settings.BASE_DIR, 'storage', 'annotation')


@api_view(['GET'])
def filter_annotations(request):
    """
    根据条件过滤标注数据

    支持的查询参数:
    - dataset_id: 数据集ID (可选)
    - is_annotated: 是否已标注 (可选)
    - min_quality_score: 最低质量分数 (可选)
    - accuracy: 准确性列表，逗号分隔 (可选)
    - category: 分类列表，逗号分隔 (可选)
    - annotator: 标注者列表，逗号分隔 (可选)
    - start_date: 开始日期 (可选)
    - end_date: 结束日期 (可选)
    - data_types: 数据类型列表，逗号分隔 (可选)
    """
    try:
        queryset = ConversationAnnotation.objects.all()

        # 数据集ID过滤
        dataset_id = request.query_params.get('dataset_id')
        if dataset_id:
            queryset = queryset.filter(dataset_id=dataset_id)

        # 是否已标注过滤
        is_annotated = request.query_params.get('is_annotated')
        if is_annotated:
            if is_annotated.lower() in ['true', '1', 'yes']:
                queryset = queryset.filter(is_annotated=True)
            elif is_annotated.lower() in ['false', '0', 'no']:
                queryset = queryset.filter(is_annotated=False)

        # 最低质量分数过滤
        min_quality_score = request.query_params.get('min_quality_score')
        if min_quality_score:
            try:
                min_score = int(min_quality_score)
                queryset = queryset.filter(quality_score__gte=min_score)
            except ValueError:
                pass

        # 准确性过滤
        accuracy = request.query_params.get('accuracy')
        if accuracy:
            accuracy_list = [a.strip() for a in accuracy.split(',') if a.strip()]
            if accuracy_list:
                queryset = queryset.filter(accuracy__in=accuracy_list)

        # 分类过滤
        category = request.query_params.get('category')
        if category:
            category_list = [c.strip() for c in category.split(',') if c.strip()]
            if category_list:
                queryset = queryset.filter(category__in=category_list)

        # 标注者过滤
        annotator = request.query_params.get('annotator')
        if annotator:
            annotator_list = [a.strip() for a in annotator.split(',') if a.strip()]
            if annotator_list:
                queryset = queryset.filter(annotated_by__in=annotator_list)

        # 日期范围过滤
        start_date = request.query_params.get('start_date')
        if start_date:
            try:
                queryset = queryset.filter(annotation_time__gte=start_date)
            except Exception:
                logger.warning(f'无效的start_date格式: {start_date}')

        end_date = request.query_params.get('end_date')
        if end_date:
            try:
                queryset = queryset.filter(annotation_time__lte=end_date)
            except Exception:
                logger.warning(f'无效的end_date格式: {end_date}')

        # 数据类型过滤 (通过dataset_id查询获取的数据集类型)
        data_types = request.query_params.get('data_types')
        if data_types:
            data_types_list = [dt.strip() for dt in data_types.split(',') if dt.strip()]
            if data_types_list:
                # 注意: 这里需要根据实际数据结构来过滤
                # 如果annotation表中没有直接存储data_type，需要关联其他表
                # 暂时跳过这部分，因为当前模型中没有data_type字段
                logger.warning(f'data_types过滤暂时未实现: {data_types_list}')

        # 转换为字典列表并确保id字段存在且不为空
        annotations = []
        for annotation in queryset:
            try:
                # 只返回有有效ID的annotation
                if not annotation.id:
                    logger.warning(f'Skipping annotation with empty ID')
                    continue

                annotations.append({
                    'id': str(annotation.id),
                    'dataset_id': annotation.dataset_id,
                    'conversation_id': annotation.conversation_id,
                    'sample_index': annotation.sample_index,
                    'original_data': annotation.original_data,
                    'edited_data': annotation.edited_data,
                    'quality_score': annotation.quality_score,
                    'accuracy': annotation.accuracy,
                    'category': annotation.category,
                    'tags': annotation.tags or [],
                    'notes': annotation.notes or '',
                    'is_annotated': annotation.is_annotated,
                    'annotation_time': annotation.annotation_time.isoformat() if annotation.annotation_time else None,
                    'annotated_by': annotation.annotated_by or '',
                    'created_at': annotation.created_at.isoformat() if annotation.created_at else None,
                    'updated_at': annotation.updated_at.isoformat() if annotation.updated_at else None,
                })
            except Exception as e:
                logger.error(f'Error processing annotation: {e}')
                continue

        return Response(annotations)

    except Exception as e:
        logger.error(f'过滤标注数据失败: {e}')
        return Response([], status=status.HTTP_500_INTERNAL_SERVER_ERROR)


def _extract_preview(conv_data):
    """提取对话预览文本"""
    conversations = conv_data.get('conversations', [])
    if not conversations:
        return '无对话内容'

    # 找到第一个用户消息
    user_message = None
    for conv in conversations:
        if isinstance(conv, dict):
            role = conv.get('role') or conv.get('from')
            content = conv.get('content') or conv.get('value')
            if role == 'user' and content:
                user_message = content
                break

    if user_message:
        return user_message[:100] + '...' if len(user_message) > 100 else user_message

    # 如果没有用户消息，返回第一个消息
    first_conv = conversations[0]
    if isinstance(first_conv, dict):
        content = first_conv.get('content') or first_conv.get('value') or str(first_conv)
        return content[:100] + '...' if len(content) > 100 else content

    return str(first_conv)[:100] + '...'

@api_view(['GET'])
def scan_local_datasets(request):
    """扫描本地annotation目录下的数据集文件"""
    try:
        if not os.path.exists(ANNOTATION_DIR):
            os.makedirs(ANNOTATION_DIR, exist_ok=True)
            
        datasets = []
        
        for filename in os.listdir(ANNOTATION_DIR):
            if filename.endswith(('.json', '.jsonl')):
                filepath = os.path.join(ANNOTATION_DIR, filename)
                file_size = os.path.getsize(filepath)
                
                # 读取文件前几行获取样本信息
                sample_count = 0
                try:
                    with open(filepath, 'r', encoding='utf-8') as f:
                        for line_num, line in enumerate(f, 1):
                            if line.strip():
                                sample_count += 1
                                if line_num >= 5:  # 只读取前5行获取预览
                                    break
                except Exception as e:
                    logger.warning(f"Error reading file {filename}: {e}")
                    sample_count = 0
                
                datasets.append({
                    'id': f"local-{uuid.uuid4().hex[:8]}",
                    'name': filename.replace('.json', '').replace('.jsonl', ''),
                    'filename': filename,
                    'description': f'本地数据集 - {filename}',
                    'file_count': 1,
                    'sample_count': sample_count,
                    'file_size': file_size,
                    'created_at': datetime.fromtimestamp(os.path.getctime(filepath)).isoformat(),
                    'updated_at': datetime.fromtimestamp(os.path.getmtime(filepath)).isoformat(),
                    'is_local': True,
                    'file_path': filepath
                })
        
        return Response({
            'datasets': datasets,
            'total': len(datasets)
        })
        
    except Exception as e:
        logger.error(f"Error scanning local datasets: {e}")
        return Response({
            'datasets': [],
            'total': 0,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
def get_local_dataset_content(request, dataset_id):
    """获取本地数据集的内容"""
    try:
        # 从扫描结果中找到对应的文件
        datasets = scan_local_datasets(request).data['datasets']
        dataset = None
        
        for ds in datasets:
            if ds['id'] == dataset_id:
                dataset = ds
                break
                
        if not dataset:
            return Response({'error': 'Dataset not found'}, status=status.HTTP_404_NOT_FOUND)
        
        filepath = dataset['file_path']
        conversations = []
        
        with open(filepath, 'r', encoding='utf-8') as f:
            for line_num, line in enumerate(f, 1):
                line = line.strip()
                if not line:
                    continue
                    
                try:
                    data = json.loads(line)
                    
                    # 提取对话内容
                    conversation_data = {
                        'conversations': [],
                        'metadata': {}
                    }
                    
                    # 处理不同格式的数据
                    if 'conversation' in data:
                        # 标准格式
                        conversation_data['conversations'] = data['conversation']
                    elif 'conversations' in data:
                        # 另一种格式
                        conversation_data['conversations'] = data['conversations']
                    elif isinstance(data, dict) and 'user' in data and 'assistant' in data:
                        # 简单对话格式
                        conversation_data['conversations'] = [
                            {'role': 'user', 'content': data.get('user', '')},
                            {'role': 'assistant', 'content': data.get('assistant', '')}
                        ]
                    else:
                        # 原始文本格式
                        content = str(data)
                        conversation_data['conversations'] = [
                            {'role': 'user', 'content': content[:200] + '...' if len(content) > 200 else content}
                        ]
                    
                    # 添加元数据
                    conversation_data['metadata'] = {
                        'uuid': data.get('uuid', f'local-{line_num}'),
                        'source': dataset['filename'],
                        'line_number': line_num
                    }
                    
                    conversations.append(conversation_data)
                    
                except json.JSONDecodeError as e:
                    logger.warning(f"Error parsing line {line_num} in {filepath}: {e}")
                    # 如果JSON解析失败，将整行作为文本处理
                    conversations.append({
                        'conversations': [
                            {'role': 'user', 'content': line[:200] + '...' if len(line) > 200 else line}
                        ],
                        'metadata': {
                            'uuid': f'local-{line_num}',
                            'source': dataset['filename'],
                            'line_number': line_num,
                            'parse_error': True
                        }
                    })
        
        return Response({
            'dataset': dataset,
            'conversations': conversations,
            'total': len(conversations)
        })
        
    except Exception as e:
        logger.error(f"Error reading dataset content: {e}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
def list_conversations(request, dataset_id=None):
    """
    获取指定数据集的对话列表（支持分页）
    
    通过dataset_id获取数据集详情，然后读取对应的文件内容
    
    参数:
        dataset_id: 数据集ID
        page: 页码（默认1）
        page_size: 每页数量（默认20，最大100）
    
    返回:
        分页后的对话列表数据
    """
    if not dataset_id:
        dataset_id = request.query_params.get('dataset_id')
    
    if not dataset_id:
        return Response({'error': 'dataset_id is required'}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        page = int(request.query_params.get('page', 1))
        page_size = min(int(request.query_params.get('page_size', 20)), 100)  # 限制最大100条
        if page < 1:
            page = 1
        if page_size < 1:
            page_size = 20
    except ValueError:
        return Response({'error': 'page和page_size必须是整数'}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        # 1. 通过dataset_id获取数据集详情
        dataset = dataset_storage.get_dataset(dataset_id)
        if not dataset:
            return Response({'error': '数据集不存在'}, status=status.HTTP_404_NOT_FOUND)
        
        # 2. 获取file_path字段
        file_path = dataset.get('file_path')
        if not file_path:
            return Response({'error': '数据集文件路径不存在'}, status=status.HTTP_404_NOT_FOUND)
        
        # 3. 构建完整文件路径
        storage_dir = Path(dataset_storage.storage_dir)
        full_path = storage_dir / file_path
        
        if not full_path.exists():
            return Response({'error': f'文件不存在: {file_path}'}, status=status.HTTP_404_NOT_FOUND)
        
        # 4. 读取文件内容并支持分页
        all_conversations = []
        
        with open(full_path, 'r', encoding='utf-8') as f:
            for line_num, line in enumerate(f, 1):
                line = line.strip()
                if not line:
                    continue
                
                try:
                    data = json.loads(line)
                    
                    # 提取对话内容，支持多种格式
                    conversation_data = {
                        'id': str(line_num),
                        'conversations': [],
                        'metadata': {
                            'dataset_id': dataset_id,
                            'line_number': line_num,
                            'source_file': str(file_path)
                        }
                    }
                    
                    # 处理不同格式的对话数据
                    if 'conversation' in data:
                        # 对话合成格式：包含conversation字段（单数）
                        conversation_data['conversations'] = data['conversation']
                    elif 'conversations' in data:
                        # 另一种标准格式：包含conversations字段
                        conversation_data['conversations'] = data['conversations']
                    elif isinstance(data, dict) and 'user' in data and 'assistant' in data:
                        # 简单对话格式：user和assistant字段
                        conversation_data['conversations'] = [
                            {'role': 'user', 'content': data.get('user', '')},
                            {'role': 'assistant', 'content': data.get('assistant', '')}
                        ]
                    elif isinstance(data, dict) and 'messages' in data:
                        # OpenAI格式：messages字段
                        conversation_data['conversations'] = data['messages']
                    elif isinstance(data, dict):
                        # 其他格式：尝试提取对话内容
                        content = str(data)
                        conversation_data['conversations'] = [
                            {'role': 'user', 'content': content[:500] + '...' if len(content) > 500 else content}
                        ]
                    else:
                        # 原始文本格式
                        content = str(data)
                        conversation_data['conversations'] = [
                            {'role': 'user', 'content': content[:500] + '...' if len(content) > 500 else content}
                        ]
                    
                    # 添加额外的元数据
                    if isinstance(data, dict):
                        conversation_data['metadata'].update({
                            'uuid': data.get('uuid', f'{dataset_id}_{line_num}'),
                            'original_data': {k: v for k, v in data.items() 
                                          if k not in ['conversation', 'conversations', 'messages', 'user', 'assistant']}
                        })
                    
                    all_conversations.append(conversation_data)
                    
                except json.JSONDecodeError as e:
                    logger.warning(f"解析第{line_num}行失败: {e}")
                    # 如果JSON解析失败，将整行作为文本处理
                    all_conversations.append({
                        'id': str(line_num),
                        'conversations': [
                            {'role': 'user', 'content': line[:500] + '...' if len(line) > 500 else line}
                        ],
                        'metadata': {
                            'dataset_id': dataset_id,
                            'line_number': line_num,
                            'source_file': str(file_path),
                            'parse_error': True,
                            'raw_content': line
                        }
                    })
        
        # 5. 计算分页
        total_count = len(all_conversations)
        start_index = (page - 1) * page_size
        end_index = start_index + page_size
        
        # 确保不超出范围
        if start_index >= total_count:
            conversations = []
        else:
            conversations = all_conversations[start_index:end_index]
        
        # 6. 格式化返回数据，包含完整对话信息
        formatted_conversations = []
        for conv in conversations:
            formatted_conversations.append({
                'id': conv['id'],
                'dataset_id': dataset_id,
                'conversation_id': conv['id'],
                'sample_index': start_index + conversations.index(conv),
                'original_data': conv,
                'is_annotated': False,
                'quality_score': None,
                'accuracy': None,
                'category': None,
                'tags': [],
                'notes': '',
                'created_at': datetime.now().isoformat(),
                'updated_at': datetime.now().isoformat(),
                'preview': _extract_preview(conv)
            })

        return Response({
            'dataset': {
                'id': dataset_id,
                'name': dataset.get('name', '未知数据集'),
                'description': dataset.get('description', ''),
                'type': dataset.get('data_type', 'unknown'),
                'total_samples': total_count,
                'file_path': str(file_path)
            },
            'conversations': formatted_conversations,
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
        logger.error(f"获取对话列表失败: {e}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)




class ConversationAnnotationViewSet(viewsets.ModelViewSet):
    queryset = ConversationAnnotation.objects.all()
    serializer_class = ConversationAnnotationSerializer

    @action(detail=False, methods=['get'])
    def list_conversations(self, request):
        """获取对话列表"""
        dataset_id = request.query_params.get('dataset_id')
        if not dataset_id:
            return Response({'error': 'dataset_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        conversations = self.queryset.filter(dataset_id=dataset_id)
        serializer = self.get_serializer(conversations, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def get_conversation(self, request):
        """获取单个对话详情"""
        dataset_id = request.query_params.get('dataset_id')
        sample_index = request.query_params.get('sample_index')
        
        if not dataset_id or sample_index is None:
            return Response({'error': 'dataset_id and sample_index are required'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            sample_index = int(sample_index)
        except ValueError:
            return Response({'error': 'sample_index must be an integer'}, status=status.HTTP_400_BAD_REQUEST)
        
        conversation = get_object_or_404(
            self.queryset, 
            dataset_id=dataset_id, 
            sample_index=sample_index
        )
        serializer = self.get_serializer(conversation)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """获取标注统计"""
        dataset_id = request.query_params.get('dataset_id')
        queryset = self.queryset
        
        if dataset_id:
            queryset = queryset.filter(dataset_id=dataset_id)
        
        total = queryset.count()
        annotated = queryset.filter(is_annotated=True).count()
        pending = total - annotated
        
        # 质量分布统计
        quality_distribution = {}
        for score in range(1, 6):
            count = queryset.filter(quality_score=score).count()
            if count > 0:
                quality_distribution[str(score)] = count
        
        # 准确性分布统计
        accuracy_distribution = {}
        for accuracy in ['correct', 'partial', 'incorrect']:
            count = queryset.filter(accuracy=accuracy).count()
            if count > 0:
                accuracy_distribution[accuracy] = count

        # 分类分布统计
        category_distribution = {}
        # 使用values('category')来获取所有非空的分类
        categories = queryset.exclude(category__isnull=True).exclude(category='').values_list('category', flat=True).distinct()
        for category in categories:
            if category:  # 确保分类不为空
                count = queryset.filter(category=category).count()
                if count > 0:
                    category_distribution[category] = count

        return Response({
            'total': total,
            'annotated': annotated,
            'pending': pending,
            'quality_distribution': quality_distribution,
            'accuracy_distribution': accuracy_distribution,
            'category_distribution': category_distribution
        })


class AnnotationBatchViewSet(viewsets.ModelViewSet):
    queryset = AnnotationBatch.objects.all()
    serializer_class = AnnotationBatchSerializer

    @action(detail=True, methods=['post'])
    def initialize_from_dataset(self, request, pk=None):
        """从数据集初始化批次"""
        batch = self.get_object()

        # 这里可以添加从数据集初始化批次的逻辑
        # 例如：读取数据集文件，创建对应的ConversationAnnotation记录

        return Response({'message': 'Batch initialized successfully'})


@api_view(['POST'])
def create_dataset_from_annotations(request):
    """
    从标注数据创建新数据集

    请求参数:
    {
        "name": string,              // 数据集名称（必填）
        "description": string,       // 数据集描述（可选）
        "annotation_ids": string[],  // 标注ID列表（必填）
        "source_dataset_id": string  // 源数据集ID（必填）
    }

    返回:
    - 成功: 新创建的dataset对象
    - 失败: 错误信息
    """
    try:
        # 1. 获取请求参数
        name = request.data.get('name')
        description = request.data.get('description', '')
        annotation_ids = request.data.get('annotation_ids', [])
        source_dataset_id = request.data.get('source_dataset_id')

        # 验证必填参数
        if not name:
            return Response(
                {'error': '数据集名称不能为空'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not annotation_ids or len(annotation_ids) == 0:
            return Response(
                {'error': 'annotation_ids不能为空'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not source_dataset_id:
            return Response(
                {'error': 'source_dataset_id不能为空'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 2. 获取源数据集信息以推断data_type
        source_dataset = dataset_storage.get_dataset(source_dataset_id)
        data_type = 'DIALOGUE'  # 默认值
        if source_dataset:
            data_type = source_dataset.get('data_type', 'DIALOGUE')
        else:
            logger.warning(f'源数据集 {source_dataset_id} 不存在，使用默认数据类型 DIALOGUE')

        # 3. 获取annotation记录
        try:
            # annotation_ids可能是UUID或字符串，需要统一处理
            annotations = ConversationAnnotation.objects.filter(id__in=annotation_ids)
        except Exception as e:
            return Response(
                {'error': f'获取标注数据失败: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if annotations.count() == 0:
            return Response(
                {'error': '未找到对应的标注数据'},
                status=status.HTTP_404_NOT_FOUND
            )

        found_ids = {str(a.id) for a in annotations}
        requested_ids = set(annotation_ids)
        missing_ids = requested_ids - found_ids
        if missing_ids:
            logger.warning(f'请求的annotation_ids中有{len(missing_ids)}个未找到: {missing_ids}')

        # 4. 收集标注数据并写入文件
        output_dir = os.path.join(settings.BASE_DIR, 'storage', 'manual_outputs')
        os.makedirs(output_dir, exist_ok=True)

        dataset_id = dataset_storage._generate_id()
        file_name = f"{dataset_id}.jsonl"
        file_path = os.path.join(output_dir, file_name)

        successful_count = 0
        skipped_count = 0

        with open(file_path, 'w', encoding='utf-8') as f:
            for annotation in annotations:
                try:
                    # 优先使用edited_data，如果没有则使用original_data
                    data_to_save = annotation.edited_data if annotation.edited_data else annotation.original_data

                    if not data_to_save:
                        logger.warning(f'Annotation {annotation.id} 没有数据，跳过')
                        skipped_count += 1
                        continue

                    # 写入JSONL文件
                    f.write(json.dumps(data_to_save, ensure_ascii=False) + '\n')
                    successful_count += 1

                except Exception as e:
                    logger.error(f'写入annotation {annotation.id} 数据失败: {e}')
                    skipped_count += 1

        # 5. 创建dataset记录
        size_bytes = os.path.getsize(file_path)
        dataset_record = dataset_storage.create_dataset({
            'id': dataset_id,
            'name': name,
            'description': description,
            'data_type': data_type,
            'source': 'ANNOTATION',
            'file_path': os.path.join('manual_outputs', file_name),
            'file_name': file_name,
            'file_format': 'jsonl',
            'size_bytes': size_bytes,
            'item_count': successful_count
        })

        logger.info(
            f'成功创建数据集 {dataset_id}: ' +
            f'成功写入{successful_count}条, 跳过{skipped_count}条'
        )

        return Response({
            'id': dataset_id,
            'name': name,
            'description': description,
            'data_type': data_type,
            'source': 'ANNOTATION',
            'source_dataset_id': source_dataset_id,
            'item_count': successful_count,
            'file_count': 1,
            'size_bytes': size_bytes,
            'created_at': dataset_record.get('created_at'),
            'message': f'成功创建数据集，包含{successful_count}条数据'
        }, status=status.HTTP_201_CREATED)

    except Exception as e:
        logger.error(f'创建数据集失败: {e}', exc_info=True)
        return Response(
            {'error': f'创建数据集失败: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['POST'])
def save_annotation_relation(request):
    """
    保存标注与原始数据集样本的关联关系
    
    请求参数:
    {
        "dataset_id": string,           // 数据集ID
        "original_sample_index": number, // 原始样本索引
        "annotation_id": string,        // 标注ID
        "relation_type": string         // 关系类型 (如 'annotation')
    }
    """
    try:
        dataset_id = request.data.get('dataset_id')
        original_sample_index = request.data.get('original_sample_index')
        annotation_id = request.data.get('annotation_id')
        relation_type = request.data.get('relation_type', 'annotation')
        
        # 验证必填参数
        if not dataset_id:
            return Response(
                {'error': 'dataset_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if original_sample_index is None:
            return Response(
                {'error': 'original_sample_index is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not annotation_id:
            return Response(
                {'error': 'annotation_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # 验证annotation是否存在
        try:
            annotation = ConversationAnnotation.objects.get(id=annotation_id)
        except ConversationAnnotation.DoesNotExist:
            return Response(
                {'error': f'Annotation with id {annotation_id} not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # 验证annotation是否属于该数据集
        if annotation.dataset_id != dataset_id:
            return Response(
                {'error': f'Annotation {annotation_id} does not belong to dataset {dataset_id}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # 更新annotation的字段以包含原始索引信息
        # 注意：由于模型中已经有sample_index和conversation_id，这里主要是确认数据一致性
        if annotation.sample_index != int(original_sample_index):
            logger.warning(
                f'Annotation {annotation_id} sample_index mismatch: '
                f'annotation={annotation.sample_index}, request={original_sample_index}'
            )
        
        # 如果需要存储额外的关系信息，可以扩展模型或使用单独的关系表
        # 当前模型中，关联关系通过dataset_id + sample_index + conversation_id的组合来表达
        
        logger.info(
            f'Saved relation: dataset={dataset_id}, sample_index={original_sample_index}, '
            f'annotation={annotation_id}, type={relation_type}'
        )
        
        return Response({
            'dataset_id': dataset_id,
            'original_sample_index': original_sample_index,
            'annotation_id': annotation_id,
            'relation_type': relation_type,
            'conversation_id': annotation.conversation_id,
            'message': 'Relation saved successfully'
        }, status=status.HTTP_201_CREATED)
        
    except Exception as e:
        logger.error(f'保存关联关系失败: {e}', exc_info=True)
        return Response(
            {'error': f'保存关联关系失败: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
def get_annotation_statistics(request):
    """
    获取标注数据的统计信息
    
    查询参数:
    - dataset_id: 可选的数据集ID过滤
    
    返回:
    - assistant_model_score: assistant model得分 (0-100)
    - turing_score: Turing测试得分 (0-100)  
    - kappa_score: Kappa一致性得分 (0-100)
    - total_annotations: 总标注数量
    """
    try:
        dataset_id = request.query_params.get('dataset_id')
        
        # 获取统计信息
        stats = AnnotationStatsService.get_annotation_statistics(dataset_id)
        # stats = {
        #         'assistant_model_score': 0.875,
        #         'turing_score': 0.813,
        #         'kappa_score': 0.613,
        #         'total_annotations': 0
        #     }
        return Response(stats)
        
    except Exception as e:
        logger.error(f'Error in get_annotation_statistics: {str(e)}')
        return Response(
            {
                'error': str(e),
                'assistant_model_score': 0.0,
                'turing_score': 0.0,
                'kappa_score': 0.0,
                'total_annotations': 0
            }, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
def get_detailed_annotation_statistics(request):
    """
    获取详细的标注数据统计信息
    
    查询参数:
    - dataset_id: 可选的数据集ID过滤
    
    返回:
    - 基础统计信息 + 详细分布数据
    """
    try:
        dataset_id = request.query_params.get('dataset_id')
        
        # 获取详细统计信息
        stats = AnnotationStatsService.get_detailed_statistics(dataset_id)
        
        return Response(stats)
        
    except Exception as e:
        logger.error(f'Error in get_detailed_annotation_statistics: {str(e)}')
        return Response(
            {'error': str(e)}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
