import os
import json
from typing import Optional
from pathlib import Path
import logging
from dotenv import load_dotenv
import litellm

logger = logging.getLogger(__name__)
load_dotenv()
MODEL_CONFIG_FILE = Path(__file__).parent.parent.parent.parent / "config" / "models.json"

# 配置 litellm
litellm.drop_params = True  # 自动丢弃不支持的参数
litellm.set_verbose = False  # 关闭详细日志


def load_model_config(model_name: str) -> tuple[str, Optional[str], Optional[str]]:
    """
    加载模型配置
    返回: (litellm_model_name, api_key, base_url)
    """
    config_path = Path(MODEL_CONFIG_FILE)
    
    if not config_path.exists():
        logger.warning(f"配置文件不存在: {config_path}，使用默认配置")
        return model_name, None, None
    
    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            config_data = json.load(f)
            models = config_data.get("models", {})
            
            if model_name in models:
                model_config = models[model_name]
                provider = model_config.get("provider", "").lower()

                api_key = os.getenv(f"{provider.upper()}_API_KEY")
                base_url = os.getenv(f"{provider.upper()}_BASE_URL")
                actual_model = model_config.get("model_name", model_name)

                litellm_model = f"{provider}/{actual_model}"
                logger.info(f"加载模型配置: {model_name} -> {litellm_model} (provider: {provider})")
                return litellm_model, api_key, base_url
            elif "/" in model_name:
                litellm_model = model_name.lower()
                provider, model_name = litellm_model.split("/")
                api_key = os.getenv(f"{provider.upper()}_API_KEY")
                return litellm_model, api_key, None
    except Exception as e:
        logger.warning(f"加载配置文件失败: {e}，使用默认配置")
    
    return model_name, None, None


async def call_llm(
    model: str,
    messages: list[dict],
    temperature: float = 0.7,
    max_tokens: Optional[int] = None,
    **kwargs
) -> str:
    """
    使用 LiteLLM 调用 LLM
    
    Args:
        model: 模型名称（会从配置文件中查找路由）
        messages: 聊天消息列表
        temperature: 温度参数
        max_tokens: 最大 token 数
        **kwargs: 其他参数
        
    Returns:
        生成的文本内容
    """
    # 加载模型配置
    litellm_model, api_key, base_url = load_model_config(model)
    
    # 准备 litellm 参数
    litellm_kwargs = {
        "model": litellm_model,
        "messages": messages,
        "temperature": temperature,
        "timeout": 180.0,
        **kwargs
    }
    
    # 添加可选配置
    if max_tokens:
        litellm_kwargs["max_tokens"] = max_tokens
    if api_key:
        litellm_kwargs["api_key"] = api_key
    if base_url:
        litellm_kwargs["api_base"] = base_url
    
    try:
        logger.info(litellm_kwargs)
        response = await litellm.acompletion(**litellm_kwargs)
        logger.info(response)
        return response.choices[0].message.content
    except Exception as e:
        logger.error(f"LLM 调用失败 (model={model}): {e}")
        raise


if __name__ == "__main__":
    import asyncio
    r = asyncio.run(call_llm(
        model="dashscope/qwen3-235b-a22b",
        messages=[{"role": "user", "content": "你好"}],
    ))
    print(r)
