from .base import *


# init log
if not os.path.exists(BASE_LOG_DIR):
    os.makedirs(BASE_LOG_DIR, exist_ok=True)

# 创建空日志文件（如果不存在）
for log_file in [APP_DEFAULT_LOG_FILE, APP_ERROR_LOG_FILE]:
    print(log_file)
    if not os.path.isfile(log_file):
        open(log_file, 'a').close()  # 创建空文件