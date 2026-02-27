"""mydemo URL Configuration

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/4.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.conf import settings
from django.urls import include, path, re_path
from django.views.static import serve
from rest_framework.decorators import api_view
from rest_framework.response import Response
from coevoloop import dataset_views, synthesis_views, rl_playground_views, conversation_views


@api_view(['GET'])
def cards_api(request):
    return Response({
        'cards': 123,
    })

# API路由
urlpatterns = [
    # Conversation API
    path('api/conversations/create/', conversation_views.conversation_create_api, name='conversation_create_api'),
    path('api/conversations/<str:conversation_id>/', conversation_views.conversation_detail_api, name='conversation_detail_api'),
    path('api/conversations/<str:conversation_id>/send/', conversation_views.send_message_api, name='send_message_api'),
    path('api/conversations/<str:conversation_id>/score-detail/', conversation_views.conversation_score_detail_api, name='conversation_score_detail_api'),
    path('api/users/', conversation_views.users_api, name='users_api'),
    path('api/generate_user_input/', conversation_views.generate_user_input_api, name='generate_user_input_api'),
    
    # Annotation API
    path('api/', include("annotation.urls")),
    path('api/', include("annotation.urls_v1_filebased")),

    # 数据集管理 API
    path('api/datasets/', dataset_views.dataset_list, name='dataset-list'),
    path('api/datasets/upload/', dataset_views.dataset_upload, name='dataset-upload'),
    path('api/datasets/<str:dataset_id>/', dataset_views.dataset_detail, name='dataset-detail'),
    path('api/datasets/<str:dataset_id>/preview/', dataset_views.dataset_preview, name='dataset-preview'),
    path('api/datasets/<str:dataset_id>/download/', dataset_views.dataset_download, name='dataset-download'),
    path('api/datasets/<str:dataset_id>/delete/', dataset_views.dataset_delete, name='dataset-delete'),

    # 数据合成任务 API
    # 注意：固定路径必须在动态路径之前
    path('api/synthesis/tasks/', synthesis_views.synthesis_task_list, name='synthesis-task-list'),
    path('api/synthesis/tasks/stats/', synthesis_views.synthesis_task_stats, name='synthesis-task-stats'),
    path('api/synthesis/portraits/', synthesis_views.portrait_task_list, name='portrait-task-list'),
    path('api/synthesis/dialogues/', synthesis_views.dialogue_task_list, name='dialogue-task-list'),
    path('api/synthesis/tasks/<str:task_id>/start/', synthesis_views.synthesis_task_start, name='synthesis-task-start'),
    path('api/synthesis/tasks/<str:task_id>/cancel/', synthesis_views.synthesis_task_cancel, name='synthesis-task-cancel'),
    path('api/synthesis/tasks/<str:task_id>/progress/', synthesis_views.synthesis_task_progress, name='synthesis-task-progress'),
    path('api/synthesis/tasks/<str:task_id>/preview/', synthesis_views.synthesis_task_preview, name='synthesis-task-preview'),
    path('api/synthesis/tasks/<str:task_id>/download/', synthesis_views.synthesis_task_download, name='synthesis-task-download'),
    path('api/synthesis/tasks/<str:task_id>/', synthesis_views.synthesis_task_detail, name='synthesis-task-detail'),

    # RL Playground API
    path('api/rl-logs/', rl_playground_views.rl_log_list, name='rl-log-list'),
    path('api/rl-logs/validate/', rl_playground_views.validate_log_file, name='rl-log-validate'),
    path('api/rl-logs/delete-all/', rl_playground_views.rl_log_delete_all, name='rl-log-delete-all'),
    path('api/rl-logs/storage-info/', rl_playground_views.rl_log_storage_info, name='rl-log-storage-info'),
    path('api/rl-logs/<str:log_id>/', rl_playground_views.rl_log_detail, name='rl-log-detail'),
    path('api/rl-logs/<str:log_id>/batch/<int:batch_index>/', rl_playground_views.rl_log_batch, name='rl-log-batch'),
    path('api/rl-logs/<str:log_id>/analysis/', rl_playground_views.rl_log_analysis, name='rl-log-analysis'),
    path('api/rl-logs/<str:log_id>/overview/', rl_playground_views.rl_log_overview, name='rl-log-overview'),
    path('api/rl-logs/<str:log_id>/dimension-trends/', rl_playground_views.rl_log_dimension_trends, name='rl-log-dimension-trends'),
    path('api/rl-logs/<str:log_id>/step-comparison/', rl_playground_views.rl_log_step_comparison, name='rl-log-step-comparison'),
    path('api/rl-logs/<str:log_id>/compare/<int:batch_a>/<int:batch_b>/', rl_playground_views.rl_log_compare_batches, name='rl-log-compare-batches'),
    # 新的 case-based APIs
    path('api/rl-logs/<str:log_id>/case/<int:case_id>/trend/', rl_playground_views.rl_log_case_trend, name='rl-log-case-trend'),
    path('api/rl-logs/<str:log_id>/case/<int:case_id>/step/<int:step>/', rl_playground_views.rl_log_case_step_detail, name='rl-log-case-step-detail'),
    path('api/rl-logs/<str:log_id>/case/<int:case_id>/compare/<int:step_a>/<int:step_b>/', rl_playground_views.rl_log_compare_steps, name='rl-log-compare-steps'),
    # TensorBoard APIs
    path('api/rl-logs/<str:log_id>/tfevents/', rl_playground_views.rl_log_upload_tfevents, name='rl-log-upload-tfevents'),
    path('api/rl-logs/<str:log_id>/tensorboard/tags/', rl_playground_views.rl_log_tensorboard_tags, name='rl-log-tensorboard-tags'),
    path('api/rl-logs/<str:log_id>/tensorboard/scalars/', rl_playground_views.rl_log_tensorboard_scalars, name='rl-log-tensorboard-scalars'),
    path('api/rl-logs/<str:log_id>/tensorboard/status/', rl_playground_views.rl_log_tensorboard_status, name='rl-log-tensorboard-status'),
    path('api/rl-logs/<str:log_id>/tfevents/delete/', rl_playground_views.rl_log_delete_tfevents, name='rl-log-delete-tfevents'),
    
    path('health_check/', include('health_check.urls')),
]

# 静态文件服务 - 只在非DEBUG模式下手动配置
# 在DEBUG模式下，Django会自动处理静态文件
if not settings.DEBUG:
    urlpatterns += [
        re_path(r'^static/(?P<path>.*)$', serve, {
            'document_root': settings.STATIC_ROOT,
        }),
    ]

# 前端路由 - 捕获所有非API路由并返回index.html
from coevoloop.views_frontend import FrontendAppView

# 添加前端路由 - 确保根路径和SPA路由都能访问
urlpatterns += [
    path('', FrontendAppView.as_view(), name='frontend'),
    re_path(r'^(?!api|health_check|admin|static|media).*', FrontendAppView.as_view(), name='frontend-catchall'),
]