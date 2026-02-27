from dotenv import load_dotenv

from .base import *
from dotenv import load_dotenv

# Enable DEBUG mode for local development
DEBUG = True

load_dotenv()

# init log dir
BASE_LOG_DIR = BASE_DIR / 'logs'
APP_DEFAULT_LOG_FILE = BASE_LOG_DIR / 'app-default.log'
APP_ERROR_LOG_FILE = BASE_LOG_DIR / 'common-error.log'


# Logging
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    "formatters": {
        "antdefault": {
            "format": "%(asctime)s %(levelname)s %(name)s:%(lineno)d - %(message)s"
        }
    },
    # handler改成TimedRotatingFileHandler
    "handlers": {
        # 具体参数：https://blog.csdn.net/B11050729/article/details/132353220
        "file": {
            "class": "logging.handlers.TimedRotatingFileHandler",
            "filename": str(APP_DEFAULT_LOG_FILE),
            "formatter": "antdefault",
            "level": "INFO",
            "when": "midnight",
            "interval": 1,
            "backupCount": 5,
            "encoding": "utf-8"
        },
        "error": {
            "class": "logging.handlers.TimedRotatingFileHandler",
            "filename": str(APP_ERROR_LOG_FILE),
            "formatter": "antdefault",
            "level": "ERROR",
            "when": "midnight",
            "interval": 1,
            "backupCount": 5,
            "encoding": "utf-8"
        },
        "console": {
            "level": "INFO",
            "class": "logging.StreamHandler",
            "formatter": "antdefault",
        }
    },
    "loggers": {
        "demoapp": {
            "handlers": ["file", "console", "error"],
            "level": "INFO",
            "propagate": True,
        },
        "mydemo": {
            "handlers": ["file", "console", "error"],
            "level": "INFO",
            "propagate": True,
        },
         "django": {
            "handlers": ["file", "console", "error"],
            "level": "DEBUG",
            "propagate": True,
        }
    }
}

# init log
if not os.path.exists(BASE_LOG_DIR):
    os.makedirs(BASE_LOG_DIR, exist_ok=True)

# 创建空日志文件（如果不存在）
for log_file in [APP_DEFAULT_LOG_FILE, APP_ERROR_LOG_FILE]:
    print(log_file)
    if not os.path.isfile(log_file):
        open(log_file, 'a').close()  # 创建空文件

DEBUG = True
