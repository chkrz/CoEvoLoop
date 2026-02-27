from django.apps import AppConfig
import logging
import os

logger = logging.getLogger(__name__)

# 全局标记，确保轮询器只启动一次
_poller_started = False


class coevoloopConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'coevoloop'
    
    def ready(self):
        """应用启动时初始化"""
        global _poller_started
        
        # 避免在 Django 迁移、shell 等命令中启动轮询器
        if os.environ.get('RUN_MAIN') == 'true' or os.environ.get('RUN_MAIN') is None:
            # 确保只启动一次
            if not _poller_started:
                from storage.eval_task_poller import start_poller
                try:
                    start_poller()
                    _poller_started = True
                    logger.info("✅ Eval task poller started successfully")
                except Exception as e:
                    logger.error(f"❌ Failed to start eval task poller: {e}", exc_info=True)
            else:
                logger.info("Poller already started, skipping")
        else:
            logger.info(f"Skipping poller start (RUN_MAIN={os.environ.get('RUN_MAIN')})")
