import pytest
import uuid
from datetime import datetime
from ..id_generator import AnnotationIdGenerator


class TestAnnotationIdGenerator:
    """测试AnnotationIdGenerator类"""
    
    def test_generate_id_format(self):
        """测试ID格式正确性"""
        dataset_id = "test_dataset_001"
        sequence = 1
        
        annotation_id = AnnotationIdGenerator.generate_id(dataset_id, sequence)
        
        # 检查基本格式
        assert annotation_id.startswith("ann_")
        assert dataset_id in annotation_id
        assert len(annotation_id.split("_")) == 5
        
        # 检查各部分
        parts = annotation_id.split("_")
        assert parts[0] == "ann"
        assert parts[1] == dataset_id
        assert len(parts[2]) == 17  # 时间戳长度
        assert len(parts[3]) == 8   # UUID短格式长度
        assert parts[4] == "000001"  # 序列号格式
    
    def test_generate_id_custom_prefix(self):
        """测试自定义前缀"""
        dataset_id = "test_dataset"
        sequence = 42
        prefix = "custom"
        
        annotation_id = AnnotationIdGenerator.generate_id(dataset_id, sequence, prefix)
        
        assert annotation_id.startswith("custom_")
        parts = annotation_id.split("_")
        assert parts[0] == "custom"
        assert parts[4] == "000042"
    
    def test_generate_id_sequence_padding(self):
        """测试序列号填充"""
        dataset_id = "test"
        
        # 测试不同长度的序列号
        assert AnnotationIdGenerator.generate_id(dataset_id, 1).endswith("_000001")
        assert AnnotationIdGenerator.generate_id(dataset_id, 99).endswith("_000099")
        assert AnnotationIdGenerator.generate_id(dataset_id, 999999).endswith("_999999")
    
    def test_parse_id_valid(self):
        """测试解析有效的ID"""
        dataset_id = "test_dataset_001"
        sequence = 123
        
        annotation_id = AnnotationIdGenerator.generate_id(dataset_id, sequence)
        parsed = AnnotationIdGenerator.parse_id(annotation_id)
        
        assert parsed["prefix"] == "ann"
        assert parsed["dataset_id"] == dataset_id
        assert len(parsed["timestamp"]) == 17
        assert len(parsed["uuid"]) == 8
        assert parsed["sequence"] == sequence
    
    def test_parse_id_invalid(self):
        """测试解析无效的ID"""
        # 格式不正确
        assert AnnotationIdGenerator.parse_id("invalid_id") == {}
        assert AnnotationIdGenerator.parse_id("ann_test") == {}
        assert AnnotationIdGenerator.parse_id("wrong_prefix_test_123456_abc_001") == {}
    
    def test_is_valid_id(self):
        """测试ID有效性验证"""
        # 有效的ID
        valid_id = AnnotationIdGenerator.generate_id("test", 1)
        assert AnnotationIdGenerator.is_valid_id(valid_id) is True
        
        # 无效的ID
        assert AnnotationIdGenerator.is_valid_id("invalid") is False
        assert AnnotationIdGenerator.is_valid_id("ann_test") is False
        assert AnnotationIdGenerator.is_valid_id("ann_test_123_abc_def_ghi") is False
        assert AnnotationIdGenerator.is_valid_id("wrong_prefix_test_20240101120000000_abc_001") is False
    
    def test_timestamp_format(self):
        """测试时间戳格式"""
        dataset_id = "test"
        sequence = 1
        
        annotation_id = AnnotationIdGenerator.generate_id(dataset_id, sequence)
        timestamp_str = annotation_id.split("_")[2]
        
        # 验证时间戳可以解析为datetime
        try:
            parsed_time = datetime.strptime(timestamp_str, "%Y%m%d%H%M%S%f")
            assert isinstance(parsed_time, datetime)
        except ValueError:
            pytest.fail(f"时间戳格式无效: {timestamp_str}")
    
    def test_uuid_uniqueness(self):
        """测试UUID的唯一性"""
        dataset_id = "test"
        sequence = 1
        
        # 生成多个ID，检查UUID部分是否不同
        ids = [AnnotationIdGenerator.generate_id(dataset_id, sequence) for _ in range(100)]
        uuids = [id_.split("_")[3] for id_ in ids]
        
        # 应该所有UUID都不同
        assert len(set(uuids)) == len(uuids)
    
    def test_id_uniqueness(self):
        """测试完整ID的唯一性"""
        dataset_id = "test"
        
        # 生成多个ID，检查是否都不同
        ids = [AnnotationIdGenerator.generate_id(dataset_id, i) for i in range(100)]
        assert len(set(ids)) == len(ids)
    
    def test_special_characters_in_dataset_id(self):
        """测试数据集ID包含特殊字符"""
        dataset_id = "test-dataset_with.special@chars"
        sequence = 1
        
        annotation_id = AnnotationIdGenerator.generate_id(dataset_id, sequence)
        
        # 应该正确处理特殊字符
        assert dataset_id in annotation_id
        assert annotation_id.count("_") == 4  # 确保特殊字符不影响分割
    
    def test_large_sequence_numbers(self):
        """测试大序列号"""
        dataset_id = "test"
        sequence = 999999
        
        annotation_id = AnnotationIdGenerator.generate_id(dataset_id, sequence)
        
        # 应该正确处理大序列号
        assert annotation_id.endswith("_999999")
        parsed = AnnotationIdGenerator.parse_id(annotation_id)
        assert parsed["sequence"] == 999999


class TestAnnotationIdGeneratorIntegration:
    """集成测试"""
    
    def test_full_workflow(self):
        """测试完整工作流程"""
        dataset_id = "integration_test"
        
        # 生成多个ID
        ids = []
        for i in range(1, 6):
            annotation_id = AnnotationIdGenerator.generate_id(dataset_id, i)
            ids.append(annotation_id)
            
            # 验证每个ID
            assert AnnotationIdGenerator.is_valid_id(annotation_id)
            
            # 解析并验证
            parsed = AnnotationIdGenerator.parse_id(annotation_id)
            assert parsed["dataset_id"] == dataset_id
            assert parsed["sequence"] == i
        
        # 验证所有ID都不同
        assert len(set(ids)) == len(ids)
        
        # 验证ID格式一致性
        for id_ in ids:
            parts = id_.split("_")
            assert len(parts) == 5
            assert parts[0] == "ann"
            assert parts[1] == dataset_id
            assert len(parts[2]) == 17
            assert len(parts[3]) == 8
            assert parts[4].isdigit()
            assert len(parts[4]) == 6


if __name__ == "__main__":
    pytest.main([__file__, "-v"])