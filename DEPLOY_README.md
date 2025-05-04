# Docker部署说明

## 前提条件

- 已安装Docker和Docker Compose
- Linux服务器（Ubuntu/Debian推荐）

## 快速部署步骤

1. 克隆代码库到服务器
   ```bash
   git clone https://github.com/JodyCoolit/c32poker.git /opt/c32poker
   cd /opt/c32poker
   ```

2. 执行部署脚本
   ```bash
   chmod +x deploy.sh
   ./deploy.sh <服务器IP或域名>
   ```
   
   如：`./deploy.sh 192.168.1.100` 或者使用域名 `./deploy.sh poker.example.com`

## 手动部署步骤

如果您想手动控制部署过程，可以按以下步骤操作：

1. 更新前端API配置
   ```bash
   chmod +x update_frontend_config.sh
   ./update_frontend_config.sh <服务器IP或域名>
   ```

2. 构建并启动Docker容器
   ```bash
   SERVER_HOST=<服务器IP或域名> docker-compose up --build -d
   ```

## 常用维护命令

- 查看容器状态：`docker-compose ps`
- 查看容器日志：`docker-compose logs -f`
- 重启服务：`docker-compose restart`
- 停止服务：`docker-compose down`
- 重新构建并启动：`docker-compose up --build -d`

## 数据持久化

以下数据会被持久化保存：

- 数据库 (poker.db)
- 房间状态 (rooms_state.pickle)
- 日志文件 (logs目录)

## 注意事项

1. 前端服务暴露在8888端口，请确保该端口未被占用
2. 生产环境请修改SECRET_KEY为更安全的密钥
3. 如需配置HTTPS，请修改nginx.conf并添加证书
4. WebSocket连接依赖于稳定的网络环境，请确保服务器防火墙允许WebSocket连接

## 访问应用

- 前端界面: `http://<服务器IP或域名>:8888`
- 后端API: `http://<服务器IP或域名>/api`
- WebSocket: `ws://<服务器IP或域名>/ws`

## 故障排除

1. 前端无法连接后端API
   - 检查环境变量`SERVER_HOST`是否正确设置
   - 检查网络和防火墙配置

2. WebSocket连接失败
   - 检查nginx代理配置
   - 检查浏览器控制台错误信息

3. 数据库问题
   - 使用`docker-compose exec backend python db_upgrade.py`尝试修复 