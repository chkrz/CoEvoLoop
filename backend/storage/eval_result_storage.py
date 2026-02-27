"""
评测结果存储模块
"""
import json
import os
import uuid
from datetime import datetime
from typing import List, Dict, Optional

# 存储文件路径
STORAGE_FILE = os.path.join(os.path.dirname(__file__), 'eval_results.json')


def _load_results() -> Dict[str, Dict]:
    """加载所有评测结果"""
    if not os.path.exists(STORAGE_FILE):
        return {}
    
    with open(STORAGE_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)


def _save_results(results: Dict[str, Dict]):
    """保存评测结果到文件"""
    with open(STORAGE_FILE, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)


def _generate_result_id() -> str:
    """生成结果ID: result_YYYYMMDD_<12位UUID>"""
    date_str = datetime.now().strftime('%Y%m%d')
    uuid_str = str(uuid.uuid4()).replace('-', '')[:12]
    return f"result_{date_str}_{uuid_str}"


def list_results(model_id: Optional[str] = None, benchmark_id: Optional[str] = None) -> List[Dict]:
    """获取评测结果列表"""
    results = _load_results()
    result_list = list(results.values())
    
    # 按模型过滤
    if model_id:
        result_list = [r for r in result_list if r.get('model_id') == model_id]
    
    # 按数据集过滤
    if benchmark_id:
        result_list = [r for r in result_list if r.get('benchmark_id') == benchmark_id]
    
    # 按创建时间倒序排序
    result_list.sort(key=lambda x: x.get('created_at', ''), reverse=True)
    
    return result_list


def get_result(result_id: str) -> Optional[Dict]:
    """获取单个评测结果"""
    results = _load_results()
    return results.get(result_id)


def create_result(data: Dict) -> Dict:
    """创建评测结果"""
    results = _load_results()
    
    result_id = _generate_result_id()
    now = datetime.now().isoformat()
    
    result = {
        'id': result_id,
        'task_id': data['task_id'],
        'model_id': data['model_id'],
        'model_name': data.get('model_name', ''),
        'benchmark_id': data['benchmark_id'],
        'benchmark_name': data.get('benchmark_name', ''),
        'score': data.get('score', 0.0),
        'metric_name': data.get('metric_name', 'accuracy'),
        'detailed_metrics': data.get('detailed_metrics', {}),
        'outputs': data.get('outputs', {}),
        'ucloud_job_id': data.get('ucloud_job_id'),
        'gpu_type': data.get('gpu_type', 'H200'),
        'gpu_count': data.get('gpu_count', 1),
        'duration': data.get('duration', 0),
        'created_at': now
    }
    
    results[result_id] = result
    _save_results(results)
    
    return result


def delete_result(result_id: str) -> bool:
    """删除评测结果"""
    results = _load_results()
    
    if result_id not in results:
        return False
    
    del results[result_id]
    _save_results(results)
    
    return True


def get_leaderboard(category: Optional[str] = None, benchmark_id: Optional[str] = None) -> List[Dict]:
    """获取排行榜数据"""
    results = _load_results()
    
    if benchmark_id:
        # 单数据集排行榜
        benchmark_results = [r for r in results.values() if r['benchmark_id'] == benchmark_id]
        
        # 按模型分组，取每个模型的最新结果
        model_best = {}
        for result in benchmark_results:
            model_id = result['model_id']
            if model_id not in model_best or result['created_at'] > model_best[model_id]['created_at']:
                model_best[model_id] = result
        
        # 按分数降序排序
        leaderboard = sorted(model_best.values(), key=lambda x: x['score'], reverse=True)
        
        return leaderboard
    
    else:
        # 综合排行榜：需要计算每个模型的平均分
        model_scores = {}
        
        for result in results.values():
            model_id = result['model_id']
            if model_id not in model_scores:
                model_scores[model_id] = {
                    'model_id': model_id,
                    'model_name': result['model_name'],
                    'scores': {},
                    'total_score': 0,
                    'count': 0
                }
            
            benchmark_id = result['benchmark_id']
            # 取每个数据集的最新结果
            if benchmark_id not in model_scores[model_id]['scores'] or \
               result['created_at'] > model_scores[model_id]['scores'][benchmark_id]['created_at']:
                model_scores[model_id]['scores'][benchmark_id] = result
        
        # 计算平均分
        for model_id, data in model_scores.items():
            total = sum(r['score'] for r in data['scores'].values())
            count = len(data['scores'])
            data['average_score'] = total / count if count > 0 else 0
            data['benchmark_count'] = count
        
        # 按平均分降序排序
        leaderboard = sorted(model_scores.values(), key=lambda x: x['average_score'], reverse=True)
        
        return leaderboard
