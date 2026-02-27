"""
用户画像提取模块
基于对话内容提取用户画像（背景、知识盲区、操作历史、问题描述等）
"""
import json
import re
import logging
import asyncio
from typing import Dict, List, Optional
import sys

from core.llm.openai_config import call_llm

logger = logging.getLogger(__name__)


class PortraitExtractor:
    """用户画像提取器（使用 fintl_ai 统一接口）"""
    
    PROMPT_TEMPLATE = """你是一个专业的客服对话分析师。请仔细阅读以下客服与用户的对话记录，并根据提供的JSON模板,提取并填充所有必要信息，生成一份完整的用户画像。请确保所有信息都准确地反映了对话内容。

# 对话内容
{dialogue}

# 输出内容
{{
  "背景描述": List[str],
  "知识盲区": List[str],
  "操作历史": [
    {{
      "timestamp": str,
      "action": str,
      "target": str,
      "result": str,
      "details": str
    }}
  ],
  "问题描述": List[str]
}}

## 说明
- **操作历史**指的是用户在和客服对话之前的操作历史，如果没有操作历史就置空`[]`，不要包含当前对话中的操作；
- 如果无法得知**操作历史**中操作的发生时间，对应timestamp就填"未知"；
- **问题描述**和**操作历史**的关系：**问题描述**是用户在完成**操作历史**中的操作后遇到的问题或者核心疑问，**问题描述**需要清晰直接，不要添油加醋；
- **输出内容**是询问客服前的用户画像，因此需要注意，不要包含和对话中客服相关的表述；

# 输出
你的输出是：
"""
    
    def __init__(
        self,
        model: str = None,
        llm_params: Dict = None
    ):
        """
        初始化画像提取器
        
        Args:
            model: 模型名称（默认使用配置文件中的 PORTRAIT_EXTRACTOR_MODEL）
            model_type: 模型类型（默认使用配置文件中的 PORTRAIT_EXTRACTOR_MODEL_TYPE）
            llm_params: LLM 参数（默认使用 DEFAULT_LLM_PARAMS）
        """
        self.model = model or "dashscope/qwen3-235b-a22b"
        logger.info(f"PortraitExtractor initialized with model={self.model}")
    
    @staticmethod
    def messages_to_dialogue(messages: List[Dict[str, str]]) -> str:
        """
        将消息列表转换为对话文本
        
        Args:
            messages: 消息列表 [{"role": "user", "content": "..."}, ...]
        
        Returns:
            对话文本
        """
        utterances = []
        role_mapping = {"user": "用户", "assistant": "客服"}
        
        for msg in messages:
            role = role_mapping.get(msg["role"], msg["role"])
            content = msg["content"].replace("\n", "\\n")
            utterances.append(f"{role}：{content}")
        
        return "\n".join(utterances)
    
    @staticmethod
    def parse_json_response(response: str) -> Optional[Dict]:
        """
        解析 LLM 返回的 JSON
        
        Args:
            response: LLM 响应文本
        
        Returns:
            解析后的 JSON 对象，解析失败返回 None
        """
        # 尝试直接解析
        try:
            return json.loads(response)
        except json.JSONDecodeError:
            pass
        
        # 尝试提取 ```json...``` 代码块
        json_match = re.search(r'```json\s*(.*?)\s*```', response, re.DOTALL)
        if json_match:
            try:
                return json.loads(json_match.group(1))
            except json.JSONDecodeError:
                pass
        
        # 尝试提取 {...}
        json_match = re.search(r'\{.*\}', response, re.DOTALL)
        if json_match:
            try:
                return json.loads(json_match.group(0))
            except json.JSONDecodeError:
                pass
        
        logger.warning(f"Failed to parse JSON response: {response[:200]}")
        return None
    
    async def _call_llm(self, prompt: str) -> Optional[str]:
        """
        调用 LLM 生成响应（使用 fintl_ai 统一接口）
        
        Args:
            prompt: 提示词
        
        Returns:
            LLM 响应文本，失败返回 None
        """
        try:
            logger.info(f"Calling LLM with model={self.model}")
            response = await call_llm(
                model=self.model,
                messages=[
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                max_tokens=3000,
            )
            return response
        
        except Exception as e:
            logger.exception(f"Error calling LLM: {e}")
            return None
    
    async def extract_portrait(
        self,
        messages: List[Dict[str, str]]
    ) -> Optional[Dict]:
        """
        从对话中提取用户画像
        
        Args:
            messages: 对话消息列表
        
        Returns:
            用户画像 JSON 对象，失败返回 None
        """
        try:
            # 转换为对话文本
            dialogue = self.messages_to_dialogue(messages)
            
            # 构造 prompt
            prompt = self.PROMPT_TEMPLATE.format(dialogue=dialogue)
            
            # 调用 LLM
            response_text = await self._call_llm(prompt)
            
            if not response_text:
                logger.error("Failed to get response from LLM")
                return None
            
            logger.info(f"LLM response: {response_text[:500]}...")
            
            # 解析 JSON
            portrait = self.parse_json_response(response_text)
            
            if portrait:
                logger.info("Successfully extracted portrait")
                return portrait
            else:
                logger.error("Failed to parse portrait from LLM response")
                return None
        
        except Exception as e:
            logger.exception(f"Error during portrait extraction: {e}")
            return None
    
    async def extract_portrait_from_dialogue(
        self,
        dialogue: str
    ) -> Optional[Dict]:
        """
        从对话文本中提取用户画像（已格式化的对话）
        
        Args:
            dialogue: 对话文本（格式：用户：xxx\\n客服：xxx）
        
        Returns:
            用户画像 JSON 对象，失败返回 None
        """
        try:
            # 构造 prompt
            prompt = self.PROMPT_TEMPLATE.format(dialogue=dialogue)
            
            # 调用 LLM
            response_text = await self._call_llm(prompt)
            
            if not response_text:
                logger.error("Failed to get response from LLM")
                return None
            
            logger.info(f"LLM response: {response_text[:500]}...")
            
            # 解析 JSON
            portrait = self.parse_json_response(response_text)
            
            if portrait:
                logger.info("Successfully extracted portrait")
                return portrait
            else:
                logger.error("Failed to parse portrait from LLM response")
                return None
        
        except Exception as e:
            logger.exception(f"Error during portrait extraction: {e}")
            return None
