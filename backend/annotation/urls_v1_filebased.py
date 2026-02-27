from django.urls import path
from . import views_v1_filebased

urlpatterns = [
    # 对话列表 API
    path('conversations/list/', views_v1_filebased.list_conversations_v1, name='list-conversations-v1'),
    path('conversations/get/', views_v1_filebased.get_conversation_v1, name='get-conversation-v1'),

    # 标注管理 API
    path('annotations/save/', views_v1_filebased.save_annotation_v1, name='save-annotation-v1'),
    path('annotations/stats/', views_v1_filebased.get_annotation_stats_v1, name='get-annotation-stats-v1'),
    path('annotations/filter/', views_v1_filebased.get_annotated_conversations_v1, name='get-annotated-conversations-v1'),

    # 数据集创建 API
    path('datasets/from-annotations/', views_v1_filebased.create_dataset_from_annotations_v1, name='create-dataset-from-annotations-v1'),

    # 关联关系 API
    path('annotations/relations/', views_v1_filebased.get_annotation_relations_v1, name='get-annotation-relations-v1'),
    path('annotations/relations/save/', views_v1_filebased.save_annotation_relation_v1, name='save-annotation-relations-v1'),

    # 进行中的标注 API
    path('annotations/in-progress/', views_v1_filebased.get_in_progress_annotations_v1, name='get-in-progress-annotations-v1'),
]