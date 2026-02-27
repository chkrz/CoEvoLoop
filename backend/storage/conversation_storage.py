"""
简化版对话存储
直接使用 JSON 文件存储，无需复杂的 Manager 对象
"""
import json
import os
import uuid
from datetime import datetime
from typing import Dict, Any, List, Optional
from pathlib import Path
import logging

logger = logging.getLogger(__name__)


class ConversationStorage:
    """简化版对话存储类"""
    
    def __init__(self, base_dir: str = None):
        """
        初始化存储
        
        Args:
            base_dir: 存储根目录，默认为 项目根目录/tmp/conversations
        """
        if base_dir is None:
            # 获取项目根目录
            current_file = Path(__file__)
            project_root = current_file.parent.parent.parent
            base_dir = project_root / "backend" / "storage" / "conversations"
        
        self.base_dir = Path(base_dir)
        self.base_dir.mkdir(parents=True, exist_ok=True)
    
    def _get_conversation_path(self, user_id: str, conversation_id: str) -> Path:
        """获取对话文件路径"""
        user_dir = self.base_dir / user_id
        user_dir.mkdir(parents=True, exist_ok=True)
        return user_dir / f"{conversation_id}.json"
    
    def create_conversation(
        self,
        user_id: str,
        title: str = "新对话",
        model: str = "onemodel",
        service: str = None,
        conversation_id: str = None
    ) -> Dict[str, Any]:
        """
        创建新对话
        
        Args:
            user_id: 用户ID
            title: 对话标题
            model: 模型名称
            service: 服务名称
            conversation_id: 可选的对话ID，不提供则自动生成
            
        Returns:
            创建的对话对象
        """
        if conversation_id is None:
            conversation_id = str(uuid.uuid4())
        
        now = datetime.now().isoformat()
        
        conversation = {
            "conversation_id": conversation_id,
            "user_id": user_id,
            "title": title,
            "model": model,
            "service": service,
            "messages": [],
            "planner_records": [],
            "ext": {},  # 扩展信息，如 identity, b2x 等
            "created_at": now,
            "updated_at": now
        }
        
        self.save_conversation(user_id, conversation_id, conversation)
        logger.info(f"✅ 创建对话: user={user_id}, conversation={conversation_id}")
        
        return conversation
    
    def load_conversation(self, user_id: str, conversation_id: str) -> Optional[Dict[str, Any]]:
        """
        加载对话
        
        Args:
            user_id: 用户ID
            conversation_id: 对话ID
            
        Returns:
            对话对象，如果不存在返回 None
        """
        conversation_path = self._get_conversation_path(user_id, conversation_id)
        
        if not conversation_path.exists():
            logger.warning(f"⚠️ 对话不存在: {conversation_path}")
            return None
        
        try:
            with open(conversation_path, 'r', encoding='utf-8') as f:
                conversation = json.load(f)
            return conversation
        except Exception as e:
            logger.error(f"❌ 加载对话失败: {conversation_path}, error: {e}")
            return None
    
    def save_conversation(self, user_id: str, conversation_id: str, conversation: Dict[str, Any]) -> bool:
        """
        保存对话
        
        Args:
            user_id: 用户ID
            conversation_id: 对话ID
            conversation: 对话对象
            
        Returns:
            是否保存成功
        """
        conversation_path = self._get_conversation_path(user_id, conversation_id)
        
        try:
            # 更新时间戳
            conversation['updated_at'] = datetime.now().isoformat()
            
            with open(conversation_path, 'w', encoding='utf-8') as f:
                json.dump(conversation, f, ensure_ascii=False, indent=2)
            
            return True
        except Exception as e:
            logger.error(f"❌ 保存对话失败: {conversation_path}, error: {e}")
            return False
    
    def list_conversations(self, user_id: str) -> List[Dict[str, Any]]:
        """
        列出用户的所有对话
        
        Args:
            user_id: 用户ID
            
        Returns:
            对话列表，按更新时间倒序
        """
        user_dir = self.base_dir / user_id
        
        if not user_dir.exists():
            return []
        
        conversations = []
        for conversation_file in user_dir.glob("*.json"):
            try:
                with open(conversation_file, 'r', encoding='utf-8') as f:
                    conversation = json.load(f)
                    # 只返回必要的元数据，不包含完整消息
                    conversations.append({
                        "conversation_id": conversation["conversation_id"],
                        "title": conversation["title"],
                        "model": conversation.get("model"),
                        "message_count": len(conversation.get("messages", [])),
                        "created_at": conversation["created_at"],
                        "updated_at": conversation["updated_at"]
                    })
            except Exception as e:
                logger.warning(f"⚠️ 跳过损坏的对话文件: {conversation_file}, error: {e}")
                continue
        
        # 按更新时间倒序排列
        conversations.sort(key=lambda x: x["updated_at"], reverse=True)
        return conversations
    
    def delete_conversation(self, user_id: str, conversation_id: str) -> bool:
        """
        删除对话
        
        Args:
            user_id: 用户ID
            conversation_id: 对话ID
            
        Returns:
            是否删除成功
        """
        conversation_path = self._get_conversation_path(user_id, conversation_id)
        
        if not conversation_path.exists():
            logger.warning(f"⚠️ 对话不存在，无法删除: {conversation_path}")
            return False
        
        try:
            conversation_path.unlink()
            logger.info(f"✅ 删除对话: user={user_id}, conversation={conversation_id}")
            return True
        except Exception as e:
            logger.error(f"❌ 删除对话失败: {conversation_path}, error: {e}")
            return False
    
    def add_message(
        self,
        user_id: str,
        conversation_id: str,
        role: str,
        content: str
    ) -> bool:
        """
        添加消息到对话
        
        Args:
            user_id: 用户ID
            conversation_id: 对话ID
            role: 角色 (user/assistant)
            content: 消息内容
            
        Returns:
            是否添加成功
        """
        conversation = self.load_conversation(user_id, conversation_id)
        if conversation is None:
            return False
        
        message = {
            "message_id": str(uuid.uuid4()),
            "role": role,
            "content": content,
            "timestamp": datetime.now().isoformat()
        }
        
        conversation["messages"].append(message)
        return self.save_conversation(user_id, conversation_id, conversation)
    
    def add_planner_record(
        self,
        user_id: str,
        conversation_id: str,
        record: Dict[str, Any]
    ) -> bool:
        """
        添加规划记录
        
        Args:
            user_id: 用户ID
            conversation_id: 对话ID
            record: 规划记录对象
            
        Returns:
            是否添加成功
        """
        conversation = self.load_conversation(user_id, conversation_id)
        if conversation is None:
            return False
        
        conversation["planner_records"].append(record)
        return self.save_conversation(user_id, conversation_id, conversation)
    
    def get_current_turn(self, user_id: str, conversation_id: str) -> int:
        """
        获取当前对话轮数
        
        Args:
            user_id: 用户ID
            conversation_id: 对话ID
            
        Returns:
            当前轮数（从0开始）
        """
        conversation = self.load_conversation(user_id, conversation_id)
        if conversation is None:
            return 0
        
        # 每轮包含一个 user 消息和一个 assistant 消息
        messages = conversation.get("messages", [])
        user_message_count = sum(1 for msg in messages if msg["role"] == "user")
        return user_message_count - 1 if user_message_count > 0 else 0


# 全局单例
_storage_instance = None

def get_conversation_storage() -> ConversationStorage:
    """获取简化存储单例"""
    global _storage_instance
    if _storage_instance is None:
        _storage_instance = ConversationStorage()
    return _storage_instance
