"""
异步任务执行器 - 处理对话生成任务的后台执行
"""
import asyncio
import json
import logging
import os
import threading
import uuid
from datetime import datetime
from typing import Dict, Any, Optional

from synthesis.dialogue_generator import create_generator_from_config
from synthesis.portrait_extractor import PortraitExtractor
from synthesis.evaluator import get_evaluator, is_evaluator_available
from storage.synthesis_storage import SynthesisStorage
from storage.dataset_storage import DatasetStorage

logger = logging.getLogger(__name__)

# 全局任务执行器实例
_task_executor = None
_executor_lock = threading.Lock()


def get_task_executor():
    """获取全局任务执行器实例（单例模式）"""
    global _task_executor
    if _task_executor is None:
        with _executor_lock:
            if _task_executor is None:
                _task_executor = TaskExecutor()
    return _task_executor


class TaskExecutor:
    """
    任务执行器
    
    在后台异步执行对话生成任务，支持进度更新和状态管理
    """
    
    def __init__(self, storage: Optional[SynthesisStorage] = None):
        self.storage = storage or SynthesisStorage()
        self.dataset_storage = DatasetStorage()
        self.running_tasks = {}  # task_id -> asyncio.Task
        self._lock = threading.Lock()
        self._upload_payloads = {}
        self._payload_lock = threading.Lock()

    def set_upload_payload(self, task_id: str, payload: Dict[str, Any]):
        with self._payload_lock:
            self._upload_payloads[task_id] = payload

    def pop_upload_payload(self, task_id: str) -> Optional[Dict[str, Any]]:
        with self._payload_lock:
            return self._upload_payloads.pop(task_id, None)
        
    def start_task(self, task_id: str) -> bool:
        """
        启动任务执行
        
        Args:
            task_id: 任务ID
            
        Returns:
            是否成功启动
        """
        with self._lock:
            # 检查任务是否已在运行
            if task_id in self.running_tasks:
                logger.warning(f"任务 {task_id} 已在运行")
                return False
            
            # 获取任务信息
            task = self.storage.get_task(task_id)
            if not task:
                logger.error(f"任务 {task_id} 不存在")
                return False
            
            if task['status'] != 'PENDING':
                logger.warning(f"任务 {task_id} 状态为 {task['status']}，无法启动")
                return False
            
            # 更新任务状态为RUNNING
            self.storage.update_task(task_id, {
                'status': 'RUNNING',
                'started_at': datetime.now().isoformat()
            })
            
            # 创建异步任务
            loop = asyncio.new_event_loop()
            thread = threading.Thread(
                target=self._run_task_in_thread,
                args=(task_id, loop),
                daemon=True
            )
            thread.start()
            
            logger.info(f"任务 {task_id} 已启动")
            return True
    
    def _run_task_in_thread(self, task_id: str, loop: asyncio.AbstractEventLoop):
        """在独立线程中运行异步任务"""
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(self._execute_task(task_id))
        finally:
            loop.close()
    
    async def _execute_task(self, task_id: str):
        """
        执行任务的核心逻辑
        
        Args:
            task_id: 任务ID
        """
        try:
            # 获取任务配置
            task = self.storage.get_task(task_id)
            if not task:
                logger.error(f"任务 {task_id} 不存在")
                return
            
            config = task.get('config', {})
            task_type = task.get('type', 'DIALOGUE')
            
            # 确定输入来源
            source_type = config.get('source_type', 'task')
            input_file = None
            
            if source_type == 'task':
                # 从其他任务ID读取
                if task_type == 'DIALOGUE':
                    # 对话合成任务：从画像任务读取
                    source_portrait_task_id = config.get('source_portrait_task_id')
                    if not source_portrait_task_id:
                        raise ValueError("未指定source_portrait_task_id")
                    
                    source_task = self.storage.get_task(source_portrait_task_id)
                    if not source_task:
                        raise ValueError(f"画像任务 {source_portrait_task_id} 不存在")
                    
                    if source_task.get('type') != 'PORTRAIT':
                        raise ValueError(f"任务 {source_portrait_task_id} 不是画像抽取任务")
                    
                    if source_task.get('status') != 'COMPLETED':
                        raise ValueError(f"画像任务 {source_portrait_task_id} 未完成，无法使用")
                    
                    # 获取画像任务的输出文件路径
                    source_output_file = source_task.get('config', {}).get('output_file')
                    if not source_output_file:
                        output_dir = os.path.join(
                            os.path.dirname(__file__), '..', 'storage', 'portrait_outputs'
                        )
                        source_output_file = os.path.join(output_dir, f"{source_portrait_task_id}.jsonl")
                    
                    if not os.path.exists(source_output_file):
                        raise ValueError(f"画像任务 {source_portrait_task_id} 的输出文件不存在")
                    
                    input_file = source_output_file
                    logger.info(f"从画像任务 {source_portrait_task_id} 读取数据: {input_file}")
                
                elif task_type == 'EVALUATION':
                    # 质量评估任务：从对话合成任务读取
                    source_dialogue_task_id = config.get('source_dialogue_task_id')
                    if not source_dialogue_task_id:
                        raise ValueError("未指定source_dialogue_task_id")
                    
                    source_task = self.storage.get_task(source_dialogue_task_id)
                    if not source_task:
                        raise ValueError(f"对话合成任务 {source_dialogue_task_id} 不存在")
                    
                    if source_task.get('type') != 'DIALOGUE':
                        raise ValueError(f"任务 {source_dialogue_task_id} 不是对话合成任务")
                    
                    if source_task.get('status') != 'COMPLETED':
                        raise ValueError(f"对话合成任务 {source_dialogue_task_id} 未完成，无法使用")
                    
                    # 获取对话任务的输出文件路径
                    source_output_file = source_task.get('config', {}).get('output_file')
                    if not source_output_file:
                        output_dir = os.path.join(
                            os.path.dirname(__file__), '..', 'storage', 'dialogue_outputs'
                        )
                        source_output_file = os.path.join(output_dir, f"{source_dialogue_task_id}.jsonl")
                    
                    if not os.path.exists(source_output_file):
                        raise ValueError(f"对话合成任务 {source_dialogue_task_id} 的输出文件不存在")
                    
                    input_file = source_output_file
                    logger.info(f"从对话合成任务 {source_dialogue_task_id} 读取数据: {input_file}")
                
                else:
                    raise ValueError(f"任务类型 {task_type} 不支持从其他任务读取数据")
                
            elif source_type == 'upload':
                # 从上传的数据读取
                upload_payloads = {
                    'uploaded_portraits': config.get('uploaded_portraits'),
                    'uploaded_dialogues': config.get('uploaded_dialogues'),
                    'uploaded_evaluation_dialogues': config.get('uploaded_evaluation_dialogues')
                }
                if any(v is None for v in upload_payloads.values()):
                    cached_payloads = self.pop_upload_payload(task_id) or {}
                    for key, value in cached_payloads.items():
                        if upload_payloads.get(key) is None:
                            upload_payloads[key] = value
                
                if task_type == 'DIALOGUE':
                    upload_payload = upload_payloads.get('uploaded_portraits')
                elif task_type == 'PORTRAIT':
                    upload_payload = upload_payloads.get('uploaded_dialogues')
                elif task_type == 'EVALUATION':
                    upload_payload = upload_payloads.get('uploaded_evaluation_dialogues')
                else:
                    upload_payload = None
                
                if not input_file and not upload_payload:
                    raise ValueError("未提供上传数据")
                
                if not input_file:
                    # 将上传的数据写入临时文件
                    import tempfile
                    temp_dir = tempfile.gettempdir()
                    temp_prefix_map = {
                        'DIALOGUE': 'portraits',
                        'PORTRAIT': 'dialogues',
                        'EVALUATION': 'eval_dialogues'
                    }
                    temp_prefix = temp_prefix_map.get(task_type, 'data')
                    input_file = os.path.join(temp_dir, f"{temp_prefix}_{task_id}.jsonl")
                    
                    # 解析JSON并写入文件（若非JSON则按JSONL写入）
                    try:
                        parsed_data = json.loads(upload_payload)
                        if not isinstance(parsed_data, list):
                            parsed_data = [parsed_data]
                        
                        with open(input_file, 'w', encoding='utf-8') as f:
                            for item in parsed_data:
                                f.write(json.dumps(item, ensure_ascii=False) + "\n")
                    except Exception:
                        # 视为 JSONL
                        with open(input_file, 'w', encoding='utf-8') as f:
                            for line in upload_payload.splitlines():
                                if line.strip():
                                    f.write(line.strip() + "\n")
            else:
                raise ValueError(f"不支持的source_type: {source_type}")
            
            # 读取数据文件，计算总数并更新
            try:
                total_count = 0
                with open(input_file, 'r', encoding='utf-8') as f:
                    for line in f:
                        if line.strip():
                            total_count += 1
                
                # 立即更新total字段
                if total_count > 0:
                    logger.info(f"任务 {task_id} 读取到 {total_count} 条数据")
                    self.storage.update_task(task_id, {
                        'progress': {
                            'total': total_count,
                            'completed': 0,
                            'failed': 0,
                            'success_rate': 0.0
                        }
                    })
            except Exception as e:
                logger.warning(f"读取数据文件计算总数失败: {e}")
            
            if task_type == 'PORTRAIT':
                # 画像抽取任务
                output_dir = os.path.join(
                    os.path.dirname(__file__),
                    '..',
                    'storage',
                    'portrait_outputs'
                )
                os.makedirs(output_dir, exist_ok=True)
                output_file = os.path.join(output_dir, f"{task_id}.jsonl")

                model = config.get('model', 'dashscope/qwen3-235b-a22b')
                extractor = PortraitExtractor(model=model)
                batch_size = config.get('batch_size', 5)

                logger.info(f"开始执行画像抽取任务 {task_id}，模型: {model}，输入: {input_file}，输出: {output_file}")

                success_count, failed_count = await self._extract_portraits_from_file(
                    task_id=task_id,
                    input_file=input_file,
                    output_file=output_file,
                    extractor=extractor,
                    batch_size=batch_size
                )

                self.storage.update_task(task_id, {
                    'status': 'COMPLETED',
                    'completed_at': datetime.now().isoformat(),
                    'config': {
                        **config,
                        'output_file': output_file,
                        'success_count': success_count,
                        'failed_count': failed_count
                    }
                })

                dataset = self.dataset_storage.upsert_task_dataset(task, output_file)
                if dataset:
                    self.storage.update_task(task_id, {
                        'output_dataset_id': dataset.get('id')
                    })
                
                logger.info(f"任务 {task_id} 完成，成功抽取 {success_count} 条画像，失败 {failed_count} 条")
            
            elif task_type == 'EVALUATION':
                # 质量评估任务
                if not is_evaluator_available():
                    raise RuntimeError("评分模块不可用")
                
                output_dir = os.path.join(
                    os.path.dirname(__file__),
                    '..',
                    'storage',
                    'evaluation_outputs'
                )
                os.makedirs(output_dir, exist_ok=True)
                output_file = os.path.join(output_dir, f"{task_id}.jsonl")

                evaluator = get_evaluator()
                batch_size = config.get('batch_size', 5)

                logger.info(f"开始执行质量评估任务 {task_id}，输入: {input_file}，输出: {output_file}")

                success_count, failed_count, evaluation_stats = await self._evaluate_dialogues_from_file(
                    task_id=task_id,
                    input_file=input_file,
                    output_file=output_file,
                    evaluator=evaluator,
                    batch_size=batch_size
                )

                self.storage.update_task(task_id, {
                    'status': 'COMPLETED',
                    'completed_at': datetime.now().isoformat(),
                    'evaluation_stats': evaluation_stats,
                    'config': {
                        **config,
                        'output_file': output_file,
                        'success_count': success_count,
                        'failed_count': failed_count
                    }
                })

                # 重新获取更新后的task，以便同步evaluation_stats到dataset
                updated_task = self.storage.get_task(task_id)
                logger.info(f"重新获取的task是否包含evaluation_stats: {'evaluation_stats' in updated_task if updated_task else False}")
                if updated_task and 'evaluation_stats' in updated_task:
                    logger.info(f"Task evaluation_stats: {updated_task['evaluation_stats']}")
                
                dataset = self.dataset_storage.upsert_task_dataset(updated_task, output_file)
                if dataset:
                    self.storage.update_task(task_id, {
                        'output_dataset_id': dataset.get('id')
                    })
                    logger.info(f"Dataset是否包含evaluation_stats: {'evaluation_stats' in dataset}")

                logger.info(f"任务 {task_id} 完成，成功评估 {success_count} 条对话，失败 {failed_count} 条")
                logger.info(f"评估统计: 总评估 {evaluation_stats['total_evaluated']} 条，通过 {evaluation_stats['passed_count']} 条，通过率 {evaluation_stats['pass_rate']}%")
            
            else:
                # 对话合成任务
                output_dir = os.path.join(
                    os.path.dirname(__file__),
                    '..',
                    'storage',
                    'dialogue_outputs'
                )
                os.makedirs(output_dir, exist_ok=True)
                output_file = os.path.join(output_dir, f"{task_id}.jsonl")
                
                # 创建生成器
                generator = create_generator_from_config(config)
                
                # 定义进度回调
                def progress_callback(completed: int, total: int):
                    try:
                        success_rate = (completed / total * 100) if total > 0 else 0
                        self.storage.update_task(task_id, {
                            'progress': {
                                'total': total,
                                'completed': completed,
                                'failed': 0,  # 可以后续优化跟踪失败数
                                'success_rate': success_rate
                            }
                        })
                        logger.info(f"任务 {task_id} 进度: {completed}/{total} ({success_rate:.1f}%)")
                    except Exception as e:
                        logger.error(f"更新进度失败: {e}")
                
                # 执行生成
                logger.info(f"开始执行任务 {task_id}，输入: {input_file}，输出: {output_file}")
                
                success_count = await generator.generate_dialogues_from_file(
                    input_file=input_file,
                    output_file=output_file,
                    progress_callback=progress_callback,
                    batch_size=config.get('batch_size', 5)
                )
                
                # 更新任务状态为完成
                self.storage.update_task(task_id, {
                    'status': 'COMPLETED',
                    'completed_at': datetime.now().isoformat(),
                    'config': {
                        **config,
                        'output_file': output_file,
                        'success_count': success_count
                    }
                })

                dataset = self.dataset_storage.upsert_task_dataset(task, output_file)
                if dataset:
                    self.storage.update_task(task_id, {
                        'output_dataset_id': dataset.get('id')
                    })
                
                logger.info(f"任务 {task_id} 完成，成功生成 {success_count} 条对话")
            
        except Exception as e:
            logger.exception(f"任务 {task_id} 执行失败: {e}")
            
            # 更新任务状态为失败
            try:
                self.storage.update_task(task_id, {
                    'status': 'FAILED',
                    'completed_at': datetime.now().isoformat(),
                    'error_message': str(e)
                })
            except Exception as update_error:
                logger.error(f"更新任务状态失败: {update_error}")
        
        finally:
            # 清理running_tasks
            with self._lock:
                if task_id in self.running_tasks:
                    del self.running_tasks[task_id]
    
    def cancel_task(self, task_id: str) -> bool:
        """
        取消正在运行的任务
        
        Args:
            task_id: 任务ID
            
        Returns:
            是否成功取消
        """
        with self._lock:
            if task_id not in self.running_tasks:
                logger.warning(f"任务 {task_id} 未在运行")
                return False
            
            # 取消异步任务
            task = self.running_tasks[task_id]
            task.cancel()
            
            # 更新任务状态
            self.storage.update_task(task_id, {
                'status': 'CANCELLED',
                'completed_at': datetime.now().isoformat()
            })
            
            del self.running_tasks[task_id]
            
            logger.info(f"任务 {task_id} 已取消")
            return True

    async def _extract_portraits_from_file(
        self,
        task_id: str,
        input_file: str,
        output_file: str,
        extractor: PortraitExtractor,
        batch_size: int = 5
    ) -> (int, int):
        """
        从文件批量抽取用户画像（并发）
        
        文件格式：每行一个 JSON 对象或 JSON 数组，内容为 messages 或包含 messages 字段
        输出：JSONL，每行包含 messages 与 portrait
        """
        total_count = 0
        with open(input_file, 'r', encoding='utf-8') as f:
            for line in f:
                if line.strip():
                    total_count += 1

        self.storage.update_task(task_id, {
            'progress': {
                'total': total_count,
                'completed': 0,
                'failed': 0,
                'success_rate': 0.0
            }
        })

        # 清空输出文件
        with open(output_file, 'w', encoding='utf-8'):
            pass

        semaphore = asyncio.Semaphore(max(batch_size, 1))
        write_lock = asyncio.Lock()
        counter_lock = asyncio.Lock()
        completed = 0
        failed = 0

        async def update_progress():
            try:
                success_rate = (completed / total_count * 100) if total_count > 0 else 0
                self.storage.update_task(task_id, {
                    'progress': {
                        'total': total_count,
                        'completed': completed,
                        'failed': failed,
                        'success_rate': success_rate
                    }
                })
            except Exception as e:
                logger.error(f"更新进度失败: {e}")

        async def parse_messages(raw: str):
            try:
                payload = json.loads(raw)
            except Exception as e:
                raise ValueError(f"解析JSON失败: {e}")

            if isinstance(payload, list):
                return payload
            if isinstance(payload, dict):
                if 'messages' in payload and isinstance(payload['messages'], list):
                    return payload['messages']
            raise ValueError("未找到messages字段或格式不正确")

        async def process_line(idx: int, raw_line: str):
            nonlocal completed, failed
            async with semaphore:
                record = {
                    'index': idx,
                }
                try:
                    messages = await parse_messages(raw_line)
                    record['messages'] = messages
                    portrait = await extractor.extract_portrait(messages)
                    if not portrait:
                        raise ValueError("画像抽取失败")
                    portrait_id = str(uuid.uuid4())
                    if isinstance(portrait, dict):
                        portrait['portrait_id'] = portrait_id
                    record['portrait_id'] = portrait_id
                    record['portrait'] = portrait
                    record['success'] = True
                    async with counter_lock:
                        completed += 1
                        await update_progress()
                except Exception as e:
                    record['success'] = False
                    record['error'] = str(e)
                    async with counter_lock:
                        failed += 1
                        await update_progress()

                async with write_lock:
                    with open(output_file, 'a', encoding='utf-8') as out_f:
                        out_f.write(json.dumps(record, ensure_ascii=False) + "\n")

        tasks = []
        with open(input_file, 'r', encoding='utf-8') as f:
            for idx, line in enumerate(f):
                if not line.strip():
                    continue
                tasks.append(asyncio.create_task(process_line(idx, line.strip())))

        if tasks:
            await asyncio.gather(*tasks)

        return completed, failed
    
    async def _evaluate_dialogues_from_file(
        self,
        task_id: str,
        input_file: str,
        output_file: str,
        evaluator,
        batch_size: int = 5
    ) -> (int, int):
        """
        从文件批量评估对话质量（并发）
        
        文件格式：每行一个 JSON 对象，包含 messages 字段
        输出：JSONL，每行包含 messages、evaluation 和评估结果
        """
        total_count = 0
        with open(input_file, 'r', encoding='utf-8') as f:
            for line in f:
                if line.strip():
                    total_count += 1

        self.storage.update_task(task_id, {
            'progress': {
                'total': total_count,
                'completed': 0,
                'failed': 0,
                'success_rate': 0.0
            }
        })

        # 清空输出文件
        with open(output_file, 'w', encoding='utf-8'):
            pass

        semaphore = asyncio.Semaphore(max(batch_size, 1))
        write_lock = asyncio.Lock()
        counter_lock = asyncio.Lock()
        completed = 0
        failed = 0

        async def update_progress():
            try:
                success_rate = (completed / total_count * 100) if total_count > 0 else 0
                self.storage.update_task(task_id, {
                    'progress': {
                        'total': total_count,
                        'completed': completed,
                        'failed': failed,
                        'success_rate': success_rate
                    }
                })
            except Exception as e:
                logger.error(f"更新进度失败: {e}")

        async def parse_messages(raw: str):
            try:
                payload = json.loads(raw)
            except Exception as e:
                raise ValueError(f"解析JSON失败: {e}")

            if isinstance(payload, list):
                return payload
            if isinstance(payload, dict):
                if 'conversation' in payload and isinstance(payload['conversation'], list):
                    return payload['conversation']
            raise ValueError("未找到conversation字段或格式不正确")

        async def process_line(idx: int, raw_line: str):
            nonlocal completed, failed
            async with semaphore:
                record = {
                    'index': idx,
                }
                try:
                    messages = await parse_messages(raw_line)
                    record['conversation'] = messages
                    record['evaluation_id'] = str(uuid.uuid4())
                    
                    # 调用评估器
                    evaluation = await evaluator.evaluate_dialogue(messages)
                    if not evaluation:
                        raise ValueError("评估失败")
                    
                    record['evaluation'] = evaluation
                    record['success'] = True
                    async with counter_lock:
                        completed += 1
                        if completed % 5 == 0 or completed == total_count:
                            await update_progress()
                except Exception as e:
                    record['success'] = False
                    record['error'] = str(e)
                    async with counter_lock:
                        failed += 1
                        if (completed + failed) % 5 == 0 or (completed + failed) == total_count:
                            await update_progress()

                async with write_lock:
                    with open(output_file, 'a', encoding='utf-8') as out_f:
                        out_f.write(json.dumps(record, ensure_ascii=False) + "\n")

        tasks = []
        with open(input_file, 'r', encoding='utf-8') as f:
            for idx, line in enumerate(f):
                if not line.strip():
                    continue
                tasks.append(asyncio.create_task(process_line(idx, line.strip())))

        if tasks:
            await asyncio.gather(*tasks)

        # 计算质量评估统计数据
        evaluation_stats = await self._calculate_evaluation_stats(output_file)

        return completed, failed, evaluation_stats
    
    async def _calculate_evaluation_stats(self, output_file: str) -> Dict[str, Any]:
        """
        计算质量评估的统计数据
        
        规则：每个对话包含约20个维度的评分，只要有任意一个维度评分为0，该对话即为不通过（0分），否则为通过（1分）
        
        Args:
            output_file: 评估结果文件路径
            
        Returns:
            统计数据字典 {total_evaluated, passed_count, pass_rate}
        """
        total_evaluated = 0
        passed_count = 0
        
        try:
            with open(output_file, 'r', encoding='utf-8') as f:
                for line in f:
                    if not line.strip():
                        continue
                    
                    try:
                        record = json.loads(line)
                        
                        # 只统计成功评估的对话
                        if not record.get('success', False):
                            continue
                        
                        evaluation = record.get('evaluation', {})
                        if not evaluation:
                            continue
                        
                        total_evaluated += 1
                        
                        # 获取评分详情
                        score_detail = evaluation.get('score_detail', evaluation)
                        
                        # 检查所有维度的评分
                        all_non_zero = True
                        for key, value in score_detail.items():
                            if key.endswith('_评分'):
                                try:
                                    score = float(value) if isinstance(value, (int, float, str)) else 0
                                    if score == 0:
                                        all_non_zero = False
                                        break
                                except (ValueError, TypeError):
                                    all_non_zero = False
                                    break
                        
                        if all_non_zero:
                            passed_count += 1
                    
                    except json.JSONDecodeError:
                        logger.warning(f"无法解析评估结果行: {line[:100]}")
                        continue
        
        except Exception as e:
            logger.error(f"计算评估统计数据失败: {e}")
        
        # 计算通过率
        pass_rate = (passed_count / total_evaluated * 100) if total_evaluated > 0 else 0.0
        
        return {
            'total_evaluated': total_evaluated,
            'passed_count': passed_count,
            'pass_rate': round(pass_rate, 2)
        }
    
    def get_task_status(self, task_id: str) -> Optional[Dict[str, Any]]:
        """
        获取任务状态
        
        Args:
            task_id: 任务ID
            
        Returns:
            任务信息字典
        """
        return self.storage.get_task(task_id)
