"""
评测数据集存储模块
"""
import json
import os
from datetime import datetime
from typing import List, Dict, Optional

# 存储文件路径
STORAGE_FILE = os.path.join(os.path.dirname(__file__), 'benchmarks.json')


def _load_benchmarks() -> Dict[str, Dict]:
    """加载所有评测数据集"""
    if not os.path.exists(STORAGE_FILE):
        return {}
    
    with open(STORAGE_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)


def _save_benchmarks(benchmarks: Dict[str, Dict]):
    """保存评测数据集到文件"""
    with open(STORAGE_FILE, 'w', encoding='utf-8') as f:
        json.dump(benchmarks, f, ensure_ascii=False, indent=2)


def initialize_default_benchmarks():
    """初始化默认的评测数据集"""
    if os.path.exists(STORAGE_FILE):
        return  # 已存在则不初始化
    
    default_benchmarks = {
        "bench_mmlu_base": {
            "id": "bench_mmlu_base",
            "name": "MMLU (Base)",
            "display_name": "MMLU - Massive Multitask Language Understanding",
            "category": "general",
            "subcategory": "knowledge",
            "description": "涵盖 57 个学科的多任务理解测试，包括数学、历史、计算机科学、法律等领域",
            "num_samples": 14042,
            "languages": ["en"],
            "tasks": ["multiple_choice"],
            "opencompass_config": {
                "dataset_key": "mmlu_ppl_ac766d",
                "model_type": "base",
                "metric": "accuracy",
                "few_shot": 5
            },
            "eval_params": {
                "temperature": 0.6,
                "top_p": 0.95,
                "max_tokens": 400000,
                "gpu_num": 1
            },
            "enabled": True,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
            "reference_scores": {
                "GPT-4": 86.4,
                "Claude-3": 85.2,
                "Qwen2.5-72B": 83.1
            }
        },
        "bench_gsm8k_base": {
            "id": "bench_gsm8k_base",
            "name": "GSM8K (Base)",
            "display_name": "GSM8K - Grade School Math",
            "category": "math",
            "subcategory": "arithmetic",
            "description": "小学数学应用题，测试基础数学推理能力",
            "num_samples": 1319,
            "languages": ["en"],
            "tasks": ["math_word_problem"],
            "opencompass_config": {
                "dataset_key": "gsm8k_gen_17d0dc",
                "model_type": "base",
                "metric": "accuracy",
                "few_shot": 4
            },
            "eval_params": {
                "temperature": 0.6,
                "top_p": 0.95,
                "max_tokens": 400000,
                "gpu_num": 1
            },
            "enabled": True,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
            "reference_scores": {
                "GPT-4": 92.0,
                "Claude-3": 88.0,
                "Qwen2.5-72B": 85.3
            }
        },
        "bench_humaneval_base": {
            "id": "bench_humaneval_base",
            "name": "HumanEval (Base)",
            "display_name": "HumanEval - Python Code Generation",
            "category": "code",
            "subcategory": "generation",
            "description": "Python 代码生成任务，测试编程能力",
            "num_samples": 164,
            "languages": ["python"],
            "tasks": ["code_generation"],
            "opencompass_config": {
                "dataset_key": "deprecated_humaneval_gen_d2537e",
                "model_type": "base",
                "metric": "pass@1",
                "few_shot": 0
            },
            "eval_params": {
                "temperature": 0.6,
                "top_p": 0.95,
                "max_tokens": 400000,
                "gpu_num": 1
            },
            "enabled": True,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
            "reference_scores": {
                "GPT-4": 67.0,
                "Claude-3": 75.0,
                "Qwen2.5-72B": 61.0
            }
        },
        "bench_ceval_base": {
            "id": "bench_ceval_base",
            "name": "C-Eval (Base)",
            "display_name": "C-Eval - 中文综合评估",
            "category": "chinese",
            "subcategory": "knowledge",
            "description": "中文综合能力评估，涵盖多个学科领域",
            "num_samples": 13948,
            "languages": ["zh"],
            "tasks": ["multiple_choice"],
            "opencompass_config": {
                "dataset_key": "ceval_ppl",
                "model_type": "base",
                "metric": "accuracy",
                "few_shot": 5
            },
            "eval_params": {
                "temperature": 0.6,
                "top_p": 0.95,
                "max_tokens": 400000,
                "gpu_num": 1
            },
            "enabled": True,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
            "reference_scores": {
                "GPT-4": 68.7,
                "Qwen2.5-72B": 89.5
            }
        },
        "bench_bbh_base": {
            "id": "bench_bbh_base",
            "name": "BBH (Base)",
            "display_name": "BBH - BIG-Bench Hard",
            "category": "reasoning",
            "subcategory": "complex_reasoning",
            "description": "复杂推理任务集合，测试高级推理能力",
            "num_samples": 6511,
            "languages": ["en"],
            "tasks": ["reasoning"],
            "opencompass_config": {
                "dataset_key": "bbh_gen_98fba6",
                "model_type": "base",
                "metric": "accuracy",
                "few_shot": 3
            },
            "eval_params": {
                "temperature": 0.6,
                "top_p": 0.95,
                "max_tokens": 400000,
                "gpu_num": 1
            },
            "enabled": True,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
            "reference_scores": {
                "GPT-4": 86.7,
                "Claude-3": 82.5
            }
        }
    }
    
    _save_benchmarks(default_benchmarks)


def list_benchmarks(category: Optional[str] = None, enabled_only: bool = False) -> List[Dict]:
    """获取评测数据集列表"""
    benchmarks = _load_benchmarks()
    result = list(benchmarks.values())
    
    # 按分类过滤
    if category:
        result = [b for b in result if b.get('category') == category]
    
    # 只返回启用的
    if enabled_only:
        result = [b for b in result if b.get('enabled', True)]
    
    # 按创建时间排序
    result.sort(key=lambda x: x.get('created_at', ''), reverse=True)
    
    return result


def get_benchmark(benchmark_id: str) -> Optional[Dict]:
    """获取单个评测数据集"""
    benchmarks = _load_benchmarks()
    return benchmarks.get(benchmark_id)


def create_benchmark(data: Dict) -> Dict:
    """创建评测数据集"""
    benchmarks = _load_benchmarks()
    
    benchmark_id = data['id']
    if benchmark_id in benchmarks:
        raise ValueError(f"Benchmark {benchmark_id} already exists")
    
    now = datetime.now().isoformat()
    benchmark = {
        **data,
        'created_at': now,
        'updated_at': now
    }
    
    benchmarks[benchmark_id] = benchmark
    _save_benchmarks(benchmarks)
    
    return benchmark


def update_benchmark(benchmark_id: str, data: Dict) -> Optional[Dict]:
    """更新评测数据集"""
    benchmarks = _load_benchmarks()
    
    if benchmark_id not in benchmarks:
        return None
    
    benchmark = benchmarks[benchmark_id]
    benchmark.update(data)
    benchmark['updated_at'] = datetime.now().isoformat()
    
    benchmarks[benchmark_id] = benchmark
    _save_benchmarks(benchmarks)
    
    return benchmark


def delete_benchmark(benchmark_id: str) -> bool:
    """删除评测数据集"""
    benchmarks = _load_benchmarks()
    
    if benchmark_id not in benchmarks:
        return False
    
    del benchmarks[benchmark_id]
    _save_benchmarks(benchmarks)
    
    return True


def toggle_benchmark(benchmark_id: str) -> Optional[Dict]:
    """切换数据集启用状态"""
    benchmarks = _load_benchmarks()
    
    if benchmark_id not in benchmarks:
        return None
    
    benchmark = benchmarks[benchmark_id]
    benchmark['enabled'] = not benchmark.get('enabled', True)
    benchmark['updated_at'] = datetime.now().isoformat()
    
    benchmarks[benchmark_id] = benchmark
    _save_benchmarks(benchmarks)
    
    return benchmark


def get_categories() -> List[Dict]:
    """获取所有分类"""
    benchmarks = _load_benchmarks()
    
    categories = {}
    for benchmark in benchmarks.values():
        cat = benchmark.get('category', 'other')
        if cat not in categories:
            categories[cat] = {
                'id': cat,
                'name': cat.title(),
                'count': 0
            }
        categories[cat]['count'] += 1
    
    return list(categories.values())


# 初始化默认数据集
initialize_default_benchmarks()
