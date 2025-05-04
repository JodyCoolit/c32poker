#!/bin/bash

# 创建必要的目录和文件
mkdir -p logs
mkdir -p data

# 如果poker.db不存在则创建空文件
if [ ! -f poker.db ]; then
  touch poker.db
  echo "创建了空的 poker.db 文件"
fi

# 如果rooms_state.pickle不存在则创建空文件
if [ ! -f rooms_state.pickle ]; then
  touch rooms_state.pickle
  echo "创建了空的 rooms_state.pickle 文件"
fi

echo "准备工作完成，所有必要的目录和文件已创建" 