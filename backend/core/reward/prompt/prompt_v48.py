def get_prompt(dim_data, input_data):
    prompt_template = """
你的任务是根据一组对话（包含多组用户问题、问题相关知识、机器人回答），严格遵循以下评分维度、定义、及评分标准，按照格式生成你的评估结果。
---

# **评分维度与规则**
{sub_metrics}

# 最终评估输出要求
1. 请针对以上**维度**，分别给出评分和详细的评分理由。确保每个维度的评估都充分依据了上述标准。
2. 在评分过程中，如果评分维度，涉及需要根据<知识库知识>或者<服务策略SOP知识>中相关性很高的内容，则需要严格根据**外部参考资料输入**逐项分析评估，是否满足。

# **对话记录**
<对话记录>{dialogs}</对话记录> 

# **其他的外部参考资料输入**
<知识库知识>{rag_ref}</知识库知识>

<服务策略SOP知识>{service_policy}</服务策略SOP知识>

<核身情况>{identity}</核身情况>

<用户问题咨询类型>{b2x}</用户问题咨询类型>

# **输出格式**
{{
    "{维度代号}_{维度名称}_评分理由": "...",
    "{维度代号}_{维度名称}_评分": 0/1
}}""".strip()

    prompt = prompt_template.format(
        sub_metrics=input_data.sub_metrics,
        dialogs=input_data.dialogs,
        rag_ref=input_data.rag_ref,
        service_policy=input_data.service_policy,
        identity=input_data.identity,
        b2x=input_data.b2x,
        维度代号=dim_data.dim_code,
        维度名称=dim_data.dim_name,
    )

    return prompt
