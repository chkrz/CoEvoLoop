import copy
import re
import uuid
import json
import importlib
import traceback
from typing import Dict, Any
from datetime import datetime

from core.utils.json_utils import parse_json
from core.utils.llm_utils import parse_think
from core.onemodel.assistant.assistant_model_inference import query_assistant, PROMPT_MODULE_PATH
from core.onemodel.user.user import UserSimulatorPortrait
from core.onemodel.utils import LinkReplacer


week_list = ["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"]


async def generate_one_dialogue(
    *,
    input_data: Dict[str, Any],
    assistant_model: str,
    user_model: str,
    is_simulate = False,
    with_sop = False,
    with_rag = False,
    prompt_version="v0",
    link_mapping: bool = True,
    mapping_file: str = None,
    max_turns = 10,
    enable_thinking = True,
    response_parser = parse_think,
    one_prompt_mode = True,
):
    conversation = []

    path = f"{PROMPT_MODULE_PATH}.{prompt_version}"
    module = importlib.import_module(path)

    user_simulator = UserSimulatorPortrait(
        user_model_name=user_model,
        user_portrait=input_data["portrait"]
    ) if is_simulate else None
    user_identity = input_data.get("user_info", {}).get("identity", "yes")
    user_identity = False if user_identity.lower() == "no" else True

    try:
        date = input_data.get("user_info", {}).get("date", "")
        weekday = week_list[datetime.strptime(date, "%Y-%m-%d").weekday()]
        time = f"{date} {weekday}"
    except:
        time = ""

    context = [{"role": "system", "content": module.get_system_prompt({"time": time})}]
    if not is_simulate:
        max_turns = len(input_data["query"])

    for turn in range(max_turns):
        try:

            user_response = await user_simulator.query_user(conversation=conversation)
            user_response = parse_json(user_response)
            assert "content" in user_response and "end_conversation" in user_response

            if user_simulator.check_ending(user_response):
                break
            user_message = user_response["content"]

            formatted_rag = ""
            formatted_sop = ""

            response = await query_assistant(
                model=assistant_model,
                user_message=user_message,
                conversation=conversation,
                context=context,
                formatted_rag=formatted_rag,
                formatted_sop=formatted_sop,
                identity=user_identity,
                prompt_version=prompt_version,
                enable_thinking=enable_thinking,
                one_prompt_mode=one_prompt_mode,
                link_mapping=link_mapping,
                mapping_file=mapping_file,
                time=time,
                ext=input_data.get("ext", {})
            )
            # print(response)
            reasoning, response_content = response_parser(response)

            # replace back link
            replaced_response_content = response_content
            if link_mapping:
                replacer = LinkReplacer(mapping_file)
                replaced_response_content = replacer.replace_links_back(replaced_response_content)

            # 只有conversation的部分是replace back的
            conversation.append({"role": "user", "content": user_message})
            conversation.append({"role": "assistant", "content": replaced_response_content})
            context.append({"role": "assistant", "content": f"<think>\n{reasoning}\n</think>\n\n{response_content}"})
        except Exception as e:
            print(traceback.format_exc())
            print(f"Retry turn {turn}")

    uid = str(uuid.uuid4())
    if "uuid" in input_data:
        uid = input_data["uuid"]
    elif "uid" in input_data:
        uid = input_data["uid"]

    inference_result = {
        "uuid": uid,
        "conversation": conversation,
        "context": context,
        "ext": input_data.get("ext") or {"portrait": input_data.get("portrait"), "user_info": input_data.get("user_info")},
    }
    return inference_result
