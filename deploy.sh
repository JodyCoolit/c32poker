#!/bin/bash

# 检查参数
if [ "$1" = "--clean" ] || [ "$2" = "--clean" ]; then
  CLEAN=true
  if [ "$1" = "--clean" ]; then
    shift
  fi
else
  CLEAN=false
fi

# 检查是否提供了服务器地址参数
if [ $# -eq 0 ]; then
  echo "用法: $0 [--clean] <服务器IP或域名>"
  echo "示例: $0 192.168.1.100"
  echo "使用--clean选项清理旧镜像和容器"
  echo "如果不提供参数，将使用localhost"
  SERVER_HOST="localhost"
else
  SERVER_HOST="$1"
fi

# 确保脚本有执行权限
chmod +x update_frontend_config.sh
chmod +x prepare_deployment.sh

# 执行准备工作
echo "执行部署准备工作..."
./prepare_deployment.sh

# 更新前端配置
./update_frontend_config.sh "$SERVER_HOST"

# 检查docker compose命令可用性
if command -v docker &> /dev/null; then
  # 确定docker compose命令
  if docker compose version &> /dev/null; then
    DOCKER_COMPOSE="docker compose"
    echo "使用新版 docker compose 命令"
  elif command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
    echo "使用传统的 docker-compose 命令"
  else
    echo "错误: docker compose 或 docker-compose 命令未找到"
    echo "请安装 Docker Compose:"
    echo "sudo apt update && sudo apt install -y docker-compose-plugin"
    echo "或者"
    echo "sudo apt update && sudo apt install -y docker-compose"
    exit 1
  fi
  
  # 如果指定了清理，则先停止并删除旧容器和镜像
  if [ "$CLEAN" = true ]; then
    echo "清理旧容器和镜像..."
    $DOCKER_COMPOSE down
    docker system prune -f
    echo "清理完成"
  fi
  
  # 构建并启动容器
  echo "开始构建容器..."
  SERVER_HOST="$SERVER_HOST" $DOCKER_COMPOSE up --build -d
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