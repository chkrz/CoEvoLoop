#!/bin/bash

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  启动 FintlAI-Server 开发环境${NC}"
echo -e "${BLUE}  前后端分离 - 双端口开发模式${NC}"
echo -e "${BLUE}========================================${NC}"

# 检查Poetry
if ! command -v poetry &> /dev/null; then
    echo -e "${RED}错误: 未找到Poetry，请先安装Poetry${NC}"
    echo -e "${YELLOW}安装命令: curl -sSL https://install.python-poetry.org | python3 -${NC}"
    exit 1
fi

# 检查Node.js
if ! command -v npm &> /dev/null; then
    echo -e "${RED}错误: 未找到npm，请先安装Node.js${NC}"
    exit 1
fi

# 存储子进程PID
BACKEND_PID=""
FRONTEND_PID=""
TENSORBOARD_PID=""

# TensorBoard 日志目录（存储所有 RL 日志的 tfevents 文件）
# 使用绝对路径确保正确性
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TENSORBOARD_LOGDIR="${SCRIPT_DIR}/backend/storage/rl_log_data"

# 清理函数
cleanup() {
    echo -e "\n${YELLOW}正在关闭服务...${NC}"
    if [ ! -z "$BACKEND_PID" ]; then
        echo -e "${YELLOW}关闭后端服务 (PID: $BACKEND_PID)${NC}"
        kill $BACKEND_PID 2>/dev/null
    fi
    if [ ! -z "$FRONTEND_PID" ]; then
        echo -e "${YELLOW}关闭前端服务 (PID: $FRONTEND_PID)${NC}"
        kill $FRONTEND_PID 2>/dev/null
    fi
    if [ ! -z "$TENSORBOARD_PID" ]; then
        echo -e "${YELLOW}关闭TensorBoard服务 (PID: $TENSORBOARD_PID)${NC}"
        kill $TENSORBOARD_PID 2>/dev/null
    fi
    echo -e "${GREEN}服务已停止${NC}"
    exit 0
}

# 捕获中断信号
trap cleanup SIGINT SIGTERM

# 如果不存在日志目录，则创建
if [ ! -d "logs" ]; then
    mkdir logs
fi

# 检查并安装依赖
if [ ! -d ".venv" ]; then
    echo -e "${YELLOW}首次运行，安装Python依赖...${NC}"
    poetry install
fi

echo -e "${YELLOW}检查并安装前端依赖...${NC}"
cd viewer
npm install
cd ..

# 启动后端服务（后台运行）
echo -e "${GREEN}启动Django后端服务 (端口 8000)...${NC}"
cd backend
poetry run python manage.py runserver 8000 --settings=coevoloop.settings.local > ../logs/backend.log 2>&1 &
BACKEND_PID=$!
cd ..

# 等待后端启动
sleep 3

# 检查后端是否启动成功
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo -e "${RED}后端启动失败，查看 logs/backend.log 获取详情${NC}"
    exit 1
fi

# 启动前端服务（后台运行）
echo -e "${GREEN}启动React前端服务 (端口 5173)...${NC}"
cd viewer
npm run dev > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..

# 等待前端启动
sleep 3

# 检查前端是否启动成功
if ! kill -0 $FRONTEND_PID 2>/dev/null; then
    echo -e "${RED}前端启动失败，查看 logs/frontend.log 获取详情${NC}"
    cleanup
    exit 1
fi

# 启动 TensorBoard 服务（用于 RL Playground）
echo -e "${GREEN}启动TensorBoard服务 (端口 6006)...${NC}"
# 确保日志目录存在
mkdir -p $TENSORBOARD_LOGDIR
# 检查是否安装了 tensorboard
cd backend
if poetry run python -c "import tensorboard" 2>/dev/null; then
    poetry run tensorboard --logdir=$TENSORBOARD_LOGDIR --port=6006 --bind_all > ../logs/tensorboard.log 2>&1 &
    TENSORBOARD_PID=$!
    cd ..
    sleep 2
    if kill -0 $TENSORBOARD_PID 2>/dev/null; then
        echo -e "${GREEN}TensorBoard 服务已启动${NC}"
    else
        echo -e "${YELLOW}TensorBoard 启动失败（可选服务，不影响使用）${NC}"
        TENSORBOARD_PID=""
    fi
else
    cd ..
    echo -e "${YELLOW}未安装 tensorboard，跳过 TensorBoard 服务${NC}"
    echo -e "${YELLOW}安装命令: poetry add tensorboard${NC}"
fi

echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✅ 服务启动成功！${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}📱 前端应用:    http://localhost:5173${NC}"
echo -e "${GREEN}🔧 后端API:     http://localhost:8000/api/${NC}"
echo -e "${GREEN}📊 Admin后台:   http://localhost:8000/admin/${NC}"
if [ ! -z "$TENSORBOARD_PID" ]; then
echo -e "${GREEN}📈 TensorBoard: http://localhost:6006${NC}"
fi
echo -e "${BLUE}========================================${NC}"
echo -e "${YELLOW}提示: 按 Ctrl+C 停止所有服务${NC}"
echo -e "${YELLOW}日志文件: logs/backend.log, logs/frontend.log, logs/tensorboard.log${NC}"
echo -e "${BLUE}========================================${NC}\n"

# 保持脚本运行，等待用户中断
echo -e "${YELLOW}服务运行中...${NC}\n"

# 显示实时日志（可选）
tail -f logs/backend.log logs/frontend.log 2>/dev/null
