import pytest
import json
import tempfile
import shutil
from pathlib import Path
from datetime import datetime
from ..metadata_manager import AnnotationMetadataManager


class TestAnnotationMetadataManager:
    """测试AnnotationMetadataManager类"""
    
    @pytest.fixture
    def temp_dir(self):
        """创建临时目录用于测试"""
        temp_dir = tempfile.mkdtemp()
        yield temp_dir
        shutil.rmtree(temp_dir)
    
    @pytest.fixture
    def metadata_manager(self, temp_dir):
        """创建测试用的元信息管理器"""
        return AnnotationMetadataManager(temp_dir)
    
    def test_init_creates_metadata_file(self, temp_dir):
        """测试初始化时创建元信息文件"""
        metadata_file = Path(temp_dir) / "copies_metadata.json"
        
        # 文件应该不存在
        assert not metadata_file.exists()
        
        # 创建管理器实例
        manager = AnnotationMetadataManager(temp_dir)
        
        # 文件应该已创建
        assert metadata_file.exists()
        
        # 验证内容
        with open(metadata_file, 'r', encoding='utf-8') as f:
            metadata = json.load(f)
            assert metadata["version"] == "2.0"
            assert "datasets" in metadata
            assert isinstance(metadata["datasets"], dict)
    
    def test_register_dataset(self, metadata_manager):
        """测试注册数据集"""
        dataset_id = "test_dataset_001"
        item_count = 100
        
        # 注册数据集
        metadata_manager.register_dataset(dataset_id, item_count)
        
        # 验证数据集信息
        dataset_info = metadata_manager.get_dataset_info(dataset_id)
        assert dataset_info is not None
        assert dataset_info["total_items"] == item_count
        assert dataset_info["annotated_items"] == 0
        assert dataset_info["annotation_progress"] == 0.0
        assert dataset_info["annotation_id_format"] == "ann_{dataset_id}_{timestamp}_{uuid}_{sequence}"
        assert "created_at" in dataset_info
        assert "last_annotation_at" in dataset_info
    
    def test_register_dataset_with_extra_params(self, metadata_manager):
        """测试注册数据集时包含额外参数"""
        dataset_id = "test_dataset_002"
        item_count = 50
        extra_data = {"description": "测试数据集", "tags": ["test", "demo"]}
        
        metadata_manager.register_dataset(dataset_id, item_count, **extra_data)
        
        dataset_info = metadata_manager.get_dataset_info(dataset_id)
        assert dataset_info["description"] == "测试数据集"
        assert dataset_info["tags"] == ["test", "demo"]
    
    def test_update_annotation(self, metadata_manager):
        """测试更新标注信息"""
        dataset_id = "test_dataset_003"
        item_count = 10
        
        # 注册数据集
        metadata_manager.register_dataset(dataset_id, item_count)
        
        # 更新标注信息
        annotation_id = "ann_test_20240101120000000_abc123_000001"
        line_number = 1
        annotator_id = "test_user"
        
        metadata_manager.update_annotation(
            dataset_id=dataset_id,
            annotation_id=annotation_id,
            line_number=line_number,
            annotator_id=annotator_id,
            status="annotated",
            quality_rating=5,
            tags=["good", "complete"]
        )
        
        # 验证更新结果
        dataset_info = metadata_manager.get_dataset_info(dataset_id)
        assert dataset_info["annotated_items"] == 1
        assert dataset_info["annotation_progress"] == 10.0
        assert dataset_info["last_annotation_at"] is not None
        
        # 验证标注项信息
        annotation_info = metadata_manager.get_annotation_info(dataset_id, line_number)
        assert annotation_info is not None
        assert annotation_info["annotation_id"] == annotation_id
        assert annotation_info["annotator_id"] == annotator_id
        assert annotation_info["status"] == "annotated"
        assert annotation_info["quality_rating"] == 5
        
        # 验证统计数据
        stats = dataset_info["statistics"]
        assert stats["total_annotations"] == 1
        assert stats["quality_distribution"]["5"] == 1
        assert stats["tag_distribution"]["good"] == 1
        assert stats["tag_distribution"]["complete"] == 1
        assert stats["annotator_distribution"]["test_user"] == 1
    
    def test_update_multiple_annotations(self, metadata_manager):
        """测试更新多个标注"""
        dataset_id = "test_dataset_004"
        item_count = 5
        
        metadata_manager.register_dataset(dataset_id, item_count)
        
        # 更新多个标注
        for i in range(1, 4):
            metadata_manager.update_annotation(
                dataset_id=dataset_id,
                annotation_id=f"ann_test_{i:06d}",
                line_number=i,
                annotator_id=f"user_{i}",
                status="annotated",
                quality_rating=i,
                tags=[f"tag_{i}"]
            )
        
        dataset_info = metadata_manager.get_dataset_info(dataset_id)
        assert dataset_info["annotated_items"] == 3
        assert dataset_info["annotation_progress"] == 60.0
        assert dataset_info["statistics"]["total_annotations"] == 3
    
    def test_update_existing_annotation(self, metadata_manager):
        """测试更新已存在的标注"""
        dataset_id = "test_dataset_005"
        item_count = 1
        
        metadata_manager.register_dataset(dataset_id, item_count)
        
        # 首次更新
        metadata_manager.update_annotation(
            dataset_id=dataset_id,
            annotation_id="ann_test_001",
            line_number=1,
            annotator_id="user1",
            status="annotated",
            quality_rating=3
        )
        
        # 再次更新
        metadata_manager.update_annotation(
            dataset_id=dataset_id,
            annotation_id="ann_test_001_updated",
            line_number=1,
            annotator_id="user2",
            status="reviewed",
            quality_rating=4
        )
        
        dataset_info = metadata_manager.get_dataset_info(dataset_id)
        assert dataset_info["annotated_items"] == 1  # 仍然是1个已标注项
        assert dataset_info["statistics"]["total_annotations"] == 1  # 仍然是1个标注
        
        # 验证信息已更新
        annotation_info = metadata_manager.get_annotation_info(dataset_id, 1)
        assert annotation_info["annotator_id"] == "user2"
        assert annotation_info["status"] == "reviewed"
        assert annotation_info["quality_rating"] == 4
    
    def test_get_nonexistent_dataset(self, metadata_manager):
        """测试获取不存在的数据集"""
        dataset_info = metadata_manager.get_dataset_info("nonexistent")
        assert dataset_info is None
    
    def test_get_nonexistent_annotation(self, metadata_manager):
        """测试获取不存在的标注"""
        dataset_id = "test_dataset_006"
        metadata_manager.register_dataset(dataset_id, 10)
        
        annotation_info = metadata_manager.get_annotation_info(dataset_id, 999)
        assert annotation_info is None
    
    def test_delete_dataset(self, metadata_manager):
        """测试删除数据集"""
        dataset_id = "test_dataset_007"
        metadata_manager.register_dataset(dataset_id, 10)
        
        # 确认数据集存在
        assert metadata_manager.get_dataset_info(dataset_id) is not None
        
        # 删除数据集
        result = metadata_manager.delete_dataset(dataset_id)
        assert result is True
        
        # 确认数据集已删除
        assert metadata_manager.get_dataset_info(dataset_id) is None
        
        # 再次删除应该返回False
        result = metadata_manager.delete_dataset(dataset_id)
        assert result is False
    
    def test_get_all_datasets(self, metadata_manager):
        """测试获取所有数据集"""
        # 注册多个数据集
        datasets = ["dataset1", "dataset2", "dataset3"]
        for dataset_id in datasets:
            metadata_manager.register_dataset(dataset_id, 10)
        
        all_datasets = metadata_manager.get_all_datasets()
        assert len(all_datasets) == 3
        
        for dataset_id in datasets:
            assert dataset_id in all_datasets
            assert all_datasets[dataset_id]["total_items"] == 10
    
    def test_statistics_calculation(self, metadata_manager):
        """测试统计计算"""
        dataset_id = "test_dataset_008"
        item_count = 10
        
        metadata_manager.register_dataset(dataset_id, item_count)
        
        # 添加不同质量的标注
        qualities = [1, 2, 2, 3, 3, 3, 4, 4, 4, 4]
        tags = ["tag1", "tag2", "tag3"]
        
        for i, quality in enumerate(qualities, 1):
            metadata_manager.update_annotation(
                dataset_id=dataset_id,
                annotation_id=f"ann_test_{i:03d}",
                line_number=i,
                annotator_id="test_user",
                status="annotated",
                quality_rating=quality,
                tags=[tags[i % len(tags)]]
            )
        
        dataset_info = metadata_manager.get_dataset_info(dataset_id)
        stats = dataset_info["statistics"]
        
        # 验证统计结果
        assert stats["total_annotations"] == 10
        assert stats["quality_distribution"]["1"] == 1
        assert stats["quality_distribution"]["2"] == 2
        assert stats["quality_distribution"]["3"] == 3
        assert stats["quality_distribution"]["4"] == 4
        assert stats["tag_distribution"]["tag1"] == 4
        assert stats["tag_distribution"]["tag2"] == 3
        assert stats["tag_distribution"]["tag3"] == 3
        assert stats["annotator_distribution"]["test_user"] == 10
    
    def test_empty_metadata_file_handling(self, temp_dir):
        """测试处理空或损坏的元信息文件"""
        metadata_file = Path(temp_dir) / "copies_metadata.json"
        
        # 创建空文件
        with open(metadata_file, 'w', encoding='utf-8') as f:
            f.write("")
        
        # 应该能正常初始化
        manager = AnnotationMetadataManager(temp_dir)
        
        # 验证文件已修复
        with open(metadata_file, 'r', encoding='utf-8') as f:
            metadata = json.load(f)
            assert metadata["version"] == "2.0"
    
    def test_corrupted_metadata_file_handling(self, temp_dir):
        """测试处理损坏的元信息文件"""
        metadata_file = Path(temp_dir) / "copies_metadata.json"
        
        # 创建损坏的文件
        with open(metadata_file, 'w', encoding='utf-8') as f:
            f.write("{invalid json")
        
        # 应该能正常初始化并修复文件
        manager = AnnotationMetadataManager(temp_dir)
        
        # 验证文件已修复
        with open(metadata_file, 'r', encoding='utf-8') as f:
            metadata = json.load(f)
            assert metadata["version"] == "2.0"
    
    def test_metadata_persistence(self, temp_dir):
        """测试元信息持久化"""
        dataset_id = "test_persistence"
        
        # 创建管理器并注册数据集
        manager1 = AnnotationMetadataManager(temp_dir)
        manager1.register_dataset(dataset_id, 5)
        manager1.update_annotation(dataset_id, "test_id", 1, "user1", quality_rating=5)
        
        # 创建新的管理器实例，应该能读取到之前的数据
        manager2 = AnnotationMetadataManager(temp_dir)
        dataset_info = manager2.get_dataset_info(dataset_id)
        
        assert dataset_info is not None
        assert dataset_info["total_items"] == 5
        assert dataset_info["annotated_items"] == 1
        assert dataset_info["statistics"]["quality_distribution"]["5"] == 1


if __name__ == "__main__":
    pytest.main([__file__, "-v"])