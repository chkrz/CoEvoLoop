import json
import ast
import re


def openai_list_to_string(
    message_list,
    prefix_system="system:",
    prefix_user="user:",
    prefix_assistant="assistant:"
):
    """
    将OpenAI格式的消息列表转换为格式化的字符串

    参数:
        message_list (list): OpenAI格式的消息列表，每个元素包含role和content字段
        prefix_system (str): 系统消息前缀，默认为"system:"
        prefix_user (str): 用户消息前缀，默认为"user:"
        prefix_assistant (str): 助手消息前缀，默认为"assistant:"

    返回:
        str: 格式化的字符串，每条消息占一行，格式为"前缀:内容"

    示例:
        输入: [{"role": "system", "content": "You are a helpful assistant"}, {"role": "user", "content": "Hello"}, {"role": "assistant", "content": "Hi! How can I help you today?"}]
        输出: "system:You are a helpful assistant\nuser:Hello\nassistant:Hi! How can I help you today?"
    """
    if not message_list:
        return ""

    formatted_messages = []
    for msg in message_list:
        if msg["role"] == "system":
            formatted_messages.append(f"{prefix_system}{msg['content']}")
        elif msg["role"] == "user":
            formatted_messages.append(f"{prefix_user}{msg['content']}")
        elif msg["role"] == "assistant":
            formatted_messages.append(f"{prefix_assistant}{msg['content']}")

    return "\n".join(formatted_messages)


def _to_list_safe(input_data):
    """
    安全地将输入数据转换为列表形式
    如果解析失败，抛出 ValueError 异常

    Args:
        input_data: 输入数据，可以是列表、字符串形式的列表或普通字符串

    Returns:
        list: 统一的列表形式

    Raises:
        ValueError: 当输入数据格式不正确时
    """
    # 如果输入已经是列表，直接返回
    if isinstance(input_data, list):
        return input_data

    # 如果输入是字符串
    if isinstance(input_data, str):
        # 检查是否看起来像列表格式（包含方括号）
        if input_data.strip().startswith('[') and input_data.strip().endswith(']'):
            # 尝试使用json解析
            try:
                result = json.loads(input_data)
                if isinstance(result, list):
                    return result
            except json.JSONDecodeError:
                pass

            # 尝试使用ast.literal_eval
            try:
                result = ast.literal_eval(input_data)
                if isinstance(result, list):
                    return result
            except (ValueError, SyntaxError, MemoryError):
                pass

            # 如果看起来像列表但解析失败，抛出异常
            raise ValueError(f"无法解析的列表格式字符串: {input_data}")

        else:
            # 普通字符串，包装成列表返回
            return [input_data]

    # 其他类型，包装成列表
    return [input_data]


async def clean_and_extract_json(text):
    if not isinstance(text, str):
        return {}
    think_match = re.search(r'<think>\s*(.*?)\s*</think>', text, re.DOTALL)
    think_text = think_match.group(1).strip() if think_match else ""
    cleaned_text = re.sub(r'<think>.*?</think>', '', text, flags=re.DOTALL)
    cleaned_text_json = cleaned_text.strip().replace('\n\n', '\n').replace('\n', '').replace('```json','').replace('```','')
    cleaned_text_json = json.loads(cleaned_text_json)
    return cleaned_text_json
