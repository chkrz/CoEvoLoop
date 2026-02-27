import json
from core.llm.openai_config import call_llm
from core.onemodel.user.prompt.prompt_v0 import user_prompt, assistant_start_response


class UserSimulatorPortrait:
    def __init__(
        self,
        user_portrait,
        user_model_name="dashscope/qwen3-235b-a22b",
    ):
        self.user_portrait = self._preprocess_portrait(user_portrait)
        self.model = user_model_name

    def _preprocess_portrait(self, portrait):
        new_event_list = []
        for event in portrait["操作历史"]:
            if "客服" in json.dumps(event, ensure_ascii=False):
                continue
            new_event_list.append(event)
        portrait["操作历史"] = new_event_list
        return portrait

    @staticmethod
    def check_ending(response):
        if (
                response["end_conversation"] is True
                or "谢谢" in response["content"]
        ):
            return True
        else:
            return False

    async def _call_user_model(self, model_input):
        """使用 OpenAI API 调用用户模拟器模型"""
        try:
            # 如果没有指定模型，使用默认的用户模拟器模型
            model = self.model
            response = await call_llm(
                model=model,
                messages = [{"role": "user", "content": model_input}],
                temperature=0.6,
                extra_body = {"chat_template_kwargs": {"enable_thinking": False}}
            )
        except KeyboardInterrupt:
            exit(1)
        except Exception as e:
            response = None
        return response

    def conversation_to_history(self, conversation):
        history = [{"role": "assistant", "content": assistant_start_response}]
        history.extend(conversation)
        role_mapping = {"user": "用户", "assistant": "客服"}
        formatted_history = [f"{role_mapping[h['role']]}: {h['content']}" for h in history]
        return formatted_history

    async def query_user(self, conversation):
        history = self.conversation_to_history(conversation)
        history = "\n".join(history)
        model_input = (
            user_prompt.replace("{portrait}", json.dumps(self.user_portrait, ensure_ascii=False, indent=2))
            .replace("{history}", history)
        )
        response_content = await self._call_user_model(model_input)
        return response_content
