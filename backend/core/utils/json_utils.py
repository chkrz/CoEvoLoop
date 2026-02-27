from typing import Type, Optional

import json


def extract_json(text):
    """从文本中提取JSON对象"""
    results = []
    stack = []
    start_index = None
    in_string = False
    escape = False

    for i, char in enumerate(text):
        if not in_string:
            if char in ['{', '[']:
                if not stack:
                    start_index = i
                stack.append(char)
            elif char in ['}', ']']:
                if stack:
                    last = stack.pop()
                    if (char == '}' and last != '{') or (char == ']' and last != '['):
                        stack = []
                        start_index = None
                if not stack and start_index is not None:
                    candidate = text[start_index:i + 1]
                    try:
                        json_obj = json.loads(candidate)
                        results.append(json_obj)
                        start_index = None
                    except json.JSONDecodeError:
                        pass
            elif char == '"':
                in_string = True
        else:
            if escape:
                escape = False
            elif char == '\\':
                escape = True
            elif char == '"':
                in_string = False

    return results


def clean_json_content(text: str) -> str:
    """
    Clean JSON content by removing markdown code blocks and whitespace

    Args:
        text: Raw text that may contain JSON with markdown formatting

    Returns:
        Cleaned JSON string
    """
    clean_str = text.strip()
    if clean_str.startswith('```json'):
        clean_str = clean_str[len("```json"):].strip()
    if clean_str.endswith('```'):
        clean_str = clean_str[:-len("```")].strip()
    return clean_str


def parse_json(text: str) -> Optional[dict]:
    """
    Parse JSON text with basic cleanup for markdown code blocks

    Args:
        text: Raw text that may contain JSON

    Returns:
        Parsed JSON dict or None if parsing fails
    """
    clean_str = clean_json_content(text)
    try:
        json_result = json.loads(clean_str)
        return json_result
    except Exception as e:
        return None

