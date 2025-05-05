#!/bin/bash

echo "开始准备部署环境..."

# 创建必要的目录和文件
mkdir -p logs
mkdir -p data

# 确保sqlite3命令可用
if ! command -v sqlite3 &> /dev/null; then
  echo "警告: sqlite3命令未找到，尝试安装..."
  apt-get update && apt-get install -y sqlite3
  
  if ! command -v sqlite3 &> /dev/null; then
    echo "错误: 无法安装sqlite3，请手动安装"
    exit 1
  fi
fi

echo "确保数据库目录存在..."
mkdir -p data

# 删除旧数据库文件（如果存在）
if [ -f poker.db ]; then
  echo "删除旧的数据库文件..."
  rm -f poker.db
elif [ -d poker.db ]; then
  echo "警告: poker.db 是一个目录而不是文件，正在删除..."
  rm -rf poker.db
fi

echo "创建新的SQLite数据库文件..."
# 创建新数据库并初始化表结构
sqlite3 poker.db << EOF
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

EOF

# 验证数据库是否创建成功
echo "验证数据库创建..."
if [ -f poker.db ] && [ -s poker.db ]; then
  echo "数据库文件创建成功，大小: $(ls -lh poker.db | awk '{print $5}')"
  
  # 验证表结构
  echo "验证表结构..."
  SCHEMA=$(sqlite3 poker.db ".schema users")
  echo "用户表结构: $SCHEMA"
  
  # 验证数据
  echo "验证测试用户数据..."
  USERS=$(sqlite3 poker.db "SELECT username, password_hash FROM users;")
  echo "数据库用户: $USERS"
else
  echo "错误: 数据库文件创建失败或为空"
  exit 1
fi

# 设置正确的权限
echo "设置数据库文件权限..."
chmod 666 poker.db
echo "数据库初始化完成"

# 如果rooms_state.pickle不存在或为空，创建有效的pickle文件
if [ ! -f rooms_state.pickle ] || [ ! -s rooms_state.pickle ]; then
  echo "创建初始房间状态文件..."
  # 创建一个最简单的pickle文件，表示空的房间字典
  python3 -c "import pickle; pickle.dump({}, open('rooms_state.pickle', 'wb'))"
  echo "房间状态文件创建完成"
else
  echo "使用现有的房间状态文件"
fi

# 设置正确的文件权限
chmod 666 poker.db rooms_state.pickle
chmod -R 777 logs data

echo "准备工作完成，所有必要的目录和文件已创建"
echo "数据库路径: $(pwd)/poker.db" 