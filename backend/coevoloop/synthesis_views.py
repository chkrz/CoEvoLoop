"""
数据合成任务 API Views
"""
from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.http import FileResponse
from rest_framework import status
from storage.synthesis_storage import SynthesisStorage
from storage.dataset_storage import DatasetStorage
# 延迟导入以避免启动时的依赖问题
# from synthesis.portrait_extractor import PortraitExtractor
# from synthesis.data_generator import DataGenerator
# from synthesis.llm_config import ModelType
# from synthesis.task_executor import get_task_executor
# from synthesis.evaluator import get_evaluator, is_evaluator_available
import logging
import json
import os
from datetime import datetime
import io
import asyncio

logger = logging.getLogger(__name__)

# 延迟导入的模块
PortraitExtractor = None
DataGenerator = None
ModelType = None
_task_executor = None
_evaluator_module = None

def _lazy_import_model_type():
    global ModelType
    if ModelType is None:
        try:
            from synthesis.llm_config import ModelType as _MT
            ModelType = _MT
        except ImportError:
            # 如果导入失败，创建一个空的占位符
            class _FallbackModelType:
                COCKPIT_BOT = "cockpit_bot"
            ModelType = _FallbackModelType
    return ModelType

def _lazy_import_portrait_extractor():
    global PortraitExtractor
    if PortraitExtractor is None:
        from synthesis.portrait_extractor import PortraitExtractor as _PE
        PortraitExtractor = _PE
    return PortraitExtractor

def _lazy_import_data_generator():
    global DataGenerator
    if DataGenerator is None:
        from synthesis.data_generator import DataGenerator as _DG
        DataGenerator = _DG
    return DataGenerator

def _lazy_import_task_executor():
    global _task_executor
    if _task_executor is None:
        from synthesis.task_executor import get_task_executor
        _task_executor = get_task_executor
    return _task_executor

def _lazy_import_evaluator():
    global _evaluator_module
    if _evaluator_module is None:
        from synthesis import evaluator as _ev
        _evaluator_module = _ev
    return _evaluator_module

# 初始化存储
synthesis_storage = SynthesisStorage()
dataset_storage = DatasetStorage()


@api_view(['GET', 'POST'])
def synthesis_task_list(request):
    """
    合成任务列表 API
    
    GET: 获取任务列表
    POST: 创建新任务
    """
    if request.method == 'GET':
        # 获取筛选参数
        type_filter = request.GET.get('type')
        status_filter = request.GET.get('status')
        search = request.GET.get('search')
        
        try:
            tasks = synthesis_storage.list_tasks(
                type_filter=type_filter,
                status_filter=status_filter,
                search=search
            )
            return Response({
                'tasks': tasks,
                'count': len(tasks)
            })
        except Exception as e:
            logger.exception(e)
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    elif request.method == 'POST':
        # 创建任务
        try:
            # 验证必填字段
            required_fields = ['name', 'type', 'config']
            for field in required_fields:
                if field not in request.data:
                    return Response(
                        {'error': f'缺少必填字段: {field}'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            
            # 添加创建者信息
            task_data = request.data.copy()
            if request.user.is_authenticated:
                task_data['created_by'] = request.user.username
            else:
                task_data['created_by'] = 'system'

            # 画像抽取任务：上传内容不入库，改为仅在内存中保存
            portrait_upload_payload = None
            task_type = task_data.get('type')
            config = task_data.get('config', {}) or {}
            if task_type == 'PORTRAIT' and config.get('source_type') == 'upload':
                portrait_upload_payload = config.get('uploaded_dialogues')
                if portrait_upload_payload:
                    config = {**config}
                    config.pop('uploaded_dialogues', None)
                    task_data['config'] = config
            
            # 创建任务
            task = synthesis_storage.create_task(task_data)

            if portrait_upload_payload:
                executor = _lazy_import_task_executor()()
                executor.set_upload_payload(task.get('id'), {
                    'uploaded_dialogues': portrait_upload_payload
                })
            
            return Response(task, status=status.HTTP_201_CREATED)
        
        except Exception as e:
            logger.exception(e)
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


@api_view(['GET', 'PUT', 'DELETE'])
def synthesis_task_detail(request, task_id):
    """
    合成任务详情 API
    
    GET: 获取任务详情
    PUT: 更新任务
    DELETE: 删除任务
    """
    if request.method == 'GET':
        try:
            task = synthesis_storage.get_task(task_id)
            if not task:
                return Response(
                    {'error': '任务不存在'},
                    status=status.HTTP_404_NOT_FOUND
                )
            return Response(task)
        except Exception as e:
            logger.exception(e)
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    elif request.method == 'PUT':
        try:
            task = synthesis_storage.update_task(task_id, request.data)
            if not task:
                return Response(
                    {'error': '任务不存在'},
                    status=status.HTTP_404_NOT_FOUND
                )
            return Response(task)
        except Exception as e:
            logger.exception(e)
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    elif request.method == 'DELETE':
        try:
            task = synthesis_storage.get_task(task_id)
            if not task:
                return Response(
                    {'error': '任务不存在'},
                    status=status.HTTP_404_NOT_FOUND
                )

            # 删除对应的输出文件（如果存在）
            output_file = task.get('config', {}).get('output_file')
            if not output_file:
                from pathlib import Path
                backend_dir = Path(__file__).parent.parent
                task_type = task.get('type')
                if task_type == 'PORTRAIT':
                    output_subdir = 'portrait_outputs'
                elif task_type == 'EVALUATION':
                    output_subdir = 'evaluation_outputs'
                else:
                    output_subdir = 'dialogue_outputs'
                output_dir = backend_dir / 'storage' / output_subdir
                output_file = str(output_dir / f"{task_id}.jsonl")

            try:
                if output_file and os.path.exists(output_file):
                    os.remove(output_file)
                    logger.info(f"已删除任务输出文件: {output_file}")
            except Exception as file_err:
                logger.warning(f"删除任务输出文件失败: {output_file}, error: {file_err}")

            try:
                dataset_storage.delete_by_source_task_id(task_id)
            except Exception as data_err:
                logger.warning(f"删除任务对应数据集失败: {task_id}, error: {data_err}")

            success = synthesis_storage.delete_task(task_id)
            if not success:
                return Response(
                    {'error': '任务不存在'},
                    status=status.HTTP_404_NOT_FOUND
                )
            return Response(status=status.HTTP_204_NO_CONTENT)
        except Exception as e:
            logger.exception(e)
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


@api_view(['POST'])
def synthesis_task_start(request, task_id):
    """
    启动合成任务
    
    POST: 启动任务执行
    """
    try:
        task = synthesis_storage.get_task(task_id)
        if not task:
            return Response(
                {'error': '任务不存在'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        if task['status'] != 'PENDING':
            return Response(
                {'error': f'任务状态为 {task["status"]}，无法启动'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # 使用task_executor启动异步任务
        executor = _lazy_import_task_executor()()
        success = executor.start_task(task_id)
        
        if not success:
            return Response(
                {'error': '任务启动失败'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        return Response({
            'message': '任务已启动',
            'task_id': task_id,
            'status': 'RUNNING'
        })
    
    except Exception as e:
        logger.exception(e)
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
def synthesis_task_cancel(request, task_id):
    """
    取消合成任务
    
    POST: 取消正在运行的任务
    """
    try:
        task = synthesis_storage.get_task(task_id)
        if not task:
            return Response(
                {'error': '任务不存在'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        if task['status'] not in ['PENDING', 'RUNNING']:
            return Response(
                {'error': f'任务状态为 {task["status"]}，无法取消'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # 使用task_executor取消任务
        executor = _lazy_import_task_executor()()
        if task['status'] == 'RUNNING':
            executor.cancel_task(task_id)
        else:
            # PENDING状态直接更新为CANCELLED
            synthesis_storage.update_task(task_id, {
                'status': 'CANCELLED'
            })
        
        return Response({
            'message': '任务已取消',
            'task_id': task_id,
            'status': 'CANCELLED'
        })
    
    except Exception as e:
        logger.exception(e)
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
def synthesis_task_stats(request):
    """
    获取任务统计信息
    
    GET: 返回任务统计数据
    """
    try:
        stats = synthesis_storage.get_stats()
        return Response(stats)
    except Exception as e:
        logger.exception(e)
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
def synthesis_task_progress(request, task_id):
    """
    获取任务实时进度
    
    GET: 返回任务当前进度信息
    """
    try:
        task = synthesis_storage.get_task(task_id)
        if not task:
            return Response(
                {'error': '任务不存在'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        return Response({
            'task_id': task_id,
            'status': task.get('status'),
            'progress': task.get('progress', {}),
            'started_at': task.get('started_at'),
            'completed_at': task.get('completed_at'),
            'error_message': task.get('error_message')
        })
    
    except Exception as e:
        logger.exception(e)
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
def synthesis_task_preview(request, task_id):
    """
    预览生成的对话数据（前N条）
    
    GET: 返回任务生成的前N条对话数据
    Query params:
        - limit: 返回的对话数量（默认10）
    """
    try:
        task = synthesis_storage.get_task(task_id)
        if not task:
            logger.error(f"任务不存在: {task_id}")
            return Response(
                {'error': '任务不存在'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # logger.info(f"获取任务预览: {task_id}, 任务配置: {task.get('config', {})}")
        
        # 获取输出文件路径
        output_file = task.get('config', {}).get('output_file')
        # logger.info(f"配置中的输出文件路径: {output_file}")
        
        # 如果配置中没有output_file，根据task_id推断路径
        if not output_file:
            # 推断输出文件路径（与task_executor中的逻辑一致）
            from pathlib import Path
            backend_dir = Path(__file__).parent.parent
            task_type = task.get('type')
            if task_type == 'PORTRAIT':
                output_subdir = 'portrait_outputs'
            elif task_type == 'EVALUATION':
                output_subdir = 'evaluation_outputs'
            else:
                output_subdir = 'dialogue_outputs'
            output_dir = backend_dir / 'storage' / output_subdir
            output_file = str(output_dir / f"{task_id}.jsonl")
            logger.info(f"配置中无output_file，推断路径: {output_file}")
        
        if not os.path.exists(output_file):
            logger.error(f"输出文件不存在: {output_file}")
            return Response(
                {'error': f'输出文件不存在，任务可能尚未生成数据'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # 读取指定数量的对话
        limit = int(request.GET.get('limit', 10))
        dialogues = []

        with open(output_file, 'r', encoding='utf-8') as f:
            for i, line in enumerate(f):
                if i >= limit:
                    break
                try:
                    dialogue = json.loads(line.strip())
                    dialogues.append(dialogue)
                except json.JSONDecodeError as e:
                    logger.warning(f"跳过无效JSON行 {i}: {e}")
        
        logger.info(f"成功读取 {len(dialogues)} 条对话")
        
        return Response({
            'task_id': task_id,
            'total_previewed': len(dialogues),
            'dialogues': dialogues
        })
    
    except Exception as e:
        logger.exception(e)
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
def synthesis_task_download(request, task_id):
    """
    下载任务生成的完整对话数据
    
    GET: 下载JSONL文件
    """
    try:
        task = synthesis_storage.get_task(task_id)
        if not task:
            return Response(
                {'error': '任务不存在'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # 获取输出文件路径
        output_file = task.get('config', {}).get('output_file')
        
        # 如果配置中没有output_file，根据task_id推断路径
        if not output_file:
            from pathlib import Path
            backend_dir = Path(__file__).parent.parent
            task_type = task.get('type')
            if task_type == 'PORTRAIT':
                output_subdir = 'portrait_outputs'
            elif task_type == 'EVALUATION':
                output_subdir = 'evaluation_outputs'
            else:
                output_subdir = 'dialogue_outputs'
            output_dir = backend_dir / 'storage' / output_subdir
            output_file = str(output_dir / f"{task_id}.jsonl")
        
        if not os.path.exists(output_file):
            return Response(
                {'error': '输出文件不存在或任务尚未完成'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # 返回文件
        filename_prefix = "portraits" if task.get('type') == 'PORTRAIT' else "dialogues"
        filename = f"{filename_prefix}_{task_id}.jsonl"
        response = FileResponse(
            open(output_file, 'rb'),
            as_attachment=True,
            filename=filename
        )
        response['Content-Type'] = 'application/jsonl'
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        
        return response
    
    except Exception as e:
        logger.exception(e)
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
def portrait_task_list(request):
    """
    获取所有成功的画像抽取任务列表
    用于对话合成时选择数据源
    """
    try:
        tasks = synthesis_storage.list_tasks(
            type_filter='PORTRAIT',
            status_filter='COMPLETED'
        )
        
        # 只返回必要字段
        portrait_tasks = [
            {
                'id': task['id'],
                'name': task['name'],
                'created_at': task['created_at'],
                'completed_at': task.get('completed_at'),
                'progress': task.get('progress', {})
            }
            for task in tasks
        ]
        
        return Response({
            'tasks': portrait_tasks,
            'count': len(portrait_tasks)
        })
    
    except Exception as e:
        logger.exception(e)
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
def dialogue_task_list(request):
    """
    获取所有成功的对话合成任务列表
    用于质量评估时选择数据源
    """
    try:
        tasks = synthesis_storage.list_tasks(
            type_filter='DIALOGUE',
            status_filter='COMPLETED'
        )
        
        # 只返回必要字段
        dialogue_tasks = [
            {
                'id': task['id'],
                'name': task['name'],
                'created_at': task['created_at'],
                'completed_at': task.get('completed_at'),
                'progress': task.get('progress', {})
            }
            for task in tasks
        ]
        
        return Response({
            'tasks': dialogue_tasks,
            'count': len(dialogue_tasks)
        })
    
    except Exception as e:
        logger.exception(e)
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
