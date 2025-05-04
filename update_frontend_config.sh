#!/bin/bash

# 获取服务器IP地址或域名
SERVER_HOST=${1:-localhost}

# 创建或更新.env文件
cat > client/.env << EOF
REACT_APP_API_URL=http://${SERVER_HOST}
REACT_APP_WS_URL=ws://${SERVER_HOST}/ws
EOF

# 注意这里的API地址不含端口，因为nginx会代理/api请求到后端
echo "前端配置已更新，API地址设置为: ${SERVER_HOST}" 