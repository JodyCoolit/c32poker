#!/bin/bash

# 检查是否提供了服务器地址参数
if [ $# -eq 0 ]; then
  echo "用法: $0 <服务器IP或域名>"
  echo "示例: $0 192.168.1.100"
  echo "如果不提供参数，将使用localhost"
  SERVER_HOST="localhost"
else
  SERVER_HOST="$1"
fi

# 确保脚本有执行权限
chmod +x update_frontend_config.sh

# 更新前端配置
./update_frontend_config.sh "$SERVER_HOST"

# 检查docker compose命令可用性
if command -v docker &> /dev/null; then
  if docker compose version &> /dev/null; then
    # 使用新版 docker compose 命令
    echo "开始使用 docker compose 构建容器..."
    SERVER_HOST="$SERVER_HOST" docker compose up --build -d
  elif command -v docker-compose &> /dev/null; then
    # 使用传统的 docker-compose 命令
    echo "开始使用 docker-compose 构建容器..."
    SERVER_HOST="$SERVER_HOST" docker-compose up --build -d
  else
    echo "错误: docker compose 或 docker-compose 命令未找到"
    echo "请安装 Docker Compose:"
    echo "sudo apt update && sudo apt install -y docker-compose-plugin"
    echo "或者"
    echo "sudo apt update && sudo apt install -y docker-compose"
    exit 1
  fi
else
  echo "错误: docker 命令未找到，请先安装 Docker"
  echo "sudo apt update && sudo apt install -y docker.io"
  exit 1
fi

echo "部署完成！"
echo "前端可通过 http://$SERVER_HOST:8888 访问"
echo "后端API可通过 http://$SERVER_HOST/api 访问"
echo "WebSocket可通过 ws://$SERVER_HOST/ws 连接"
echo ""
echo "查看容器状态："
echo "  新版命令: docker compose ps"
echo "  旧版命令: docker-compose ps"
echo "查看容器日志："
echo "  新版命令: docker compose logs -f"
echo "  旧版命令: docker-compose logs -f" 