import importlib
import logging

from core.reward.models.models import SystemPromptInput, ScoringDimensions

from core.reward.utils.utils import (
    openai_list_to_string,
    clean_and_extract_json
)
from core.reward.metrics.metric import get_limitation_variable
import asyncio
from typing import List, Any, Dict
from core.llm.openai_config import call_llm
import sys


logger = logging.getLogger(__name__)

logger.setLevel(logging.INFO)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    stream=sys.stdout  # 显式指定输出到标准输出
)


async def _score_one_dimension(
    *,
    idx: int,
    dimension_key: str,
    limitation_data: Dict[str, Any],
    dialog,
    faq,
    sop,
    identity,
    b2x,
    score_model: str,
    prompt_version: str,
    semaphore: asyncio.Semaphore
):
    """
    单个维度的并发任务函数。返回 (idx, response) 以便按顺序重组结果。
    """
    dim_data = ScoringDimensions(
        dim_code=limitation_data[dimension_key]['维度代号'],
        dim_name=limitation_data[dimension_key]['维度名称']
    )

    input_data = SystemPromptInput(
        sub_metrics=limitation_data[dimension_key]['维度细则'],
        dialogs=dialog,
        rag_ref=faq,
        service_policy=sop,
        identity=identity,
        b2x=b2x
    )

    prompt_module = importlib.import_module(
        f"core.reward.prompt.{prompt_version}")
    prompt = prompt_module.get_prompt(dim_data, input_data)

    async with semaphore:
        logger.info(score_model)
        logger.info(prompt)
        raw_response = await call_llm(
            model=score_model or "dashscope/qwen3-235b-a22b",
            messages = [
                {"role": "user", "content": prompt}
            ],
            temperature=0.1,
            max_tokens=2000
        )
        logger.info(raw_response)
        response = await clean_and_extract_json(raw_response)
        logger.info(response)
    return idx, dimension_key, response


async def get_score_concurrent(
    limitation_data: Dict[str, Any],
    dialog,
    faq,
    sop,
    identity,
    b2x,
    score_model: str,
    prompt_version: str,
    semaphore: asyncio.Semaphore,
) -> Dict[str, Any]:

    dimension_keys = list(limitation_data.keys())

    tasks = [
        asyncio.create_task(
            _score_one_dimension(
                idx=idx,
                dimension_key=dimension_key,
                limitation_data=limitation_data,
                dialog=dialog,
                faq=faq if limitation_data[dimension_key]["require_extra_knowledge"] else "",
                sop=sop if limitation_data[dimension_key]["require_extra_knowledge"] else "",
                identity=identity,
                b2x=b2x,
                score_model=score_model,
                prompt_version=prompt_version,
                semaphore=semaphore
            )
        )
        for idx, dimension_key in enumerate(dimension_keys)
    ]

    results_by_key = {}
    done = await asyncio.gather(*tasks, return_exceptions=True)

    for item in done:
        if isinstance(item, Exception):
            continue
        idx, key, resp = item
        results_by_key[key] = resp

    for key in dimension_keys:
        results_by_key.setdefault(key, {})

    return results_by_key


async def generate_score(data, max_concurrency, score_model=None, prompt_version="prompt_v0"):
    """
    生成评分
    
    Args:
        data: 评分数据
        max_concurrency: 最大并发数
        score_model: 评分模型
        prompt_version: Prompt 版本
    """
    semaphore = asyncio.Semaphore(max_concurrency)

    messages = data.get("messages", [])
    dialog = openai_list_to_string(messages)

    faq = data.get("faq", "")
    sop = data.get("sop", "")

    limitation_data = get_limitation_variable()

    responses = await get_score_concurrent(
        limitation_data=limitation_data,
        dialog=dialog,
        faq=faq,
        sop=sop,
        identity=data.get("identity") or "No" if data.get("登陆状态") == "未登陆" else "Yes",
        b2x=data.get("b2x", ""),
        score_model=score_model,
        prompt_version=prompt_version,
        semaphore=semaphore
    )

    score_result = {
        "faq": faq,
        "sop": sop,
        "score": responses
    }
    return score_result
