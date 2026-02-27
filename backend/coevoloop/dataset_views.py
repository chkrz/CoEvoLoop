"""
Dataset API (local json/jsonl files).
"""
import os
import json
from pathlib import Path
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from django.http import FileResponse
from storage.dataset_storage import DatasetStorage


dataset_storage = DatasetStorage()


def _get_storage_dir(subdir: str) -> Path:
	backend_dir = Path(__file__).parent.parent
	return backend_dir / "storage" / subdir


@api_view(["GET"])
def dataset_list(request):
	data_type = request.GET.get("type")
	source = request.GET.get("source")
	search = request.GET.get("search")

	datasets = dataset_storage.list_datasets(
		type_filter=data_type,
		source_filter=source,
		search=search
	)

	return Response({
		"datasets": datasets,
		"count": len(datasets)
	})


@api_view(["GET"])
def dataset_detail(request, dataset_id):
	dataset = dataset_storage.get_dataset(dataset_id)
	if not dataset:
		return Response({"error": "数据集不存在"}, status=status.HTTP_404_NOT_FOUND)
	return Response(dataset)


@api_view(["GET"])
def dataset_preview(request, dataset_id):
	dataset = dataset_storage.get_dataset(dataset_id)
	if not dataset:
		return Response({"error": "数据集不存在"}, status=status.HTTP_404_NOT_FOUND)

	try:
		limit = int(request.GET.get("limit", 10))
	except Exception:
		limit = 10

	preview = dataset_storage.read_preview(dataset, limit=limit)
	return Response({
		"dataset_id": dataset_id,
		"format": preview.get("format"),
		"items": preview.get("items", [])
	})


@api_view(["GET"])
def dataset_download(request, dataset_id):
	dataset = dataset_storage.get_dataset(dataset_id)
	if not dataset:
		return Response({"error": "数据集不存在"}, status=status.HTTP_404_NOT_FOUND)

	file_path = dataset.get("file_path")
	if not file_path:
		return Response({"error": "文件路径不存在"}, status=status.HTTP_404_NOT_FOUND)
	
	# file_path是相对于storage目录的相对路径，需要转换为绝对路径
	backend_dir = Path(__file__).parent.parent
	full_path = backend_dir / "storage" / file_path
	
	if not full_path.exists():
		return Response({"error": f"文件不存在: {file_path}"}, status=status.HTTP_404_NOT_FOUND)

	filename = dataset.get("name", os.path.basename(file_path)) + "." + dataset.get("file_format", "jsonl")
	return FileResponse(open(full_path, "rb"), as_attachment=True, filename=filename)


@api_view(["POST"])
def dataset_upload(request):
	upload_file = request.FILES.get("file")
	data_type = request.data.get("data_type")
	name = request.data.get("name")

	if not upload_file:
		return Response({"error": "缺少上传文件"}, status=status.HTTP_400_BAD_REQUEST)

	if data_type not in ["PORTRAIT", "DIALOGUE", "EVALUATION", "HUMAN_HUMAN_DIALOGUE"]:
		return Response({"error": "无效的数据类型"}, status=status.HTTP_400_BAD_REQUEST)

	original_name = upload_file.name or "dataset.jsonl"
	ext = original_name.rsplit(".", 1)[-1].lower() if "." in original_name else "jsonl"
	if ext not in ["json", "jsonl"]:
		return Response({"error": "仅支持 json/jsonl 文件"}, status=status.HTTP_400_BAD_REQUEST)

	manual_dir = _get_storage_dir("manual_outputs")
	manual_dir.mkdir(parents=True, exist_ok=True)

	dataset_id = dataset_storage._generate_id()
	file_name = f"{dataset_id}.{ext}"
	file_path = manual_dir / file_name

	with open(file_path, "wb") as f:
		for chunk in upload_file.chunks():
			f.write(chunk)

	size_bytes = os.path.getsize(file_path)
	sample_count = dataset_storage._count_samples(str(file_path), ext)

	dataset = dataset_storage.create_dataset({
		"id": dataset_id,
		"name": name or original_name,
		"data_type": data_type,
		"source": "UPLOAD",
		"file_path": str(file_path),
		"file_name": file_name,
		"format": ext,
		"size_bytes": size_bytes,
		"sample_count": sample_count
	})

	return Response(dataset, status=status.HTTP_201_CREATED)


@api_view(["DELETE"])
def dataset_delete(request, dataset_id):
	dataset = dataset_storage.get_dataset(dataset_id)
	if not dataset:
		return Response({"error": "数据集不存在"}, status=status.HTTP_404_NOT_FOUND)

	file_path = dataset.get("file_path")
	if file_path and os.path.exists(file_path):
		try:
			os.remove(file_path)
		except Exception:
			pass

	dataset_storage.delete_dataset(dataset_id)
	return Response(status=status.HTTP_204_NO_CONTENT)

