from django.db import models
import uuid
from django.utils import timezone


class ConversationAnnotation(models.Model):
    """对话标注模型"""
    
    QUALITY_CHOICES = [
        (1, '1星 - 很差'),
        (2, '2星 - 较差'),
        (3, '3星 - 一般'),
        (4, '4星 - 良好'),
        (5, '5星 - 优秀'),
    ]
    
    ACCURACY_CHOICES = [
        ('correct', '完全正确'),
        ('partial', '部分正确'),
        ('incorrect', '完全错误'),
    ]
    
    CATEGORY_CHOICES = [
        ('account', '账户问题'),
        ('transaction', '交易问题'),
        ('technical', '技术问题'),
        ('compliance', '合规问题'),
        ('general', '一般咨询'),
        ('other', '其他'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    dataset_id = models.CharField(max_length=100, help_text="关联的数据集ID")
    conversation_id = models.CharField(max_length=100, help_text="对话ID")
    sample_index = models.IntegerField(help_text="样本在数据集中的索引")
    
    # 原始对话数据
    original_data = models.JSONField(help_text="原始对话数据")
    edited_data = models.JSONField(null=True, blank=True, help_text="编辑后的对话数据")
    
    # 标注信息
    quality_score = models.IntegerField(choices=QUALITY_CHOICES, null=True, blank=True)
    accuracy = models.CharField(max_length=20, choices=ACCURACY_CHOICES, null=True, blank=True)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, null=True, blank=True)
    tags = models.JSONField(default=list, blank=True, help_text="自定义标签")
    notes = models.TextField(blank=True, help_text="备注说明")
    
    # 标注状态
    is_annotated = models.BooleanField(default=False)
    annotation_time = models.DateTimeField(null=True, blank=True)
    
    # 用户信息
    annotated_by = models.CharField(max_length=100, blank=True)
    
    # 时间戳
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ['dataset_id', 'conversation_id', 'sample_index']
        ordering = ['-updated_at']
        
    def __str__(self):
        return f"{self.dataset_id}_{self.conversation_id}_{self.sample_index}"


class AnnotationBatch(models.Model):
    """标注批次管理"""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200, help_text="批次名称")
    dataset_id = models.CharField(max_length=100, help_text="关联的数据集ID")
    description = models.TextField(blank=True)
    
    # 统计信息
    total_samples = models.IntegerField(default=0)
    annotated_count = models.IntegerField(default=0)
    
    # 状态
    is_active = models.BooleanField(default=True)
    created_by = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
        
    def __str__(self):
        return self.name