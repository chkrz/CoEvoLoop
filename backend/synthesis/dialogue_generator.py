"""
对话生成器 - 基于用户画像和模拟器生成对话
支持用户模拟器和助手模拟器，生成完整的对话数据
"""
import asyncio
import json
import logging
import os
import uuid
from datetime import datetime
from typing import Dict, Any, List, Optional, Callable
from core.onemodel.inference import generate_one_dialogue
from core.utils.llm_utils import parse_think



logger = logging.getLogger(__name__)


class DialogueGenerator:
    """
    对话生成器
    
    基于用户画像，使用用户模拟器和助手模拟器生成对话
    输出格式包含：uuid, conversation, context
    """
    # 使用基于当前文件位置的相对路径
    MAPPING_FILE_PATH = os.path.join(os.path.dirname(__file__), "url_maps_v3.json")
    def __init__(
        self,
        user_model: str,
        assistant_model: str,
        temperature: float = 0.8,
        max_turns: int = 8,
        with_rag: bool = True,
        with_sop: bool = False,
        prompt_version: str = "v0",
    ):
        """
        初始化对话生成器
        
        Args:
            user_model: 用户模拟器使用的模型
            assistant_model: 助手模拟器使用的模型
            temperature: 生成温度
            max_turns: 最大对话轮数
            with_rag: 是否使用RAG
            with_sop: 是否使用SOP
            prompt_version: prompt版本
        """
        self.user_model = user_model
        self.assistant_model = assistant_model
        self.temperature = temperature
        self.max_turns = max_turns
        self.with_rag = with_rag
        self.with_sop = with_sop
        self.prompt_version = prompt_version
        
    async def generate_single_dialogue(
        self,
        portrait: Dict[str, Any],
        dialogue_id: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        生成单条对话
        
        Args:
            portrait: 用户画像数据
            dialogue_id: 对话ID（可选，不提供则自动生成）
            
        Returns:
            包含uuid, conversation, context的字典
        """
        if dialogue_id is None:
            dialogue_id = str(uuid.uuid4())
            
        try:
            # 准备输入数据
            input_data = {
                "portrait": portrait
            }
            
            # 调用生成函数
            result = await generate_one_dialogue(
                input_data=input_data,
                assistant_model=self.assistant_model,
                user_model=self.user_model,
                is_simulate=True,  # 使用用户模拟器
                with_sop=self.with_sop,
                with_rag=self.with_rag,
                mapping_file=self.MAPPING_FILE_PATH,
                prompt_version=self.prompt_version,
                response_parser=parse_think,
                max_turns=self.max_turns
            )
            
            if not result or "conversation" not in result:
                logger.error(f"生成对话失败，未返回conversation字段")
                return None
                
            # 提取conversation（纯对话）
            conversation = []
            for turn in result.get("conversation", []):
                if turn.get("role") in ["user", "assistant"]:
                    conversation.append({
                        "role": turn["role"],
                        "content": turn["content"]
                    })
            
            # 提取context（带system prompt和额外信息）
            context = result.get("context", [])
            
            # 添加ext字段中的portrait
            if context:
                # 确保context中包含ext字段
                ext_data = {
                    "portrait": portrait,
                    "user_info": result.get("user_info", {}),
                }
                # 添加到最后一条context消息
                if len(context) > 0 and "ext" not in context[-1]:
                    context[-1]["ext"] = ext_data
                else:
                    # 如果context为空或最后一条已有ext，添加新的context项
                    context.append({
                        "role": "system",
                        "content": "",
                        "ext": ext_data
                    })
            
            # 返回标准格式
            dialogue_data = {
                "dialogue_id": dialogue_id,
                "conversation": conversation,
                "context": context,
                "portrait": portrait
            }
            
            return dialogue_data
            
        except Exception as e:
            logger.exception(f"生成对话时发生错误: {e}")
            return None
    
    async def generate_dialogues_from_portraits(
        self,
        portraits: List[Dict[str, Any]],
        progress_callback: Optional[Callable[[int, int], None]] = None,
        batch_size: int = 5
    ) -> List[Dict[str, Any]]:
        """
        从多个用户画像批量生成对话
        
        Args:
            portraits: 用户画像列表
            progress_callback: 进度回调函数 (completed, total)
            batch_size: 批处理大小
            
        Returns:
            生成的对话列表
        """
        total = len(portraits)
        completed = 0
        results = []
        
        logger.info(f"开始生成对话，共 {total} 个画像")
        
        # 分批处理
        for i in range(0, total, batch_size):
            batch = portraits[i:i + batch_size]
            
            # 并发生成当前批次
            tasks = [
                self.generate_single_dialogue(portrait)
                for portrait in batch
            ]
            
            batch_results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # 过滤掉失败的结果
            for result in batch_results:
                if isinstance(result, Exception):
                    logger.error(f"批次生成失败: {result}")
                    completed += 1
                elif result is not None:
                    results.append(result)
                    completed += 1
                else:
                    completed += 1
                    
            # 调用进度回调
            if progress_callback:
                try:
                    progress_callback(completed, total)
                except Exception as e:
                    logger.error(f"进度回调失败: {e}")
                    
            logger.info(f"批次进度: {completed}/{total}")
        
        logger.info(f"对话生成完成，成功 {len(results)}/{total}")
        return results
    
    async def generate_dialogues_from_file(
        self,
        input_file: str,
        output_file: str,
        progress_callback: Optional[Callable[[int, int], None]] = None,
        batch_size: int = 5
    ) -> int:
        """
        从文件读取画像并生成对话，写入输出文件
        
        Args:
            input_file: 输入文件路径（JSONL格式，每行一个画像）
            output_file: 输出文件路径（JSONL格式）
            progress_callback: 进度回调函数
            batch_size: 批处理大小
            
        Returns:
            成功生成的对话数量
        """
        import os
        
        # 读取画像
        portraits = []
        try:
            with open(input_file, 'r', encoding='utf-8') as f:
                for line_num, line in enumerate(f, 1):
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        portrait_data = json.loads(line)
                        # 如果是完整的对话数据，提取portrait字段
                        if "portrait" in portrait_data:
                            portraits.append(portrait_data["portrait"])
                        else:
                            # 否则整行作为portrait
                            portraits.append(portrait_data)
                    except json.JSONDecodeError as e:
                        logger.warning(f"跳过无效JSON行 {line_num}: {e}")
        except Exception as e:
            logger.error(f"读取输入文件失败 {input_file}: {e}")
            raise
        
        if not portraits:
            logger.warning(f"未从文件中读取到有效画像: {input_file}")
            return 0
        
        logger.info(f"从文件读取到 {len(portraits)} 个画像")
        
        # 创建输出目录
        os.makedirs(os.path.dirname(output_file), exist_ok=True)
        
        # 生成对话
        total = len(portraits)
        completed = 0
        success_count = 0
        
        with open(output_file, 'w', encoding='utf-8') as f_out:
            for i in range(0, total, batch_size):
                batch = portraits[i:i + batch_size]
                
                # 并发生成
                tasks = [
                    self.generate_single_dialogue(portrait)
                    for portrait in batch
                ]
                
                batch_results = await asyncio.gather(*tasks, return_exceptions=True)
                
                # 写入成功的结果
                for result in batch_results:
                    completed += 1
                    
                    if isinstance(result, Exception):
                        logger.error(f"生成失败: {result}")
                    elif result is not None:
                        # 写入到文件
                        f_out.write(json.dumps(result, ensure_ascii=False) + "\n")
                        f_out.flush()  # 立即写入磁盘
                        success_count += 1
                
                # 调用进度回调
                if progress_callback:
                    try:
                        progress_callback(completed, total)
                    except Exception as e:
                        logger.error(f"进度回调失败: {e}")
                
                logger.info(f"进度: {completed}/{total}，成功: {success_count}")
        
        logger.info(f"对话生成完成，成功 {success_count}/{total}")
        return success_count


def create_generator_from_config(config: Dict[str, Any]) -> DialogueGenerator:
    """
    从配置创建生成器实例
    
    Args:
        config: 配置字典，应包含:
            - user_simulator: {model, model_type, model_url?}
            - assistant_model: {model, model_type, model_url?}
            - temperature: float (可选)
            - max_turns: int (可选)
            
    Returns:
        DialogueGenerator实例
    """
    user_simulator = config.get("user_simulator", {})
    assistant_model = config.get("assistant_model", {})
    
    return DialogueGenerator(
        user_model=user_simulator.get("model", "dashscope/qwen3-235b-a22b"),
        assistant_model=assistant_model.get("model", "dashscope/qwen3-235b-a22b"),
        temperature=config.get("temperature", 0.8),
        max_turns=config.get("max_turns", 8),
        with_rag=config.get("with_rag", True),
        with_sop=config.get("with_sop", False),
        prompt_version=config.get("prompt_version", "v0")
    )
