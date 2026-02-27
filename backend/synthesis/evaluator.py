"""
对话质量评估模块 - 统一评估逻辑
"""
import asyncio
import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)


from core.dialogue_demo.online_evaluation import online_evaluate
EVALUATOR_AVAILABLE = True



class DialogueEvaluator:
    """
    对话质量评估器
    
    封装了对话质量评估的核心逻辑，保证合成演示和任务执行器使用相同的评估方法
    """
    
    def __init__(self):
        if not EVALUATOR_AVAILABLE:
            raise RuntimeError("评分模块不可用，无法初始化 DialogueEvaluator")
    
    async def evaluate_dialogue(
        self, 
        messages: List[Dict[str, str]], 
        ext: Optional[Dict[str, Any]] = None
    ) -> Optional[Dict[str, Any]]:
        """
        评估单个对话
        
        Args:
            messages: 对话消息列表，格式为 [{"role": "user", "content": "..."}, ...]
            ext: 扩展信息，如 {"identity": "Yes", "b2x": "B2C"}
            
        Returns:
            评估结果字典，包含各维度评分
        """
        if not ext:
            ext = {"identity": "Yes", "b2x": "B2C"}
        
        try:
            result = await online_evaluate(history=messages, ext=ext)
            return result
        except Exception as e:
            logger.error(f"评估对话失败: {e}")
            return None
    
    def evaluate_dialogue_sync(
        self, 
        messages: List[Dict[str, str]], 
        ext: Optional[Dict[str, Any]] = None
    ) -> Optional[Dict[str, Any]]:
        """
        评估单个对话（同步版本）
        
        Args:
            messages: 对话消息列表
            ext: 扩展信息
            
        Returns:
            评估结果字典
        """
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            result = loop.run_until_complete(self.evaluate_dialogue(messages, ext))
            return result
        finally:
            loop.close()
    
    async def batch_evaluate_dialogues(
        self,
        dialogues: List[Dict[str, Any]],
        batch_size: int = 5,
        ext: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """
        批量评估对话
        
        Args:
            dialogues: 对话列表，每项包含 messages 字段
            batch_size: 并发批次大小
            ext: 扩展信息
            
        Returns:
            评估结果列表
        """
        if not ext:
            ext = {"identity": "Yes", "b2x": "B2C"}
        
        results = []
        semaphore = asyncio.Semaphore(batch_size)
        
        async def evaluate_one(dialogue: Dict[str, Any]) -> Dict[str, Any]:
            async with semaphore:
                messages = dialogue.get('messages', [])
                evaluation = await self.evaluate_dialogue(messages, ext)
                
                return {
                    **dialogue,
                    'evaluation': evaluation,
                    'evaluated': evaluation is not None
                }
        
        tasks = [evaluate_one(dialogue) for dialogue in dialogues]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # 处理异常
        processed_results = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                logger.error(f"评估第 {i} 条对话失败: {result}")
                processed_results.append({
                    **dialogues[i],
                    'evaluation': None,
                    'evaluated': False,
                    'error': str(result)
                })
            else:
                processed_results.append(result)
        
        return processed_results


def is_evaluator_available() -> bool:
    """检查评估器是否可用"""
    return EVALUATOR_AVAILABLE


def get_evaluator() -> DialogueEvaluator:
    """获取评估器实例"""
    return DialogueEvaluator()
