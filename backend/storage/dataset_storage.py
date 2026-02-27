"""
Dataset storage (JSON based) for local outputs.
"""
import json
import logging
import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)


class DatasetStorage:
	"""Dataset storage for local json/jsonl files."""

	def __init__(self, storage_file: str = None):
		if storage_file is None:
			current_dir = Path(__file__).parent
			storage_file = current_dir / "datasets.json"

		self.storage_file = Path(storage_file)
		self.storage_dir = self.storage_file.parent  # storage目录
		self._ensure_storage_file()

	def _get_full_path(self, relative_path: str) -> Path:
		"""将相对路径转换为完整路径（相对于storage目录）"""
		return self.storage_dir / relative_path

	def _ensure_storage_file(self):
		if not self.storage_file.exists():
			self.storage_file.parent.mkdir(parents=True, exist_ok=True)
			self._write_data({"datasets": []})
			return

		try:
			with open(self.storage_file, "r", encoding="utf-8") as f:
				data = json.load(f)
			if not isinstance(data, dict) or "datasets" not in data:
				raise ValueError("Invalid datasets.json")
		except Exception:
			self._write_data({"datasets": []})

	def _read_data(self) -> Dict:
		with open(self.storage_file, "r", encoding="utf-8") as f:
			return json.load(f)

	def _write_data(self, data: Dict):
		with open(self.storage_file, "w", encoding="utf-8") as f:
			json.dump(data, f, ensure_ascii=False, indent=2)

	def _generate_id(self) -> str:
		date_str = datetime.now().strftime("%Y%m%d")
		short_uuid = uuid.uuid4().hex[:12]
		return f"ds_{date_str}_{short_uuid}"

	def _normalize_dataset(self, dataset: Dict) -> Dict:
		"""
		标准化数据集字段名，确保使用 file_format 和 item_count
		兼容旧数据中的 format 和 sample_count
		"""
		normalized = dataset.copy()
		
		# 统一字段名：format -> file_format
		if "format" in normalized and "file_format" not in normalized:
			normalized["file_format"] = normalized.pop("format")
		elif "format" in normalized:
			normalized.pop("format")  # 删除旧字段
		
		# 统一字段名：sample_count -> item_count
		if "sample_count" in normalized and "item_count" not in normalized:
			normalized["item_count"] = normalized.pop("sample_count")
		elif "sample_count" in normalized:
			normalized.pop("sample_count")  # 删除旧字段
		
		return normalized

	def list_datasets(
		self,
		type_filter: Optional[str] = None,
		source_filter: Optional[str] = None,
		search: Optional[str] = None
	) -> List[Dict]:
		data = self._read_data()
		datasets = data.get("datasets", [])

		if type_filter:
			datasets = [d for d in datasets if d.get("data_type") == type_filter]

		if source_filter:
			datasets = [d for d in datasets if d.get("source") == source_filter]

		if search:
			search_lower = search.lower()
			datasets = [
				d for d in datasets
				if search_lower in d.get("name", "").lower()
			]

		datasets.sort(key=lambda x: x.get("created_at", ""), reverse=True)
		
		# 标准化所有数据集的字段名
		datasets = [self._normalize_dataset(d) for d in datasets]
		
		return datasets

	def get_dataset(self, dataset_id: str) -> Optional[Dict]:
		data = self._read_data()
		for dataset in data.get("datasets", []):
			if dataset.get("id") == dataset_id:
				return self._normalize_dataset(dataset)
		return None

	def create_dataset(self, dataset_data: Dict) -> Dict:
		data = self._read_data()
		datasets = data.get("datasets", [])

		dataset = {
			"id": dataset_data.get("id") or self._generate_id(),
			"name": dataset_data.get("name") or "未命名数据集",
			"data_type": dataset_data.get("data_type"),
			"source": dataset_data.get("source", "UPLOAD"),
			"source_task_id": dataset_data.get("source_task_id"),
			"file_path": dataset_data.get("file_path"),
			"file_name": dataset_data.get("file_name"),
			"file_format": dataset_data.get("file_format"),
			"size_bytes": dataset_data.get("size_bytes", 0),
			"item_count": dataset_data.get("item_count"),
			"created_at": dataset_data.get("created_at") or datetime.now().isoformat(),
			"updated_at": dataset_data.get("updated_at")
		}
		
		# 如果有evaluation_stats，也要保存
		if "evaluation_stats" in dataset_data:
			dataset["evaluation_stats"] = dataset_data["evaluation_stats"]

		datasets.append(dataset)
		data["datasets"] = datasets
		self._write_data(data)
		return dataset

	def update_dataset(self, dataset_id: str, update_data: Dict) -> Optional[Dict]:
		data = self._read_data()
		datasets = data.get("datasets", [])

		for i, dataset in enumerate(datasets):
			if dataset.get("id") == dataset_id:
				for key, value in update_data.items():
					dataset[key] = value
				dataset["updated_at"] = datetime.now().isoformat()
				datasets[i] = dataset
				data["datasets"] = datasets
				self._write_data(data)
				return dataset

		return None

	def delete_dataset(self, dataset_id: str) -> bool:
		data = self._read_data()
		datasets = data.get("datasets", [])
		original_len = len(datasets)
		datasets = [d for d in datasets if d.get("id") != dataset_id]

		if len(datasets) < original_len:
			data["datasets"] = datasets
			self._write_data(data)
			return True

		return False

	def delete_by_source_task_id(self, task_id: str) -> bool:
		data = self._read_data()
		datasets = data.get("datasets", [])
		original_len = len(datasets)
		datasets = [d for d in datasets if d.get("source_task_id") != task_id]

		if len(datasets) < original_len:
			data["datasets"] = datasets
			self._write_data(data)
			return True

		return False

	def upsert_task_dataset(self, task: Dict, output_file: str) -> Dict:
		"""
		从任务输出文件创建或更新dataset记录
		
		Args:
			task: 任务对象
			output_file: 输出文件的绝对路径
		"""
		data = self._read_data()
		datasets = data.get("datasets", [])

		source_task_id = task.get("id")
		existing = None
		for dataset in datasets:
			if dataset.get("source_task_id") == source_task_id:
				existing = dataset
				break

		# output_file是绝对路径，需要转换为相对于storage目录的相对路径
		abs_path = Path(output_file).resolve()
		try:
			relative_path = abs_path.relative_to(self.storage_dir)
			file_path = str(relative_path).replace("\\", "/")  # 统一使用/分隔符
		except ValueError:
			# 如果文件不在storage目录下，使用绝对路径（向后兼容）
			file_path = str(abs_path)
		
		file_name = os.path.basename(output_file)
		fmt = None
		if file_name and "." in file_name:
			fmt = file_name.rsplit(".", 1)[-1].lower()

		# 使用绝对路径检查文件
		size_bytes = abs_path.stat().st_size if abs_path.exists() else 0
		
		# _count_samples现在使用相对路径，会自动转换为绝对路径
		item_count = self._count_samples(file_path, fmt)

		payload = {
			"name": task.get("name") or f"{task.get('type', 'DATA')} 数据集",
			"data_type": task.get("type"),
			"source": "TASK",
			"source_task_id": source_task_id,
			"file_path": file_path,  # 存储相对路径
			"file_name": file_name,
			"file_format": fmt,
			"size_bytes": size_bytes,
			"item_count": item_count
		}
		
		# 如果是质量评估类型，直接从task中同步evaluation_stats
		if task.get("type") == "EVALUATION" and task.get("evaluation_stats"):
			payload["evaluation_stats"] = task.get("evaluation_stats")
			logger.info(f"同步evaluation_stats到dataset: {payload['evaluation_stats']}")
		elif task.get("type") == "EVALUATION":
			logger.warning(f"EVALUATION任务 {source_task_id} 没有evaluation_stats字段")
			logger.warning(f"Task keys: {list(task.keys())}")

		if existing:
			return self.update_dataset(existing["id"], payload)

		return self.create_dataset(payload)

	def _count_samples(self, file_path: Optional[str], fmt: Optional[str]) -> Optional[int]:
		if not file_path:
			return None
		
		full_path = self._get_full_path(file_path)
		if not full_path.exists():
			return None

		try:
			if fmt == "jsonl":
				count = 0
				with open(full_path, "r", encoding="utf-8") as f:
					for line in f:
						if line.strip():
							count += 1
				return count

			if fmt == "json":
				with open(full_path, "r", encoding="utf-8") as f:
					payload = json.load(f)
				if isinstance(payload, list):
					return len(payload)
				return 1
		except Exception:
			return None

		return None

	def read_preview(self, dataset: Dict, limit: int = 10) -> Dict:
		file_path = dataset.get("file_path")
		fmt = dataset.get("file_format") or dataset.get("format")  # 兼容两种字段名

		if not file_path:
			return {"items": [], "format": fmt}
		
		full_path = self._get_full_path(file_path)
		if not full_path.exists():
			return {"items": [], "format": fmt}

		if fmt == "jsonl":
			items = []
			with open(full_path, "r", encoding="utf-8") as f:
				for line in f:
					if not line.strip():
						continue
					try:
						items.append(json.loads(line))
					except Exception:
						items.append({"raw": line.strip()})
					if len(items) >= limit:
						break
			return {"items": items, "format": fmt}

		if fmt == "json":
			with open(full_path, "r", encoding="utf-8") as f:
				payload = json.load(f)
			if isinstance(payload, list):
				return {"items": payload[:limit], "format": fmt}
			return {"items": [payload], "format": fmt}

		return {"items": [], "format": fmt}

