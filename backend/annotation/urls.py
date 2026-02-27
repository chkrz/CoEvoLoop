from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ConversationAnnotationViewSet,
    AnnotationBatchViewSet,
    scan_local_datasets,
    get_local_dataset_content,
    list_conversations,
    create_dataset_from_annotations,
    filter_annotations,
    save_annotation_relation,
    get_annotation_statistics,
    get_detailed_annotation_statistics
)
from . import views_v2

router = DefaultRouter()
router.register(r'annotations', ConversationAnnotationViewSet, basename='annotation')
router.register(r'batches', AnnotationBatchViewSet, basename='batch')

urlpatterns = [
    path('api/', include(router.urls)),
    path('local-datasets/', scan_local_datasets, name='scan-local-datasets'),
    path('local-datasets/<str:dataset_id>/content/', get_local_dataset_content, name='get-local-dataset-content'),
    path('annotations/list_conversations/', list_conversations, name='list-conversations'),
    path('annotations/filter/', filter_annotations, name='filter-annotations'),
    path('annotations/relations/', save_annotation_relation, name='save-annotation-relation'),
    path('datasets/from_annotations/', create_dataset_from_annotations, name='create-dataset-from-annotations'),
    path('annotations/statistics/', get_annotation_statistics, name='get-annotation-statistics'),
    path('annotations/statistics/detailed/', get_detailed_annotation_statistics, name='get-detailed-annotation-statistics'),

    # Annotation V2 路由
    path('v2/datasets/<str:dataset_id>/content/', views_v2.get_dataset_content_for_annotation, name='v2-get-dataset-content'),
    path('v2/annotations/save/', views_v2.save_annotation, name='v2-save-annotation'),
    path('v2/datasets/export/', views_v2.annotate_and_export_dataset, name='v2-export-dataset'),
    path('v2/progress/<str:dataset_id>/', views_v2.get_annotation_progress, name='v2-get-progress'),
    path('v2/annotated-datasets/', views_v2.get_annotated_datasets, name='v2-get-annotated-datasets'),
    path('v2/annotations/batch-complete/', views_v2.batch_mark_complete, name='v2-batch-mark-complete'),
    path('v2/annotations/mark-complete/', views_v2.mark_complete, name='v2-mark-complete'),
    path('v2/annotations/unmark-complete/', views_v2.unmark_complete, name='v2-unmark-complete'),
]