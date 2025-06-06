#!/bin/bash

# 获取服务器IP地址或域名
SERVER_HOST=${1:-localhost}

# 创建或更新.env文件
cat > client/.env << EOF
REACT_APP_API_URL=http://${SERVER_HOST}:8000
REACT_APP_WS_URL=ws://${SERVER_HOST}:8000
EOF

# 注意这里的API地址包含端口号8000
echo "前端配置已更新，API地址设置为: ${SERVER_HOST}:8000" 