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

# 构建并启动Docker容器
echo "开始构建Docker容器..."
SERVER_HOST="$SERVER_HOST" docker-compose up --build -d

echo "部署完成！"
echo "前端可通过 http://$SERVER_HOST:8888 访问"
echo "后端API可通过 http://$SERVER_HOST/api 访问"
echo "WebSocket可通过 ws://$SERVER_HOST/ws 连接"
echo ""
echo "查看容器状态：docker-compose ps"
echo "查看容器日志：docker-compose logs -f" 