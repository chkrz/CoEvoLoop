# gunicorn_config.py
import multiprocessing

# 绑定ip和端口号
bind = "0.0.0.0:8000"

# 使用gevent模式，还可以使用sync 模式，默认的是sync模式
worker_class = 'sync'

# 开启的进程数
workers = multiprocessing.cpu_count() * 2 + 1

timeout = 300

# 并发处理的请求数量
threads = 10

# 最大待处理连接数
backlog = 2048

# 工作模式协程
worker_connections = 1000

# 重载、修改配置后，自动重新加载程序
reload = True

# 访问日志文件
accesslog = "/home/admin/logs/gunicorn_access.log"

# 错误日志文件
errorlog = "/home/admin/logs/gunicorn_error.log"
