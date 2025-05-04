# Docker部署说明

## 前提条件

- Linux服务器（Ubuntu/Debian推荐）
- 已安装Docker和Docker Compose
- SQLite3命令行工具（用于初始化数据库）
- Python3（用于运行补丁脚本）

## 安装Docker和Docker Compose

如果您的服务器尚未安装Docker和必要工具，请先安装：

```bash
# 安装Docker
sudo apt update
sudo apt install -y docker.io sqlite3 python3
sudo systemctl enable docker
sudo systemctl start docker

# 将当前用户添加到docker组（可选，避免每次都需要sudo）
sudo usermod -aG docker $USER
# 注意：添加用户到组后需要重新登录才能生效

# 安装Docker Compose
# 方法1: 安装Docker Compose插件 (推荐，新版Docker)
sudo apt install -y docker-compose-plugin

# 方法2: 安装独立的docker-compose (旧版)
sudo apt install -y docker-compose
```

## 快速部署步骤

1. 克隆代码库到服务器
   ```bash
   # 方法：克隆到用户目录（推荐）
   git clone https://github.com/JodyCoolit/c32poker.git ~/c32poker
   cd ~/c32poker
   ```

2. 获取当前用户ID，用于容器内权限设置
   ```bash
   # 查看当前用户ID和组ID
   id -u
   id -g
   
   # 如果不是1000:1000，需要在docker-compose.yml中更新user字段
   # 编辑docker-compose.yml文件，修改user值为您的UID:GID
   ```

3. 执行部署脚本
   ```bash
   chmod +x deploy.sh update_frontend_config.sh prepare_deployment.sh prepare_logs.sh
   
   # 正常部署
   ./deploy.sh <服务器IP或域名>
   
   # 清理旧容器和镜像后部署（解决构建问题时使用）
   ./deploy.sh --clean <服务器IP或域名>
   ```
   
   如：`./deploy.sh 192.168.1.100` 或者使用域名 `./deploy.sh poker.example.com`

   如果需要使用服务器的公网IP，可以自动获取：
   ```bash
   ./deploy.sh $(curl -s ifconfig.me)
   ```

## 手动部署步骤

如果您想手动控制部署过程，可以按以下步骤操作：

1. 准备部署环境
   ```bash
   chmod +x prepare_deployment.sh prepare_logs.sh
   ./prepare_deployment.sh
   ./prepare_logs.sh
   ```

2. 更新前端API配置
   ```bash
   chmod +x update_frontend_config.sh
   ./update_frontend_config.sh <服务器IP或域名>
   ```

3. 构建并启动Docker容器
   ```bash
   # 新版Docker
   SERVER_HOST=<服务器IP或域名> docker compose up --build -d
   
   # 旧版Docker
   SERVER_HOST=<服务器IP或域名> docker-compose up --build -d
   ```

## 常用维护命令

**新版Docker命令：**
- 查看容器状态：`docker compose ps`
- 查看容器日志：`docker compose logs -f`
- 重启服务：`docker compose restart`
- 停止服务：`docker compose down`
- 重新构建并启动：`docker compose up --build -d`
- 清理未使用的镜像和容器：`docker system prune -f`

**旧版Docker命令：**
- 查看容器状态：`docker-compose ps`
- 查看容器日志：`docker-compose logs -f`
- 重启服务：`docker-compose restart`
- 停止服务：`docker-compose down`
- 重新构建并启动：`docker-compose up --build -d`

## 数据持久化

以下数据会被持久化保存：

- 数据库 (poker.db)
- 房间状态 (rooms_state.pickle)
- 日志文件 (logs目录和poker_server.log)

## 注意事项

1. 前端服务暴露在8888端口，请确保该端口未被占用
2. 生产环境请修改SECRET_KEY为更安全的密钥
3. 如需配置HTTPS，请修改nginx.conf并添加证书
4. WebSocket连接依赖于稳定的网络环境，请确保服务器防火墙允许WebSocket连接
5. 如遇权限问题，请检查docker-compose.yml中的user设置，确保与当前用户ID匹配

## 访问应用

- 前端界面: `http://<服务器IP或域名>:8888`
- 后端API: `http://<服务器IP或域名>:8000/api`
- WebSocket: `ws://<服务器IP或域名>/ws`

## 故障排除

1. 前端无法连接后端API
   - 检查环境变量`SERVER_HOST`是否正确设置
   - 检查网络和防火墙配置

2. WebSocket连接失败
   - 检查nginx代理配置
   - 检查浏览器控制台错误信息

3. 数据库问题
   - 检查poker.db文件是否正确初始化：`ls -la poker.db`
   - 检查文件权限：`chmod 666 poker.db`
   - 使用`docker compose exec backend python db_upgrade.py`尝试修复

4. 日志文件权限问题
   - 确保poker_server.log文件存在并有正确权限：`touch poker_server.log && chmod 666 poker_server.log`
   - 确保logs目录存在并有正确权限：`mkdir -p logs && chmod 777 logs`
   - 运行日志修复脚本：`./prepare_logs.sh`

5. 构建失败
   - 尝试使用清理选项重新部署：`./deploy.sh --clean <服务器IP>`
   - 检查`prepare_deployment.sh`是否已执行，确保所有必要的文件和目录存在
   - 查看构建日志：`docker compose logs -f`
   - 如果下载镜像慢，可以考虑配置Docker国内镜像源 