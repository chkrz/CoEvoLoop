
from typing import List, Dict, Any, Optional

from datetime import datetime
from core.utils.llm_utils import parse_think
from core.onemodel.assistant.assistant_model_inference import query_assistant


async def online_one_model_response(
    model_name: str,
    history: List[Dict[str, Any]],
    context: Any,
    query: str,
    turn: int,
    prompt_version="v0"
):

    # TODO: 确认下context传进来长什么样子
    if isinstance(context, dict) and "context_messages" in context:
        context = context["context_messages"]
    elif isinstance(context, list):
        context = context
    else:
        raise ValueError("please confirm context format")

    formatted_rag = ""
    formatted_sop = ""

    response = await query_assistant(
        model=model_name,
        user_message=query,
        conversation=history,
        context=context,
        formatted_rag=formatted_rag,
        formatted_sop=formatted_sop,
        identity=True,
        prompt_version=prompt_version,
        enable_thinking=True,
    )

    history.append({"role": "user", "content": query})
    reasoning, response_content = parse_think(response)

    # replace back link
    history.append({"role": "assistant", "content": response_content})
    context.append({"role": "assistant", "content": response})

    return {
        "planner_record": [{
            "timestamp": str(datetime.now()),
            "action": "",
            "thought": reasoning or "",
            "user_goal": "",
            "selected_executor": None,
            "executor_parameters": {},
            "response": response_content,
        }],
        "answer": response_content,
        "planner_context": {
            'system_prompt': "",
            'context_messages': context
        }
    }


if __name__ == "__main__":
    import asyncio
    r = asyncio.run(
        online_one_model_response(
            history=[],
            context=[],
            query="如何申请亚马逊日本站",
            model_name="qwen3-32b-sft-data-v3",
            turn=0
        )
    )
    print(r)
