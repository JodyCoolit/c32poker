"""
这是一个服务器补丁文件，说明如何修改服务器端的room_routes.py以移除buy_in字段要求
需要进行以下更改：

1. 修改RoomJoin模型移除buy_in字段
2. 修改join_room函数中关于buy_in的处理
"""

# 1. 修改RoomJoin模型
"""
原始代码:
class RoomJoin(BaseModel):
    room_id: str
    username: str
    buy_in: int

修改为:
class RoomJoin(BaseModel):
    room_id: str
    username: str
    buy_in: Optional[int] = None  # 使其成为可选字段，默认为None
"""

# 2. 修改join_room函数中关于buy_in的处理
"""
原始代码:
@router.post("/rooms/join", summary="加入房间")
async def join_room(join_data: RoomJoin):
    room = room_manager.get_room(join_data.room_id)
    if not room:
        raise HTTPException(status_code=404, detail="房间不存在")
        
    if len(room.players) >= room.max_players:
        raise HTTPException(status_code=400, detail="房间已满")
    
    success = room_manager.add_player_to_room(
        room_id=join_data.room_id,
        username=join_data.username,
    )
    
    if not success:
        raise HTTPException(status_code=400, detail="无法加入房间")
        
    # 记录买入
    db.record_game(join_data.room_id, join_data.username, join_data.buy_in, 0)
    
    return {"message": "成功加入房间"}

修改为:
@router.post("/rooms/join", summary="加入房间")
async def join_room(join_data: RoomJoin):
    room = room_manager.get_room(join_data.room_id)
    if not room:
        raise HTTPException(status_code=404, detail="房间不存在")
        
    if len(room.players) >= room.max_players:
        raise HTTPException(status_code=400, detail="房间已满")
    
    success = room_manager.add_player_to_room(
        room_id=join_data.room_id,
        username=join_data.username,
    )
    
    if not success:
        raise HTTPException(status_code=400, detail="无法加入房间")
        
    # 记录买入 - 使用默认买入金额或来自请求的买入金额
    buy_in_amount = join_data.buy_in if join_data.buy_in is not None else 1000  # 默认买入金额
    db.record_game(join_data.room_id, join_data.username, buy_in_amount, 0)
    
    return {"message": "成功加入房间"}
""" 