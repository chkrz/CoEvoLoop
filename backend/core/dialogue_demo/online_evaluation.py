from typing import List, Dict
import asyncio
from core.reward.pipeline.config import get_score_columns
from core.reward.pipeline.generate_score import generate_score


prompt_version = "prompt_v48"

dims = [
    'G01_遵循核身与信息保密性',
    'G03_遵循内部资料保密性',
    'G04_遵循客户信息保密性',
    'G05_情感反应得当',
    'G07_交流的语种一致性',
    'G08_跨团队转交准确性',
    'G10_无过度承诺',
    'G12_回答切题',
    'G17_回复简洁',
    'G18_是否完全理解用户意图',
    'G18_信息正确',
    'G18_前后表达一致',
    'G19_有效推进',
    'G19_上下文记忆',
    'G19_主题遵从',
    'G19_主题切换',
    'G20_核身场景必要性与问题清单合规性',
    'G23_客户认知纠正与政策解释',
    'G25_服务礼貌',
    'G26_语言流畅性'
]


async def online_evaluate(
    history: List[Dict[str, str]],
    ext: Dict[str, str],
    score_model = None
):
    eval_data = {
        "messages": history,
        "dims": dims,
        "faq": None,
        "sop": None,
        "identity": ext.get("identity") or "Yes",
        "b2x": ext.get("b2x") or "B2C",
    }

    score_csv_columns = get_score_columns(dims)

    try:
        score_response = await generate_score(
            data=eval_data,
            max_concurrency=5,
            score_model=score_model,
            prompt_version=prompt_version
        )

        eval_result = {
            **{column: None for column in score_csv_columns}
        }

        for sr, sr_value in score_response["score"].items():
            if isinstance(sr_value, dict):
                for k, v in sr_value.items():
                    eval_result[k] = v
    except Exception as e:
        return None

    return eval_result


if __name__ == "__main__":
    hist = [
        {"role": "user", "content": "万里汇汇款"},
        {"role": "assistant", "content": "好的"},
    ]
    r = asyncio.run(online_evaluate(history=hist, ext={"identity": "", "b2x": ""}))
    print(r)
