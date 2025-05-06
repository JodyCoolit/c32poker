import base64
import json
from fastapi import APIRouter, HTTPException, Depends, Request, Body
from pydantic import BaseModel
from typing import List, Dict, Optional, Any
import uuid
from src.database.db_manager import DBManager
from src.managers.room_manager import get_instance
from datetime import datetime

# 创建路由器实例
router = APIRouter(
    tags=["rooms"]
)

# 获取数据库实例
db = DBManager()

# 由 main.py 注入的 room_manager 实例
room_manager = get_instance()  # 默认值，将在 main.py 中被覆盖

# 定义数据模型
class RoomCreate(BaseModel):
    """创建房间请求模型"""
    name: str
    small_blind: float = 0.5
    big_blind: float = 1.0
    buy_in_min: float = 100
    buy_in_max: float = 1000
    game_duration_hours: float = 1.0
    max_players: int = 8
    creator: Optional[str] = None  # 添加可选的创建者字段

class RoomJoin(BaseModel):
    room_id: str
    username: str

class RoomResponse(BaseModel):
    id: str
    name: str
    max_players: int
    small_blind: float
    big_blind: float
    buy_in_min: int
    buy_in_max: int
    players: List[Dict[str, Any]]  # 修改为字典列表，支持复杂的玩家信息
    current_players: int
    game_duration_hours: float = 1.0
    created_at: Optional[datetime] = None  # 添加创建时间字段
    is_game_started: bool = False  # 添加游戏状态字段
    status: str = "waiting"  # 添加房间状态字段
    remaining_time: int = 0  # 添加剩余时间字段

# API 路由
@router.post("/rooms", response_model=RoomResponse, summary="创建新房间")
async def create_room(room_data: RoomCreate, request: Request):
    try:
        print(f"\n===== 创建房间请求开始（room_routes.py） =====")
        print(f"请求数据: {room_data}")
        
        print(f"房间参数: name={room_data.name}, max_players={room_data.max_players}, small_blind={room_data.small_blind}, big_blind={room_data.big_blind}")
        print(f"游戏时长: {room_data.game_duration_hours} 小时")
        print(f"房间管理器实例ID: {id(room_manager)}")
        
        # 获取当前用户名 - 直接使用请求体中的creator字段
        if not room_data.creator:
            raise HTTPException(status_code=400, detail="未提供creator字段，无法确定房主")
            
        username = room_data.creator
        print(f"使用creator字段作为房主: {username}")
            
        print(f"最终确定的房主: {username}")
        
        # 创建房间，让room_manager生成room_id
        room = room_manager.create_room(
            name=room_data.name,
            host_username=username,  # 使用实际用户名而不是硬编码
            max_players=room_data.max_players,
            small_blind=room_data.small_blind,
            big_blind=room_data.big_blind,
            buy_in_min=room_data.buy_in_min,
            buy_in_max=room_data.buy_in_max,
            game_duration_hours=room_data.game_duration_hours
        )
        
        print(f"房间创建成功, 房间ID: {room.room_id}")
        
        response_data = {
            "id": room.room_id,
            "name": room.name,
            "max_players": room.max_players,
            "small_blind": room.small_blind,
            "big_blind": room.big_blind,
            "buy_in_min": room.buy_in_min,
            "buy_in_max": room.buy_in_max,
            "players": [],  # 空列表，符合List[Dict[str, Any]]类型
            "current_players": 0,
            "game_duration_hours": room.game_duration_hours
        }
        
        print(f"创建房间成功: {response_data}")
        print(f"===== 创建房间请求结束（成功） =====\n")
        return response_data
    except Exception as e:
        print(f"===== 创建房间请求异常 =====")
        print(f"错误类型: {type(e).__name__}")
        print(f"错误信息: {str(e)}")
        import traceback
        traceback.print_exc()
        print(f"===== 创建房间请求结束（失败） =====\n")
        raise

@router.get("/rooms", response_model=List[RoomResponse], summary="获取所有房间")
async def get_all_rooms():
    rooms = room_manager.get_all_rooms()
    result = []
    
    for room_id, room in rooms.items():
        # 获取玩家完整信息，包括座位号
        players_info = []
        for username, player in room.players.items():
            player_info = {
                "name": username,
                "chips": player.chips,
            }
            # 添加座位信息
            if hasattr(player, 'seat') and player.seat is not None:
                player_info["position"] = player.seat
            
            players_info.append(player_info)
        
        result.append({
            "id": room_id,
            "name": room.name,
            "max_players": room.max_players,
            "small_blind": room.small_blind,
            "big_blind": room.big_blind,
            "buy_in_min": room.buy_in_min,
            "buy_in_max": room.buy_in_max,
            "players": players_info,  # 使用完整的玩家信息
            "current_players": len(room.players),
            "game_duration_hours": room.game_duration_hours,
            "created_at": room.created_at.isoformat() if room.created_at else None,  # 确保created_at是ISO格式字符串
            "is_game_started": room.is_game_started,  # 使用Room类的is_game_started属性
            "status": room.status,  # 添加房间状态
            "remaining_time": room.remaining_time
        })
        
    return result

@router.get("/rooms/{room_id}", response_model=RoomResponse, summary="获取房间详情")
async def get_room(room_id: str):
    room = room_manager.get_room(room_id)
    if not room:
        raise HTTPException(status_code=404, detail="房间不存在")
    
    # 获取玩家完整信息，包括座位号
    players_info = []
    for username, player in room.players.items():
        player_info = {
            "name": username,
            "chips": player.chips,
        }
        # 添加座位信息
        if hasattr(player, 'seat') and player.seat is not None:
            player_info["position"] = player.seat
        
        players_info.append(player_info)
    
    return {
        "id": room_id,
        "name": room.name,
        "max_players": room.max_players,
        "small_blind": room.small_blind,
        "big_blind": room.big_blind,
        "buy_in_min": room.buy_in_min,
        "buy_in_max": room.buy_in_max,
        "players": players_info,  # 使用完整的玩家信息
        "current_players": len(room.players),
        "game_duration_hours": room.game_duration_hours
    }

@router.post("/rooms/join", summary="加入房间")
async def join_room(join_data: RoomJoin):
    print(f"\n===== 加入房间请求开始 =====")
    print(f"请求数据: {join_data}")
    
    # 检查参数完整性
    if not join_data.room_id:
        print(f"错误: 房间ID为空")
        raise HTTPException(status_code=400, detail="房间ID不能为空")
    
    if not join_data.username:
        print(f"错误: 用户名为空")
        raise HTTPException(status_code=400, detail="用户名不能为空")
    
    # 查找房间
    room = room_manager.get_room(join_data.room_id)
    if not room:
        print(f"错误: 找不到房间 {join_data.room_id}")
        print(f"当前所有房间: {list(room_manager.get_all_rooms().keys())}")
        raise HTTPException(status_code=404, detail="房间不存在")
    
    print(f"成功找到房间: {room.room_id}, 名称: {room.name}")
    
    # 检查房间是否已满
    if len(room.players) >= room.max_players:
        print(f"错误: 房间已满 ({len(room.players)}/{room.max_players})")
        raise HTTPException(status_code=400, detail="房间已满")
    
    # 检查用户是否已在房间中
    if join_data.username in room.players:
        print(f"信息: 用户 {join_data.username} 已在房间中")
        
        # 更新游戏中的online状态
        if room.game:
            # 设置玩家在线状态为true
            room.player_online_status(join_data.username, True)
            print(f"已将玩家 {join_data.username} 的在线状态设置为True")
            
        return {"message": "已在房间中", "status": "already_joined"}
    
    # 添加玩家到房间
    print(f"尝试将用户 {join_data.username} 添加到房间 {room.room_id}")
    success = room_manager.add_player_to_room(
        room_id=join_data.room_id,
        username=join_data.username,
    )
    
    if not success:
        print(f"错误: 无法将用户 {join_data.username} 添加到房间 {room.room_id}")
        raise HTTPException(status_code=400, detail="无法加入房间")
    
    print(f"成功: 用户 {join_data.username} 已加入房间 {room.room_id}")
    print(f"注意: 玩家加入房间时没有座位分配，需要手动选择座位")
    print(f"当前房间玩家: {list(room.players.keys())}")
    print(f"===== 加入房间请求结束 =====\n")
    
    return {"message": "成功加入房间，请选择座位入座", "status": "success"}

@router.post("/rooms/{room_id}/leave", summary="离开房间")
async def leave_room(
    room_id: str,
    data: dict = Body(...),
):
    username = data.get("username")
    if not username:
        raise HTTPException(status_code=400, detail="必须提供用户名")
        
    room = room_manager.get_room(room_id)
    if not room:
        raise HTTPException(status_code=404, detail="房间不存在")
        
    player_chips = 0
    if username in room.players:
        player_chips = room.players[username].chips
    
    # 检查游戏是否进行中，并处理游戏状态
    if room.game and username in room.players:
        # 找到玩家在game.players中的索引
        player_index = -1
        for i, player in enumerate(room.game.players):
            if player.get("name") == username:
                player_index = i
                break
        
        # 如果玩家正在游戏中
        if player_index >= 0 and player_index in room.game.active_players:
            # 如果是当前玩家的回合，自动弃牌
            if player_index == room.game.current_player_idx:
                # 如果需要弃牌（Pineapple规则）
                if len(room.game.players[player_index].get("hand", [])) == 3 and not room.game.players[player_index].get("has_discarded", False):
                    # 随机选择一张牌弃掉
                    discard_index = 0
                    # 确保设置当前玩家索引并调用handle_action
                    room.game.current_player_idx = player_index
                    room.game.handle_action("discard", discard_index)
                
                # 然后弃牌离开
                room.game.current_player_idx = player_index
                room.game.handle_action("fold")
            else:
                # 不是当前回合，标记为弃牌
                if player_index in room.game.active_players:
                    room.game.active_players.remove(player_index)
                    
                    # 如果只剩一个玩家，结束当前手牌
                    if len(room.game.active_players) == 1:
                        room.game.finish_hand()
    
    # 从房间移除玩家
    success = room_manager.remove_player_from_room(room_id, username)
    
    if not success:
        raise HTTPException(status_code=400, detail="无法离开房间")
        
    # 如果房主离开，转移房主权限
    if room.owner == username and room.players:
        # 选择第一个玩家作为新房主
        room.owner = next(iter(room.players))
        
    # 记录离开和盈亏
    buy_in = 0  # 这里应该从数据库查询之前的买入金额，简化为0
    db.record_game(room_id, username, buy_in, player_chips)
    
    # 如果房间中没有玩家了，删除房间
    if not room.players:
        room_manager.remove_room(room_id)
    
    return {"message": "成功离开房间", "cash_out": player_chips}

# 确保导出路由器
__all__ = ['router'] 