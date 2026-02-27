from typing import List, Any
from pydantic import BaseModel, Field


class SystemPromptInput(BaseModel):
    """系统提示词输入参数模型"""
    
    sub_metrics: Any = Field(..., description="维度细则")
    dialogs: Any = Field(..., description="对话内容")
    rag_ref: Any = Field(..., description="FAQ参考内容")
    service_policy: Any = Field(..., description="SOP服务政策")
    identity: Any = Field(default="", description="核身状态")
    b2x: Any = Field(default="", description="所属的团队")
    GoodCase_dialog: str = Field(default="", description="好案例对话")
    GoodCase_score: int = Field(default=1, description="好案例分数")
    GoodCase_scorereason: str = Field(default="", description="好案例评分原因")
    BadCase_dialog: str = Field(default="", description="坏案例对话")
    BadCase_score: int = Field(default=0, description="坏案例分数")
    BadCase_scorereason: str = Field(default="", description="坏案例评分原因")


class ScoringDimensions(BaseModel):
    dim_code: str = Field(..., description="维度代号")
    dim_name: str = Field(..., description="维度名称")
