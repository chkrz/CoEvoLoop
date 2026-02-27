import re
from typing import List, Tuple

from core.utils.json_utils import extract_json


def parse_think(text: str) -> Tuple[str | None, str]:
    if text is None:
        return None, ""
    think_pattern = r'<think>(.*?)</think>'
    think_match = re.search(think_pattern, text, re.DOTALL)
    if think_match:
        reasoning = think_match.group(1).strip()
        content = text[think_match.end():].strip()
    else:
        ts = text.split("</think>")
        if len(ts) == 2:
            reasoning, content = ts[0].replace("<think>", "").strip(), ts[1].strip()
        else:
            reasoning = None
            content = text.strip()
    return reasoning, content


def parse_think_extract_json(text: str) -> List[dict] | None:
    reasoning, json_str = parse_think(text)
    try:
        result = extract_json(json_str)
    except Exception as e:
        print(f"解析JSON失败: {e}, 内容: {json_str}")
        return None
    return result
