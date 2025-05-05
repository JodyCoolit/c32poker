#!/bin/bash

echo "开始准备部署环境..."

# 创建必要的目录和文件
mkdir -p logs
mkdir -p data

# 检查是否存在有效的数据库文件
if [ ! -f poker.db ] || [ ! -s poker.db ]; then
  echo "创建新的SQLite数据库文件..."
  if ! command -v sqlite3 &> /dev/null; then
    echo "警告: sqlite3命令未找到，尝试安装..."
    apt-get update && apt-get install -y sqlite3
  fi

  # 确保数据库目录存在
  mkdir -p data

  # 删除旧数据库文件
  rm -f poker.db

  # 创建新数据库并初始化表结构
  sqlite3 poker.db << EOF
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 添加其他必要的表...

-- 添加测试用户
INSERT INTO users (username, password_hash) VALUES ('admin', '123');
INSERT INTO users (username, password_hash) VALUES ('hq', '123');
EOF

  chmod 666 poker.db
  echo "数据库初始化完成"
else
  echo "使用现有的数据库文件"
fi

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