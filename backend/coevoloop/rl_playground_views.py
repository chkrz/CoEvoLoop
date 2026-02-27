"""
RL Playground Views - 用于上传和解析 RL 训练日志

支持功能:
1. Overview - 整体统计概览
2. Dimension Scores - 维度分数趋势分析
3. Rollout Trends - 训练趋势分析
4. Case Inspector - 单条数据查看
5. Step Comparison - 跨 Step 对比
"""

import json
import re
import os
import tempfile
import uuid
import hashlib
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
from collections import defaultdict
from functools import lru_cache
import threading

logger = logging.getLogger(__name__)

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from rest_framework.decorators import api_view, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework import status

from storage.rllog_storage import RLLogStorage


# Initialize storage
rl_log_storage = RLLogStorage()


# ==================== 缓存机制 ====================

class AnalysisCache:
    """
    分析结果缓存，避免重复计算
    使用 LRU 策略限制内存使用
    """
    def __init__(self, max_size: int = 10):
        self._cache: Dict[str, Dict] = {}
        self._access_order: List[str] = []
        self._max_size = max_size
        self._lock = threading.Lock()

    def get(self, log_id: str, key: str) -> Optional[Dict]:
        """获取缓存的分析结果"""
        cache_key = f"{log_id}:{key}"
        with self._lock:
            if cache_key in self._cache:
                # 更新访问顺序
                if cache_key in self._access_order:
                    self._access_order.remove(cache_key)
                self._access_order.append(cache_key)
                return self._cache[cache_key]
        return None

    def set(self, log_id: str, key: str, value: Dict):
        """设置缓存"""
        cache_key = f"{log_id}:{key}"
        with self._lock:
            # LRU 淘汰
            while len(self._cache) >= self._max_size:
                oldest = self._access_order.pop(0)
                self._cache.pop(oldest, None)

            self._cache[cache_key] = value
            if cache_key in self._access_order:
                self._access_order.remove(cache_key)
            self._access_order.append(cache_key)

    def invalidate(self, log_id: str):
        """使指定日志的所有缓存失效"""
        with self._lock:
            keys_to_remove = [k for k in self._cache if k.startswith(f"{log_id}:")]
            for k in keys_to_remove:
                self._cache.pop(k, None)
                if k in self._access_order:
                    self._access_order.remove(k)

    def clear(self):
        """清空所有缓存"""
        with self._lock:
            self._cache.clear()
            self._access_order.clear()


# 全局缓存实例
analysis_cache = AnalysisCache(max_size=20)


# ==================== 预编译正则表达式 ====================

# 预编译正则提高性能
ROLLOUT_SPLIT_PATTERN = re.compile(r'<PENALTY>|<RAG>|<END>')
DIALOG_PATTERN = re.compile(r'(user|assistant)\s*\n(.*?)(\n(?=user|\nassistant)|$)', re.DOTALL)
USER_PROFILE_PATTERNS = {
    key: re.compile(pattern, re.IGNORECASE)
    for key, pattern in {
        "用户层级": r"用户层级\s*[：:\s]\s*([^\n，,]+)",
        "客户层级": r"客户层级\s*[：:\s]\s*([^\n，,]+)",
        "问题类型": r"问题类型\s*[：:\s]\s*([^\n]+)",
        "问题描述": r"问题描述\s*[：:\s]\s*([^\n]+)",
        "用户意图": r"用户意图\s*[：:\s]\s*([^\n]+)",
        "历史记录": r"历史记录\s*[：:\s]\s*([^\n]+)",
        "用户情绪": r"用户情绪\s*[：:\s]\s*([^\n，,]+)",
        "紧急程度": r"紧急程度\s*[：:\s]\s*([^\n，,]+)",
        "业务类型": r"业务类型\s*[：:\s]\s*([^\n，,]+)",
        "场景": r"场景\s*[：:\s]\s*([^\n]+)",
        "客户名": r"客户名\s*[：:\s]\s*([^\n，,]+)",
        "联系方式": r"联系方式\s*[：:\s]\s*([^\n]+)",
        "level": r"level\s*[：:\s]\s*([^\n，,]+)",
        "tier": r"tier\s*[：:\s]\s*([^\n，,]+)",
        "intent": r"intent\s*[：:\s]\s*([^\n]+)",
    }.items()
}
JSON_PROFILE_PATTERN = re.compile(r'\{[^{}]*["\']?(用户|客户|user|profile|portrait)[^{}]*\}', re.IGNORECASE | re.DOTALL)


def calculate_average_scores(data_list: list) -> Dict[str, float]:
    """计算每个维度的平均分 - 优化版本"""
    if not isinstance(data_list, list) or not data_list:
        return {}

    key_sums = defaultdict(float)
    key_counts = defaultdict(int)

    for entry in data_list:
        if isinstance(entry, dict):
            for key, value in entry.items():
                try:
                    numeric_value = float(value)
                    key_sums[key] += numeric_value
                    key_counts[key] += 1
                except (ValueError, TypeError):
                    continue

    # 直接构建排序后的字典
    return dict(sorted(
        ((key, key_sums[key] / key_counts[key]) for key in key_sums),
        key=lambda x: x[0]
    ))


def extract_user_profile_from_system_prompt(system_prompt: str) -> Dict[str, str]:
    """从 system prompt 中提取用户画像信息 - 使用预编译正则"""
    profile = {}

    if not system_prompt:
        return profile

    # 使用预编译的正则表达式
    for key, pattern in USER_PROFILE_PATTERNS.items():
        match = pattern.search(system_prompt)
        if match:
            value = match.group(1).strip()
            if value and len(value) < 200:
                profile[key] = value

    # 如果没有匹配到任何字段，尝试提取 JSON 格式的用户画像
    if not profile:
        json_match = JSON_PROFILE_PATTERN.search(system_prompt)
        if json_match:
            try:
                json_str = json_match.group(0)
                parsed = json.loads(json_str.replace("'", '"'))
                if isinstance(parsed, dict):
                    for k, v in parsed.items():
                        if isinstance(v, str) and len(v) < 200:
                            profile[k] = v
            except:
                pass

    # 如果还是没有，提取第一段有意义的内容作为概述
    if not profile and system_prompt:
        summary = system_prompt[:300].strip()
        if summary:
            profile["概述"] = summary + ("..." if len(system_prompt) > 300 else "")

    return profile


def get_session_id(batch: Dict) -> str:
    """从 batch 中提取 session 标识（使用 system prompt 的 hash）"""
    rollouts = batch.get("rollouts") or []
    if rollouts:
        parts = ROLLOUT_SPLIT_PATTERN.split(rollouts[0])
        if len(parts) > 2:
            # 使用 system prompt 的前 200 个字符作为 session 标识
            system_prompt = parts[2][:200] if parts[2] else ""
            return hashlib.md5(system_prompt.encode()).hexdigest()[:12]
    return batch.get("uuid", f"batch_{id(batch)}")


def get_case_id_from_batch_index(batch_index: int, cases_per_step: int) -> int:
    """
    根据 batch index 计算 case id
    假设 balanced_batch=False，每个 step 的 case 顺序一致
    """
    return batch_index % cases_per_step


def detect_cases_per_step(data: List[Dict]) -> int:
    """
    自动检测每个 step 有多少个 case（batch）
    通过统计第一个出现的 step 的 batch 数量来确定
    """
    if not data:
        return 1

    # 找到第一个 step 的值
    first_step = None
    for batch in data:
        step = batch.get("step")
        if step is not None:
            first_step = step
            break

    if first_step is None:
        return 1

    # 统计第一个 step 有多少个 batch
    count = sum(1 for batch in data if batch.get("step") == first_step)
    return max(count, 1)


def group_batches_by_step(data: List[Dict]) -> Dict[int, List[Tuple[int, Dict]]]:
    """
    将 batches 按 step 分组，返回 {step: [(batch_index, batch), ...]}
    每个 step 内的顺序按原始出现顺序
    """
    step_groups = defaultdict(list)
    for i, batch in enumerate(data):
        step = batch.get("step")
        if step is not None:
            step_groups[step].append((i, batch))
    return dict(step_groups)


def get_batch_for_case_step(data: List[Dict], case_id: int, step: int) -> Tuple[Optional[int], Optional[Dict]]:
    """
    获取指定 case 在指定 step 的 batch
    case_id 是在该 step 内的位置（0-based）
    返回 (batch_index, batch) 或 (None, None)
    """
    # 收集该 step 的所有 batches
    step_batches = []
    for i, batch in enumerate(data):
        if batch.get("step") == step:
            step_batches.append((i, batch))

    if case_id < 0 or case_id >= len(step_batches):
        return None, None

    return step_batches[case_id]



def convert_string_to_openai_messages(dialog_string: str) -> List[Dict[str, str]]:
    """
    将对话字符串转换为 OpenAI 格式的消息列表 - 使用预编译正则
    """
    if not dialog_string:
        return []

    cleaned_string = dialog_string.strip()
    messages = []

    for match in DIALOG_PATTERN.finditer(cleaned_string):
        role = match.group(1).strip()
        content = match.group(2).strip()

        if content:
            messages.append({
                "role": role,
                "content": content
            })

    return messages


def parse_rollout_string(rollout_str: str) -> Dict[str, Any]:
    """
    解析单个 rollout 字符串，提取 penalty、RAG、system prompt 和对话
    使用预编译正则优化性能
    """
    parts = ROLLOUT_SPLIT_PATTERN.split(rollout_str)

    result = {
        "penalty": {},
        "rag_knowledge": "",
        "system_prompt": "",
        "trajectory": [],
        "raw": rollout_str,
        "user_info": {}  # 新增：用户信息字段
    }

    if len(parts) >= 1:
        try:
            penalty_data = eval(parts[0]) if parts[0].strip() else {}
            result["penalty"] = penalty_data
            # 提取 user_info 字段（如果存在于 penalty 中）
            if isinstance(penalty_data, dict) and 'user_info' in penalty_data:
                result["user_info"] = penalty_data.get('user_info', {})
        except Exception:
            result["penalty"] = {}

    if len(parts) >= 2:
        result["rag_knowledge"] = parts[1].strip()

    if len(parts) >= 3:
        result["system_prompt"] = parts[2].strip()

    if len(parts) >= 4:
        result["trajectory"] = convert_string_to_openai_messages(parts[3])

    return result


def parse_rollout_string_light(rollout_str: str) -> Dict[str, Any]:
    """
    轻量级解析 - 仅提取统计所需字段，不解析完整对话
    用于 overview/trends 等只需要统计数据的场景
    """
    parts = ROLLOUT_SPLIT_PATTERN.split(rollout_str)

    result = {
        "penalty": {},
        "has_switch_human": False,
        "switch_human_count": 0
    }

    if len(parts) >= 1 and parts[0].strip():
        try:
            result["penalty"] = eval(parts[0])
        except:
            pass

    # 只在对话部分搜索 "转人工"，避免完整解析
    if len(parts) >= 4:
        dialog = parts[3]
        count = dialog.count("转人工")
        result["has_switch_human"] = count > 0
        result["switch_human_count"] = count

    return result


def analyze_batch(batch_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    分析单个 batch 的数据
    """
    rollouts = batch_data.get("rollouts") or []
    scores = batch_data.get("scores") or []
    list_base_score_jsons = batch_data.get("list_base_score_jsons") or []

    # 解析所有 rollouts
    parsed_rollouts = [parse_rollout_string(r) for r in rollouts]

    # 统计数据
    switch_human_counts = {"0": 0, "1": 0, "2": 0}
    token_penalty_count = 0

    for parsed in parsed_rollouts:
        penalty = parsed.get("penalty", {})

        # 统计 token penalty
        if penalty.get("token_penalty") == -1:
            token_penalty_count += 1

        # 统计转人工次数
        trajectory = parsed.get("trajectory", [])
        switch_count = sum(1 for m in trajectory if "转人工" in m.get("content", ""))
        switch_human_counts[str(min(switch_count, 2))] += 1

    # 计算平均分
    mean_score = sum(scores) / len(scores) if scores else 0

    # 计算维度平均分
    avg_dimensions = calculate_average_scores(list_base_score_jsons)

    # 提取用户画像 - 优先从 user_info 字段获取，否则从 system_prompt 提取
    user_profile = {}
    user_info = {}
    if parsed_rollouts:
        # 优先使用 penalty 中的 user_info 字段
        user_info = parsed_rollouts[0].get("user_info", {})
        if user_info and isinstance(user_info, dict):
            # 将 user_info 转换为字符串格式的 user_profile
            user_profile = {k: str(v) for k, v in user_info.items() if v is not None}

        # 如果没有 user_info，则从 system_prompt 提取
        if not user_profile:
            system_prompt = parsed_rollouts[0].get("system_prompt", "")
            user_profile = extract_user_profile_from_system_prompt(system_prompt)

    return {
        "step": batch_data.get("step"),
        "parsed_rollouts": parsed_rollouts,
        "scores": scores,
        "list_base_score_jsons": list_base_score_jsons,
        "avg_dimensions": avg_dimensions,
        "user_profile": user_profile,
        "user_info": user_info,  # 新增：原始 user_info 字典
        "statistics": {
            "switch_human_counts": switch_human_counts,
            "token_penalty_count": token_penalty_count,
            "mean_score": mean_score,
            "num_rollouts": len(rollouts)
        }
    }


def validate_rl_log_format(data: List[Dict]) -> Tuple[bool, str, Dict]:
    """
    验证 RL 日志格式是否正确
    返回: (is_valid, error_message, stats)
    """
    if not data:
        return False, "文件为空或不包含有效数据", {}

    required_fields = ["step", "rollouts", "scores"]
    stats = {
        "total_batches": len(data),
        "total_rollouts": 0,
        "steps_range": [],
        "missing_fields": []
    }

    for i, item in enumerate(data):
        if not isinstance(item, dict):
            return False, f"第 {i+1} 行不是有效的 JSON 对象", stats

        for field in required_fields:
            if field not in item:
                stats["missing_fields"].append({"line": i+1, "field": field})

        if "rollouts" in item:
            stats["total_rollouts"] += len(item.get("rollouts", []))

        if "step" in item and item["step"] is not None:
            stats["steps_range"].append(item["step"])

    if stats["missing_fields"]:
        missing_summary = ", ".join([f"行{m['line']}缺少{m['field']}" for m in stats["missing_fields"][:5]])
        return False, f"数据格式不完整: {missing_summary}", stats

    # Filter out any remaining None values before calculating min/max
    valid_steps = [s for s in stats["steps_range"] if s is not None]
    stats["steps_range"] = [min(valid_steps), max(valid_steps)] if valid_steps else []

    return True, "", stats


@api_view(['GET', 'POST'])
@parser_classes([MultiPartParser, FormParser])
def rl_log_list(request):
    """
    GET: 获取所有 RL 日志列表
    POST: 上传新的 RL 日志文件
    """
    if request.method == 'GET':
        logs = rl_log_storage.list_logs()
        return Response({
            "logs": logs,
            "total": len(logs)
        })

    elif request.method == 'POST':
        if 'file' not in request.FILES:
            return Response(
                {"error": "未找到上传文件"},
                status=status.HTTP_400_BAD_REQUEST
            )

        uploaded_file = request.FILES['file']
        name = request.POST.get('name', uploaded_file.name)
        description = request.POST.get('description', '')

        # 验证文件扩展名
        if not uploaded_file.name.endswith('.jsonl'):
            return Response(
                {"error": "仅支持 .jsonl 格式文件"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 解析 JSONL 文件
        try:
            data = []
            for line in uploaded_file:
                line_str = line.decode('utf-8').strip()
                if line_str:
                    data.append(json.loads(line_str))
        except json.JSONDecodeError as e:
            return Response(
                {"error": f"JSON 解析错误: {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            return Response(
                {"error": f"文件读取错误: {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 验证格式
        is_valid, error_msg, stats = validate_rl_log_format(data)
        if not is_valid:
            return Response(
                {"error": error_msg, "stats": stats},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 创建日志记录
        log_id = rl_log_storage.create_log(
            name=name,
            description=description,
            data=data,
            file_size=uploaded_file.size,
            stats=stats
        )

        return Response({
            "message": "上传成功",
            "log_id": log_id,
            "stats": stats
        }, status=status.HTTP_201_CREATED)


@api_view(['GET', 'DELETE'])
def rl_log_detail(request, log_id: str):
    """
    GET: 获取单个 RL 日志的详情
    DELETE: 删除指定的 RL 日志
    """
    if request.method == 'GET':
        log = rl_log_storage.get_log(log_id)
        if not log:
            return Response(
                {"error": "日志不存在"},
                status=status.HTTP_404_NOT_FOUND
            )
        return Response(log)

    elif request.method == 'DELETE':
        success = rl_log_storage.delete_log(log_id)
        if not success:
            return Response(
                {"error": "日志不存在或删除失败"},
                status=status.HTTP_404_NOT_FOUND
            )
        # 使该日志的缓存失效
        analysis_cache.invalidate(log_id)
        return Response({"message": "删除成功"})


@api_view(['GET'])
def rl_log_batch(request, log_id: str, batch_index: int):
    """
    获取指定 batch 的详细分析数据
    """
    log = rl_log_storage.get_log(log_id)
    if not log:
        return Response(
            {"error": "日志不存在"},
            status=status.HTTP_404_NOT_FOUND
        )

    data = log.get("data", [])
    if batch_index < 0 or batch_index >= len(data):
        return Response(
            {"error": f"无效的 batch 索引，有效范围: 0 - {len(data) - 1}"},
            status=status.HTTP_400_BAD_REQUEST
        )

    batch_data = data[batch_index]
    analyzed = analyze_batch(batch_data)

    return Response(analyzed)


@api_view(['GET'])
def rl_log_analysis(request, log_id: str):
    """
    获取整体分析数据（用于图表）- 使用轻量级解析和缓存
    """
    # 尝试从缓存获取
    cached = analysis_cache.get(log_id, "analysis")
    if cached:
        return Response(cached)

    log = rl_log_storage.get_log(log_id)
    if not log:
        return Response(
            {"error": "日志不存在"},
            status=status.HTTP_404_NOT_FOUND
        )

    data = log.get("data", [])

    # 聚合分析数据
    steps = []
    mean_scores = []
    token_penalty_counts = []
    switch_human_series = {"0": [], "1": [], "2": []}
    dimension_scores = {}  # 维度分数趋势

    for batch in data:
        steps.append(batch.get("step", 0))

        # 计算平均分
        scores = batch.get("scores") or []
        mean_score = sum(scores) / len(scores) if scores else 0
        mean_scores.append(mean_score)

        # 使用轻量级解析进行统计
        rollouts = batch.get("rollouts") or []
        tp_count = 0
        batch_switch = {"0": 0, "1": 0, "2": 0}

        for r in rollouts:
            parsed = parse_rollout_string_light(r)

            # token penalty 统计
            if parsed.get("penalty", {}).get("token_penalty") == -1:
                tp_count += 1

            # 转人工统计
            switch_count = parsed.get("switch_human_count", 0)
            batch_switch[str(min(switch_count, 2))] += 1

        token_penalty_counts.append(tp_count)

        for key in switch_human_series:
            switch_human_series[key].append(batch_switch[key])

        # 维度分数统计
        list_base_score_jsons = batch.get("list_base_score_jsons") or []
        for score_json in list_base_score_jsons:
            if isinstance(score_json, dict):
                for dim, score in score_json.items():
                    if dim not in dimension_scores:
                        dimension_scores[dim] = []
                    try:
                        dimension_scores[dim].append(float(score))
                    except (ValueError, TypeError):
                        pass

    # 计算维度平均分趋势（按 batch 对齐）
    dimension_trends = {}
    for dim, scores in dimension_scores.items():
        if scores:
            # 简化处理：取每个维度的累计平均
            cumulative = []
            total = 0
            for i, s in enumerate(scores):
                total += s
                cumulative.append(total / (i + 1))
            dimension_trends[dim] = cumulative

    result = {
        "log_id": log_id,
        "total_batches": len(data),
        "steps": steps,
        "mean_scores": mean_scores,
        "token_penalty_counts": token_penalty_counts,
        "switch_human_series": switch_human_series,
        "dimension_trends": dimension_trends
    }

    # 缓存结果
    analysis_cache.set(log_id, "analysis", result)

    return Response(result)


@api_view(['POST'])
@parser_classes([MultiPartParser, FormParser])
def validate_log_file(request):
    """
    验证上传的日志文件格式（不保存）
    """
    if 'file' not in request.FILES:
        return Response(
            {"error": "未找到上传文件"},
            status=status.HTTP_400_BAD_REQUEST
        )

    uploaded_file = request.FILES['file']

    # 解析 JSONL 文件
    try:
        data = []
        for line in uploaded_file:
            line_str = line.decode('utf-8').strip()
            if line_str:
                data.append(json.loads(line_str))
    except json.JSONDecodeError as e:
        return Response({
            "valid": False,
            "error": f"JSON 解析错误: {str(e)}",
            "stats": {}
        })
    except Exception as e:
        return Response({
            "valid": False,
            "error": f"文件读取错误: {str(e)}",
            "stats": {}
        })

    is_valid, error_msg, stats = validate_rl_log_format(data)

    return Response({
        "valid": is_valid,
        "error": error_msg if not is_valid else None,
        "stats": stats
    })


@api_view(['DELETE'])
def rl_log_delete_all(request):
    """
    删除所有 RL 日志
    """
    count = rl_log_storage.delete_all_logs()
    # 清空缓存
    analysis_cache.clear()
    return Response({
        "message": f"成功删除 {count} 个日志",
        "deleted_count": count
    })


@api_view(['GET'])
def rl_log_storage_info(request):
    """
    获取存储使用情况
    """
    info = rl_log_storage.get_storage_info()
    return Response(info)


@api_view(['GET'])
def rl_log_dimension_trends(request, log_id: str):
    """
    获取维度分数趋势数据（用于 Dimension Scores 页面）
    支持按 batch 聚合的维度分数趋势 - 带缓存
    """
    # 尝试从缓存获取
    cached = analysis_cache.get(log_id, "dimension_trends")
    if cached:
        return Response(cached)

    log = rl_log_storage.get_log(log_id)
    if not log:
        return Response(
            {"error": "日志不存在"},
            status=status.HTTP_404_NOT_FOUND
        )

    data = log.get("data", [])

    # 按 batch 聚合维度分数
    batch_dimension_scores = []  # 每个 batch 的维度平均分
    all_dimensions = set()

    for batch_idx, batch in enumerate(data):
        list_base_score_jsons = batch.get("list_base_score_jsons") or []

        # 计算该 batch 的维度平均分
        avg_dims = calculate_average_scores(list_base_score_jsons)
        all_dimensions.update(avg_dims.keys())

        batch_dimension_scores.append({
            "batch_index": batch_idx,
            "step": batch.get("step", batch_idx),
            "dimensions": avg_dims
        })

    # 整理成前端易用的格式
    dimension_series = {}
    sorted_dimensions = sorted(all_dimensions)
    for dim in sorted_dimensions:
        dimension_series[dim] = [
            bds["dimensions"].get(dim, None) for bds in batch_dimension_scores
        ]

    result = {
        "log_id": log_id,
        "total_batches": len(data),
        "dimensions": sorted_dimensions,
        "batch_dimension_scores": batch_dimension_scores,
        "dimension_series": dimension_series
    }

    # 缓存结果
    analysis_cache.set(log_id, "dimension_trends", result)

    return Response(result)


@api_view(['GET'])
def rl_log_overview(request, log_id: str):
    """
    获取整体概览数据（用于 Overview 页面）- 使用轻量级解析和缓存

    概念说明：
    - Case: 每个测试用例（用户画像），同一 case 在不同 step 训练
    - Step: 训练步数
    - Batch: 每个 step 下的每个 case 组成一个 batch
    - Rollout: 每个 batch 内的多次采样
    """
    # 尝试从缓存获取
    cached = analysis_cache.get(log_id, "overview_v2")
    if cached:
        return Response(cached)

    log = rl_log_storage.get_log(log_id)
    if not log:
        return Response(
            {"error": "日志不存在"},
            status=status.HTTP_404_NOT_FOUND
        )

    data = log.get("data", [])

    # 检测 case 数量和 step 数量
    cases_per_step = detect_cases_per_step(data)

    # 收集所有 step
    steps = set()
    for batch in data:
        step = batch.get("step")
        if step is not None:
            steps.add(step)
    total_steps = len(steps)

    total_batches = len(data)  # 实际 batch 总数（用于内部计算）
    total_rollouts = 0
    total_scores = []
    total_token_penalties = 0
    mean_scores = []

    # 每个 batch 的 rollout 数量（取第一个非空 batch）
    rollouts_per_batch = 0

    for batch in data:
        rollouts = batch.get("rollouts") or []
        scores = batch.get("scores") or []

        total_rollouts += len(rollouts)
        total_scores.extend(scores)

        if rollouts_per_batch == 0 and rollouts:
            rollouts_per_batch = len(rollouts)

        if scores:
            mean_scores.append(sum(scores) / len(scores))

        # 使用轻量级解析统计 token penalty
        for r in rollouts:
            parsed = parse_rollout_string_light(r)
            penalty = parsed.get("penalty", {})
            if penalty.get("token_penalty") == -1:
                total_token_penalties += 1

    avg_score = sum(total_scores) / len(total_scores) if total_scores else 0

    result = {
        "log_id": log_id,
        "log_name": log.get("name", ""),
        # 核心统计 - 修正概念
        "total_cases": cases_per_step,  # Case 数量（测试用例数）
        "total_steps": total_steps,     # Step 数量（训练步数）
        "total_rollouts": total_rollouts,  # Rollout 总数
        "rollouts_per_batch": rollouts_per_batch,  # 每 batch 的 rollout 数
        # 分数统计
        "avg_score": avg_score,
        "min_score": min(total_scores) if total_scores else 0,
        "max_score": max(total_scores) if total_scores else 0,
        "total_token_penalties": total_token_penalties,
        # 趋势数据（按 batch 顺序）
        "mean_scores": mean_scores,
        # 保留旧字段用于兼容（但概念上不再强调）
        "total_batches": total_batches,
    }

    # 缓存结果
    analysis_cache.set(log_id, "overview_v2", result)

    return Response(result)


@api_view(['GET'])
def rl_log_step_comparison(request, log_id: str):
    """
    获取 Case 列表和 Step 信息（用于 Step Comparison 页面）

    新逻辑：
    - Case = 每个 step 内的 batch 位置（0, 1, 2, 3...）
    - 由于 balanced_batch=False，同一 case 在不同 step 的顺序一致
    - 用户可以选择一个 case，然后对比不同 step 的结果
    """
    # 尝试从缓存获取
    cached = analysis_cache.get(log_id, "step_comparison_v2")
    if cached:
        return Response(cached)

    log = rl_log_storage.get_log(log_id)
    if not log:
        return Response(
            {"error": "日志不存在"},
            status=status.HTTP_404_NOT_FOUND
        )

    data = log.get("data", [])

    # 检测每个 step 有多少个 case
    cases_per_step = detect_cases_per_step(data)

    # 收集所有 step 值
    steps = set()
    for batch in data:
        step = batch.get("step")
        if step is not None:
            steps.add(step)
    steps = sorted(steps)

    # 按 step 分组 batches
    step_groups = group_batches_by_step(data)

    # 为每个 case 收集信息
    # Case i 对应每个 step 内位置为 i 的 batch
    cases_info = []
    for case_id in range(cases_per_step):
        # 从第一个 step 获取该 case 的信息
        first_step = steps[0] if steps else None
        first_batch = None
        batch_indices = []

        # 遍历所有 step，收集该 case 对应的 batch indices
        for step in steps:
            step_batches = step_groups.get(step, [])
            if case_id < len(step_batches):
                batch_idx, batch = step_batches[case_id]
                batch_indices.append(batch_idx)
                if first_batch is None:
                    first_batch = batch

        # 提取 preview 和 user_info（从第一个找到的 batch）
        preview = ""
        user_info = {}
        if first_batch and first_batch.get("rollouts"):
            parts = ROLLOUT_SPLIT_PATTERN.split(first_batch["rollouts"][0])
            if len(parts) > 2:
                preview = parts[2][:100]  # system_prompt 前 100 字符
            # 提取 user_info
            if parts[0].strip():
                try:
                    penalty_data = eval(parts[0])
                    if isinstance(penalty_data, dict):
                        user_info = penalty_data.get("user_info", {})
                except:
                    pass

        cases_info.append({
            "case_id": case_id,
            "batch_indices": batch_indices,
            "num_steps": len(batch_indices),
            "preview": preview,
            "user_info": user_info
        })

    result = {
        "log_id": log_id,
        "total_batches": len(data),
        "cases_per_step": cases_per_step,
        "total_cases": len(cases_info),
        "total_steps": len(steps),
        "steps": steps,
        "cases": cases_info,
        # 保持向后兼容
        "comparable_sessions": cases_info,
        "has_comparable_sessions": len(cases_info) > 0
    }

    # 缓存结果
    analysis_cache.set(log_id, "step_comparison_v2", result)

    return Response(result)


@api_view(['GET'])
def rl_log_case_trend(request, log_id: str, case_id: int):
    """
    获取单个 Case 在所有 Step 上的分数趋势

    用于前端绘制该 case 的训练曲线
    """
    cache_key = f"case_trend_{case_id}"
    cached = analysis_cache.get(log_id, cache_key)
    if cached:
        return Response(cached)

    log = rl_log_storage.get_log(log_id)
    if not log:
        return Response(
            {"error": "日志不存在"},
            status=status.HTTP_404_NOT_FOUND
        )

    data = log.get("data", [])
    cases_per_step = detect_cases_per_step(data)

    if case_id < 0 or case_id >= cases_per_step:
        return Response(
            {"error": f"Case ID 无效，应该在 0-{cases_per_step-1} 之间"},
            status=status.HTTP_400_BAD_REQUEST
        )

    # 按 step 分组 batches
    step_groups = group_batches_by_step(data)

    # 收集该 case 在所有 step 的数据
    trend_data = []
    for step_val, step_batches in step_groups.items():
        # 检查该 step 是否有这个 case
        if case_id >= len(step_batches):
            continue

        batch_idx, batch = step_batches[case_id]
        step = batch.get("step")
        scores = batch.get("scores") or []
        rollouts = batch.get("rollouts") or []

        if not scores and not rollouts:
            continue

        # 计算统计信息
        avg_score = sum(scores) / len(scores) if scores else 0
        max_score = max(scores) if scores else 0
        min_score = min(scores) if scores else 0

        # 使用轻量级解析计算 token_penalty 次数
        token_penalty_count = 0
        for r in rollouts:
            parsed = parse_rollout_string_light(r)
            if parsed.get("penalty", {}).get("token_penalty") == -1:
                token_penalty_count += 1

        trend_data.append({
            "step": step,
            "batch_index": batch_idx,
            "avg_score": avg_score,
            "max_score": max_score,
            "min_score": min_score,
            "score_std": (sum((s - avg_score) ** 2 for s in scores) / len(scores)) ** 0.5 if len(scores) > 1 else 0,
            "rollout_count": len(rollouts),
            "token_penalty_count": token_penalty_count
        })

    # 按 step 排序
    trend_data.sort(key=lambda x: x["step"] if x["step"] is not None else 0)

    result = {
        "log_id": log_id,
        "case_id": case_id,
        "cases_per_step": cases_per_step,
        "total_steps": len(trend_data),
        "trend_data": trend_data
    }

    analysis_cache.set(log_id, cache_key, result)

    return Response(result)


@api_view(['GET'])
def rl_log_case_step_detail(request, log_id: str, case_id: int, step: int):
    """
    获取指定 Case 在指定 Step 的详细 Rollouts 数据

    用于 Case Inspector 和 Step Comparison 详情展示
    """
    log = rl_log_storage.get_log(log_id)
    if not log:
        return Response(
            {"error": "日志不存在"},
            status=status.HTTP_404_NOT_FOUND
        )

    data = log.get("data", [])
    cases_per_step = detect_cases_per_step(data)

    if case_id < 0 or case_id >= cases_per_step:
        return Response(
            {"error": f"Case ID 无效，应该在 0-{cases_per_step-1} 之间"},
            status=status.HTTP_400_BAD_REQUEST
        )

    # 找到该 case 在指定 step 的 batch
    target_batch_index, target_batch = get_batch_for_case_step(data, case_id, step)

    if not target_batch:
        return Response(
            {"error": f"未找到 Case {case_id} 在 Step {step} 的数据"},
            status=status.HTTP_404_NOT_FOUND
        )

    # 解析 rollouts
    rollouts = target_batch.get("rollouts") or []
    scores = target_batch.get("scores") or []

    parsed_rollouts = []
    for idx, r in enumerate(rollouts):
        parsed = parse_rollout_string(r)
        parsed["index"] = idx
        parsed["score"] = scores[idx] if idx < len(scores) else None
        parsed_rollouts.append(parsed)

    # 计算统计信息
    avg_score = sum(scores) / len(scores) if scores else 0

    result = {
        "log_id": log_id,
        "case_id": case_id,
        "step": step,
        "batch_index": target_batch_index,
        "rollout_count": len(rollouts),
        "avg_score": avg_score,
        "max_score": max(scores) if scores else 0,
        "min_score": min(scores) if scores else 0,
        "scores": scores,
        "parsed_rollouts": parsed_rollouts,
        # 提取用户画像（从第一个 rollout）
        "user_info": parsed_rollouts[0].get("user_info", {}) if parsed_rollouts else {}
    }

    return Response(result)


@api_view(['GET'])
def rl_log_compare_steps(request, log_id: str, case_id: int, step_a: int, step_b: int):
    """
    对比同一 Case 在两个不同 Step 的数据

    用于 Step Comparison 详细对比
    """
    log = rl_log_storage.get_log(log_id)
    if not log:
        return Response(
            {"error": "日志不存在"},
            status=status.HTTP_404_NOT_FOUND
        )

    data = log.get("data", [])
    cases_per_step = detect_cases_per_step(data)

    if case_id < 0 or case_id >= cases_per_step:
        return Response(
            {"error": f"Case ID 无效，应该在 0-{cases_per_step-1} 之间"},
            status=status.HTTP_400_BAD_REQUEST
        )

    # 找到两个 step 对应的 batch
    batch_a_index, batch_a = get_batch_for_case_step(data, case_id, step_a)
    batch_b_index, batch_b = get_batch_for_case_step(data, case_id, step_b)

    if not batch_a:
        return Response(
            {"error": f"未找到 Case {case_id} 在 Step {step_a} 的数据"},
            status=status.HTTP_404_NOT_FOUND
        )
    if not batch_b:
        return Response(
            {"error": f"未找到 Case {case_id} 在 Step {step_b} 的数据"},
            status=status.HTTP_404_NOT_FOUND
        )

    def analyze_batch(batch, batch_index):
        rollouts = batch.get("rollouts") or []
        scores = batch.get("scores") or []

        parsed_rollouts = []
        for idx, r in enumerate(rollouts):
            parsed = parse_rollout_string(r)
            parsed["index"] = idx
            parsed["score"] = scores[idx] if idx < len(scores) else None
            parsed_rollouts.append(parsed)

        avg_score = sum(scores) / len(scores) if scores else 0

        return {
            "batch_index": batch_index,
            "step": batch.get("step"),
            "rollout_count": len(rollouts),
            "avg_score": avg_score,
            "max_score": max(scores) if scores else 0,
            "min_score": min(scores) if scores else 0,
            "scores": scores,
            "parsed_rollouts": parsed_rollouts,
            "statistics": {
                "avg_score": avg_score,
                "score_range": f"{min(scores) if scores else 0:.2f} - {max(scores) if scores else 0:.2f}",
                "total_rollouts": len(rollouts)
            }
        }

    analysis_a = analyze_batch(batch_a, batch_a_index)
    analysis_b = analyze_batch(batch_b, batch_b_index)

    # 计算差异
    score_delta = analysis_b["avg_score"] - analysis_a["avg_score"]

    result = {
        "log_id": log_id,
        "case_id": case_id,
        "step_a": {
            "step": step_a,
            "batch_index": batch_a_index,
            **analysis_a
        },
        "step_b": {
            "step": step_b,
            "batch_index": batch_b_index,
            **analysis_b
        },
        "delta": {
            "score": score_delta,
            "score_improved": score_delta > 0
        }
    }

    return Response(result)


@api_view(['GET'])
def rl_log_compare_batches(request, log_id: str, batch_a: int, batch_b: int):
    """
    对比两个 batch 的数据（用于 Step Comparison 详情）
    """
    log = rl_log_storage.get_log(log_id)
    if not log:
        return Response(
            {"error": "日志不存在"},
            status=status.HTTP_404_NOT_FOUND
        )

    data = log.get("data", [])

    if batch_a < 0 or batch_a >= len(data) or batch_b < 0 or batch_b >= len(data):
        return Response(
            {"error": f"无效的 batch 索引，有效范围: 0 - {len(data) - 1}"},
            status=status.HTTP_400_BAD_REQUEST
        )

    analysis_a = analyze_batch(data[batch_a])
    analysis_b = analyze_batch(data[batch_b])

    # 计算 delta
    score_delta = analysis_b["statistics"]["mean_score"] - analysis_a["statistics"]["mean_score"]
    penalty_delta = analysis_b["statistics"]["token_penalty_count"] - analysis_a["statistics"]["token_penalty_count"]

    return Response({
        "batch_a": {
            "index": batch_a,
            "step": analysis_a["step"],
            "statistics": analysis_a["statistics"],
            "avg_dimensions": analysis_a["avg_dimensions"],
            "parsed_rollouts": analysis_a["parsed_rollouts"],
            "scores": analysis_a["scores"]
        },
        "batch_b": {
            "index": batch_b,
            "step": analysis_b["step"],
            "statistics": analysis_b["statistics"],
            "avg_dimensions": analysis_b["avg_dimensions"],
            "parsed_rollouts": analysis_b["parsed_rollouts"],
            "scores": analysis_b["scores"]
        },
        "delta": {
            "score": score_delta,
            "token_penalty": penalty_delta
        }
    })


# ==================== TensorBoard API ====================

@api_view(['POST'])
@parser_classes([MultiPartParser, FormParser])
def rl_log_upload_tfevents(request, log_id: str):
    """
    上传 TensorBoard events 文件
    """
    log = rl_log_storage.get_log(log_id, include_data=False)
    if not log:
        return Response(
            {"error": "日志不存在"},
            status=status.HTTP_404_NOT_FOUND
        )

    if 'file' not in request.FILES:
        return Response(
            {"error": "未找到上传文件"},
            status=status.HTTP_400_BAD_REQUEST
        )

    uploaded_file = request.FILES['file']

    # 验证文件名包含 tfevents
    if 'tfevents' not in uploaded_file.name:
        return Response(
            {"error": "请上传 TensorBoard events 文件 (文件名需包含 'tfevents')"},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        file_content = uploaded_file.read()
        rl_log_storage.save_tfevents_file(log_id, file_content, uploaded_file.name)

        return Response({
            "message": "TensorBoard 文件上传成功",
            "filename": uploaded_file.name,
            "size": len(file_content)
        }, status=status.HTTP_201_CREATED)

    except Exception as e:
        return Response(
            {"error": f"文件保存失败: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
def rl_log_tensorboard_tags(request, log_id: str):
    """
    获取 TensorBoard 日志中的所有 scalar tags
    """
    log = rl_log_storage.get_log(log_id, include_data=False)
    if not log:
        return Response(
            {"error": "日志不存在"},
            status=status.HTTP_404_NOT_FOUND
        )

    tfevents_path = rl_log_storage.get_tfevents_path(log_id)
    if not tfevents_path:
        return Response(
            {"error": "该日志没有 TensorBoard 数据"},
            status=status.HTTP_404_NOT_FOUND
        )

    try:
        from tensorboard.backend.event_processing.event_accumulator import EventAccumulator

        # 检查文件是否存在
        if not tfevents_path.exists():
            logger.error(f"TensorBoard 文件不存在: {tfevents_path}")
            return Response(
                {"error": f"TensorBoard 文件不存在: {tfevents_path.name}"},
                status=status.HTTP_404_NOT_FOUND
            )

        # 传入文件路径，而不是目录
        ea = EventAccumulator(str(tfevents_path))
        ea.Reload()

        tags = ea.Tags().get('scalars', [])

        return Response({
            "log_id": log_id,
            "tags": tags,
            "total": len(tags)
        })

    except ImportError as e:
        logger.error(f"TensorBoard 未安装或导入失败: {e}")
        return Response(
            {"error": "TensorBoard 未安装，请运行: pip install tensorboard"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    except Exception as e:
        logger.exception(f"读取 TensorBoard 数据失败 (log_id={log_id}, path={tfevents_path}): {e}")
        return Response(
            {"error": f"读取 TensorBoard 数据失败: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
def rl_log_tensorboard_scalars(request, log_id: str):
    """
    获取指定 tags 的 scalar 数据

    Query params:
        tags: 逗号分隔的 tag 列表，不指定则返回核心指标
    """
    log = rl_log_storage.get_log(log_id, include_data=False)
    if not log:
        return Response(
            {"error": "日志不存在"},
            status=status.HTTP_404_NOT_FOUND
        )

    tfevents_path = rl_log_storage.get_tfevents_path(log_id)
    if not tfevents_path:
        return Response(
            {"error": "该日志没有 TensorBoard 数据"},
            status=status.HTTP_404_NOT_FOUND
        )

    # 核心指标（默认）
    CORE_METRICS = [
        'critic/rewards/mean',
        'critic/score/mean',
        'actor/ppo_kl',
        'actor/entropy',
        'actor/pg_clipfrac',
        'actor/lr'
    ]

    # 解析请求的 tags
    tags_param = request.GET.get('tags', '')
    if tags_param:
        requested_tags = [t.strip() for t in tags_param.split(',') if t.strip()]
    else:
        requested_tags = CORE_METRICS

    try:
        from tensorboard.backend.event_processing.event_accumulator import EventAccumulator

        # 检查文件是否存在
        if not tfevents_path.exists():
            logger.error(f"TensorBoard 文件不存在: {tfevents_path}")
            return Response(
                {"error": f"TensorBoard 文件不存在: {tfevents_path.name}"},
                status=status.HTTP_404_NOT_FOUND
            )

        # 传入文件路径，而不是目录
        ea = EventAccumulator(str(tfevents_path))
        ea.Reload()

        available_tags = ea.Tags().get('scalars', [])

        result = {}
        for tag in requested_tags:
            if tag in available_tags:
                events = ea.Scalars(tag)
                result[tag] = {
                    "values": [e.value for e in events],
                    "steps": [e.step for e in events],
                    "wall_times": [e.wall_time for e in events],
                    "count": len(events)
                }

        return Response({
            "log_id": log_id,
            "scalars": result,
            "requested_tags": requested_tags,
            "found_tags": list(result.keys())
        })

    except ImportError as e:
        logger.error(f"TensorBoard 未安装或导入失败: {e}")
        return Response(
            {"error": "TensorBoard 未安装，请运行: pip install tensorboard"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    except Exception as e:
        logger.exception(f"读取 TensorBoard scalars 失败 (log_id={log_id}, path={tfevents_path}): {e}")
        return Response(
            {"error": f"读取 TensorBoard 数据失败: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
def rl_log_tensorboard_status(request, log_id: str):
    """
    获取 TensorBoard 数据状态
    """
    log = rl_log_storage.get_log(log_id, include_data=False)
    if not log:
        return Response(
            {"error": "日志不存在"},
            status=status.HTTP_404_NOT_FOUND
        )
    
    has_tfevents = rl_log_storage.has_tfevents(log_id)
    tfevents_path = rl_log_storage.get_tfevents_path(log_id) if has_tfevents else None
    
    result = {
        "log_id": log_id,
        "has_tfevents": has_tfevents,
        "filename": tfevents_path.name if tfevents_path else None,
        "file_size": tfevents_path.stat().st_size if tfevents_path else None
    }
    
    return Response(result)


@api_view(['DELETE'])
def rl_log_delete_tfevents(request, log_id: str):
    """
    删除 TensorBoard 文件
    """
    log = rl_log_storage.get_log(log_id, include_data=False)
    if not log:
        return Response(
            {"error": "日志不存在"},
            status=status.HTTP_404_NOT_FOUND
        )
    
    success = rl_log_storage.delete_tfevents(log_id)
    if success:
        return Response({"message": "TensorBoard 数据已删除"})
    else:
        return Response(
            {"error": "没有 TensorBoard 数据可删除"},
            status=status.HTTP_404_NOT_FOUND
        )
