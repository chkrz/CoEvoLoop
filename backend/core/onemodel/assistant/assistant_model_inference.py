import importlib

from core.llm.openai_config import call_llm
from core.onemodel.utils import LinkReplacer


MAX_CONTEXT_ROUND = 9
PROMPT_MODULE_PATH = "core.onemodel.assistant.prompt"


async def query_assistant(
    *,
    model,
    user_message,
    conversation,
    context,
    formatted_rag,
    formatted_sop,
    identity=True,
    prompt_version="v0",
    one_prompt_mode=True,
    enable_thinking=True,
    link_mapping: bool = True,
    mapping_file: str = "link_mapping.json",
    time="",
    ext={}
):
    path = f"{PROMPT_MODULE_PATH}.{prompt_version}"
    module = importlib.import_module(path)

    core_question = ext.get("core_question") or ""
    if core_question == "nan":
        core_question = ""

    parameters = {
        "user_message": user_message,
        "conversation": conversation,
        "context": context,
        "formatted_rag": formatted_rag,
        "formatted_sop": formatted_sop,
        "identity": identity,
        "user_info": {"登陆状态": identity},
        "core_question": core_question,
    }

    if not enable_thinking:
        llm_params = {"chat_template_kwargs": {"enable_thinking": False}}
    else:
        llm_params = {"chat_template_kwargs": {"thinking": True}}

    assistant_prompt = module.get_user_prompt(parameters)
    if link_mapping:
        replacer = LinkReplacer(mapping_file)
        assistant_prompt = replacer.replace_links(assistant_prompt)
    context.append({"role": "user", "content": assistant_prompt})

    if one_prompt_mode:
        messages = [
            {"role": "system", "content": module.get_system_prompt({"time": time})},
            {"role": "user", "content": assistant_prompt},
        ]
    else:
        assert MAX_CONTEXT_ROUND >= 1
        messages = context[0:1] + context[1:][-MAX_CONTEXT_ROUND:]

    response = await call_llm(
        model=model,
        messages=messages,
        temperature=0.7,
        max_tokens=10000,
        extra_body=llm_params
    )

    return response
