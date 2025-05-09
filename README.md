# C32 扑克游戏项目

C32扑克是一个完整的在线德州扑克游戏系统，采用前后端分离架构，支持实时多人游戏、房间管理、用户认证等功能。

## 项目架构

### 后端架构 (Python FastAPI)

#### 技术栈
- **FastAPI**: 构建高性能RESTful API和WebSocket服务
- **JWT**: 用户身份验证
- **Uvicorn**: ASGI服务器
- **WebSockets**: 实时游戏通信

#### 核心模块

1. **模型层** (`src/models/`)
   - `room.py`: 游戏房间模型，管理房间创建、玩家加入/退出、座位分配
   - `game.py`: 德州扑克游戏逻辑，包括发牌、回合控制、玩家行动处理
   - `player.py`: 玩家模型，管理玩家信息和筹码
   - `card.py` & `deck.py`: 扑克牌和牌组模型

2. **API路由层**
   - `api_routes.py`: 用户认证和账户管理API
   - `room_routes.py`: 房间创建和管理API
   - `bug_routes.py`: 错误报告功能

3. **WebSocket通信**
   - `websocket_manager.py`: 管理WebSocket连接和房间内通信
   - `main.py`: 提供WebSocket端点，处理实时游戏信息交换

4. **数据和工具**
   - `database/`: 数据库模型和操作
   - `utils/`: 通用工具函数
   - `managers/`: 资源管理器（如房间管理器）

#### 关键功能实现

1. **座位管理**:
   - `sit_down`, `stand_up`, `change_seat` 方法处理玩家在游戏桌的位置

2. **游戏控制**:
   - 游戏启动/结束、回合管理
   - 玩家操作（下注、加注、跟注、弃牌等）
   - 三张牌特殊规则：玩家首次行动前需从3张牌中弃掉1张

3. **实时通信**:
   - WebSocket事件处理
   - 游戏状态广播
   - 断线重连机制

### 前端架构 (React.js)

#### 技术栈
- **React.js**: 用户界面构建
- **Axios**: HTTP请求处理
- **WebSocket**: 实时通信
- **React Router**: 页面路由

#### 核心模块

1. **服务层** (`client/src/services/`)
   - `api.js`: 封装与后端RESTful API的交互
   - `websocket.js`: 管理WebSocket连接，处理实时游戏事件
   - `bugReportService.js`: 错误报告提交服务

2. **组件层** (`client/src/components/`)
   - **游戏组件** (`Game/`): 
     - `GameTable.jsx`: 游戏桌面主组件
     - `Player.jsx`: 玩家信息显示
     - `PlayerActions.jsx`: 玩家操作控制
     - `CommunityCards.jsx`: 公共牌显示
     - `DiscardPanel.jsx`: 弃牌选择面板
   - **认证组件** (`Auth/`): 登录、注册功能
   - **房间组件** (`Room/`): 房间列表、创建房间

3. **布局和共享组件**:
   - `Layout/`: 页面布局组件
   - `PlayingCard.jsx`: 扑克牌组件

#### 关键功能实现

1. **游戏界面**:
   - 虚拟扑克桌设计
   - 玩家座位布局
   - 牌的动画展示

2. **交互功能**:
   - 入座、站起、换座位
   - 买入筹码
   - 下注、跟注、加注、弃牌等游戏操作

3. **实时通信**:
   - 监听服务器游戏状态更新
   - 实时反映游戏状态变化
   - 心跳机制维持连接
   - 断线重连策略

## 通信机制

### RESTful API
处理非实时操作，包括：
- 用户认证
- 房间管理
- 账户管理

### WebSocket
提供实时游戏通信，包括：
- 游戏状态更新 (`game_state`)
- 玩家操作广播 (`player_action`)
- 房间更新 (`room_update`)
- 聊天功能 (`chat`)

## 游戏流程

1. **游戏前流程**:
   - 玩家创建/加入房间
   - 入座并买入筹码
   - 等待足够玩家就绪
   - 开始游戏

2. **游戏中流程**:
   - 发送3张手牌给每位玩家
   - 玩家选择弃掉1张牌
   - 小盲/大盲下注
   - 第1轮下注
   - 发放公共牌（翻牌、转牌、河牌）
   - 每轮发牌后进行下注
   - 最终比牌决出胜者
   - 筹码分配

3. **游戏后流程**:
   - 显示游戏结果
   - 准备下一局
   - 玩家可以离开或继续

## 部署指南

项目提供了Docker容器化部署支持，包括：
- `docker-compose.yml`: 定义服务组合
- `Dockerfile.backend`: 后端服务构建
- `Dockerfile.frontend`: 前端服务构建
- `nginx.conf`: Nginx配置

部署脚本:
- `deploy.sh`: 部署脚本
- `prepare_deployment.sh`: 准备部署环境
- `update_frontend_config.sh`: 更新前端配置

---

# C32 Poker Game Project

C32 Poker is a complete online Texas Hold'em poker system with a separated frontend and backend architecture, supporting real-time multiplayer games, room management, user authentication, and more.

## Project Architecture

### Backend Architecture (Python FastAPI)

#### Technology Stack
- **FastAPI**: Building high-performance RESTful APIs and WebSocket services
- **JWT**: User authentication
- **Uvicorn**: ASGI server
- **WebSockets**: Real-time game communication

#### Core Modules

1. **Model Layer** (`src/models/`)
   - `room.py`: Game room model, manages room creation, player joining/leaving, seat allocation
   - `game.py`: Texas Hold'em game logic, including card dealing, round control, player action handling
   - `player.py`: Player model, manages player information and chips
   - `card.py` & `deck.py`: Playing card and deck models

2. **API Route Layer**
   - `api_routes.py`: User authentication and account management APIs
   - `room_routes.py`: Room creation and management APIs
   - `bug_routes.py`: Error reporting functionality

3. **WebSocket Communication**
   - `websocket_manager.py`: Manages WebSocket connections and in-room communication
   - `main.py`: Provides WebSocket endpoints, handles real-time game information exchange

4. **Data and Utilities**
   - `database/`: Database models and operations
   - `utils/`: Common utility functions
   - `managers/`: Resource managers (e.g., room manager)

#### Key Feature Implementation

1. **Seat Management**:
   - `sit_down`, `stand_up`, `change_seat` methods handle player positions at the game table

2. **Game Control**:
   - Game start/end, round management
   - Player actions (bet, raise, call, fold, etc.)
   - Special three-card rule: Players must discard 1 of 3 cards before their first action

3. **Real-time Communication**:
   - WebSocket event handling
   - Game state broadcasting
   - Reconnection mechanism

### Frontend Architecture (React.js)

#### Technology Stack
- **React.js**: User interface building
- **Axios**: HTTP request handling
- **WebSocket**: Real-time communication
- **React Router**: Page routing

#### Core Modules

1. **Service Layer** (`client/src/services/`)
   - `api.js`: Encapsulates interaction with backend RESTful APIs
   - `websocket.js`: Manages WebSocket connections, handles real-time game events
   - `bugReportService.js`: Error report submission service

2. **Component Layer** (`client/src/components/`)
   - **Game Components** (`Game/`): 
     - `GameTable.jsx`: Main game table component
     - `Player.jsx`: Player information display
     - `PlayerActions.jsx`: Player action controls
     - `CommunityCards.jsx`: Community cards display
     - `DiscardPanel.jsx`: Card discard panel
   - **Authentication Components** (`Auth/`): Login, registration functionality
   - **Room Components** (`Room/`): Room list, room creation

3. **Layout and Shared Components**:
   - `Layout/`: Page layout components
   - `PlayingCard.jsx`: Playing card component

#### Key Feature Implementation

1. **Game Interface**:
   - Virtual poker table design
   - Player seat layout
   - Card animation display

2. **Interactive Features**:
   - Sit down, stand up, change seats
   - Buy-in chips
   - Bet, call, raise, fold and other game actions

3. **Real-time Communication**:
   - Listen for server game state updates
   - Real-time reflection of game state changes
   - Heartbeat mechanism to maintain connection
   - Reconnection strategy

## Communication Mechanism

### RESTful API
Handles non-real-time operations, including:
- User authentication
- Room management
- Account management

### WebSocket
Provides real-time game communication, including:
- Game state updates (`game_state`)
- Player action broadcasts (`player_action`)
- Room updates (`room_update`)
- Chat functionality (`chat`)

## Game Flow

1. **Pre-game Flow**:
   - Players create/join rooms
   - Sit down and buy in chips
   - Wait for enough players to be ready
   - Start the game

2. **In-game Flow**:
   - Deal 3 cards to each player
   - Players choose to discard 1 card
   - Small blind/big blind betting
   - First round of betting
   - Deal community cards (flop, turn, river)
   - Betting after each deal
   - Final showdown to determine winner
   - Chip distribution

3. **Post-game Flow**:
   - Display game results
   - Prepare for next hand
   - Players can leave or continue

## Deployment Guide

The project provides Docker containerized deployment support, including:
- `docker-compose.yml`: Defines service composition
- `Dockerfile.backend`: Backend service build
- `Dockerfile.frontend`: Frontend service build
- `nginx.conf`: Nginx configuration

Deployment scripts:
- `deploy.sh`: Deployment script
- `prepare_deployment.sh`: Prepare deployment environment
- `update_frontend_config.sh`: Update frontend configuration 