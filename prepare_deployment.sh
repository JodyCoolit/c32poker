#!/bin/bash

echo "开始准备部署环境..."

# 创建必要的目录和文件
mkdir -p logs
mkdir -p data

# 检查是否存在有效的数据库文件
if [ ! -f poker.db ] || [ ! -s poker.db ]; then
  echo "创建新的SQLite数据库文件..."
  # 创建基本的SQLite数据库结构
  cat > init_db.sql << EOF
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    email TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS game_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id TEXT,
    game_data TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
EOF
  # 初始化数据库
  sqlite3 poker.db < init_db.sql
  rm init_db.sql
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