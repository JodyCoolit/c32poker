from fastapi import APIRouter, HTTPException, Depends, Query, Header
from pydantic import BaseModel
from src.database.db_manager import DBManager
from typing import Optional, List, Dict, Any
import jwt
import time
from datetime import datetime, timedelta

# JWT密钥和算法
SECRET_KEY = "c32poker_secret_key"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 365 * 10  # 10年

# 创建认证相关的路由器
auth_router = APIRouter(
    prefix="/auth",
    tags=["认证"]
)

# 创建用户相关的路由器
user_router = APIRouter(
    prefix="/users",
    tags=["用户"]
)

# 创建统计相关的路由器
stats_router = APIRouter(
    prefix="/statistics",
    tags=["统计"]
)

# 创建排行榜相关的路由器
leaderboard_router = APIRouter(
    prefix="/leaderboards",
    tags=["排行榜"]
)

# 创建游戏记录相关的路由器
records_router = APIRouter(
    prefix="/records",
    tags=["游戏记录"]
)

db = DBManager()

class UserCredentials(BaseModel):
    username: str
    password: str

class RefreshToken(BaseModel):
    username: str

class UserUpdate(BaseModel):
    username: str
    current_password: str
    new_password: Optional[str] = None
    email: Optional[str] = None
    avatar: Optional[str] = None

class PasswordReset(BaseModel):
    username: str
    current_password: str
    new_password: str

class BalanceUpdate(BaseModel):
    username: str
    password: str
    amount: int

class Token(BaseModel):
    access_token: str
    token_type: str

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(authorization: Optional[str] = Header(None)):
    if not authorization:
        raise HTTPException(
            status_code=401,
            detail="未提供认证令牌",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    try:
        token_type, token = authorization.split()
        if token_type.lower() != "bearer":
            raise HTTPException(
                status_code=401,
                detail="无效的认证类型",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(
                status_code=401,
                detail="无效的认证令牌",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return username
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=401,
            detail="无效的认证令牌",
            headers={"WWW-Authenticate": "Bearer"},
        )

# 认证相关路由
@auth_router.post("/login", summary="用户登录", response_model=Token)
async def login(user: UserCredentials):
    success, message = db.verify_user(user.username, user.password)
    if not success:
        raise HTTPException(status_code=401, detail=message)
    
    # 生成访问令牌
    access_token = create_access_token(
        data={"sub": user.username}
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer"
    }

@auth_router.post("/register", summary="用户注册")
async def register(user: UserCredentials):
    success, message = db.register_user(user.username, user.password)
    if not success:
        raise HTTPException(status_code=400, detail=message)
    return {"message": message}

@auth_router.post("/refresh-token", summary="刷新认证令牌", response_model=Token)
async def refresh_token(user_data: RefreshToken, current_user: str = Depends(get_current_user)):
    # 验证请求中的用户名与当前认证的用户名是否一致
    if current_user != user_data.username:
        raise HTTPException(status_code=403, detail="无权刷新其他用户的令牌")
    
    # 生成新的访问令牌，延长过期时间
    access_token = create_access_token(
        data={"sub": current_user}
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer"
    }

# 用户相关路由
@user_router.get("/{username}", summary="获取用户信息")
async def get_user_info(username: str, current_user: str = Depends(get_current_user)):
    # 权限检查: 只能查询自己的信息或系统管理员
    if current_user != username and current_user != "admin":
        print('获取用户信息 raise', current_user, username)
        raise HTTPException(status_code=403, detail="没有权限查询其他用户信息")
        
    user_info = db.get_user_info(username)
    if not user_info:
        print('用户不存在 raise', username)
        raise HTTPException(status_code=404, detail="用户不存在")
    return user_info

@user_router.put("/{username}", summary="更新用户信息")
async def update_user_info(username: str, user_data: UserUpdate, current_user: str = Depends(get_current_user)):
    # 权限检查: 只能更新自己的信息
    if current_user != username:
        raise HTTPException(status_code=403, detail="无权更新其他用户信息")
    
    # 验证当前密码
    success, _ = db.verify_user(username, user_data.current_password)
    if not success:
        raise HTTPException(status_code=401, detail="密码验证失败")
    
    # 更新用户信息
    update_data = {
        "password": user_data.new_password,
        "email": user_data.email,
        "avatar": user_data.avatar
    }
    # 过滤掉为None的字段
    update_data = {k: v for k, v in update_data.items() if v is not None}
    
    success, message = db.update_user(username, update_data)
    if not success:
        raise HTTPException(status_code=400, detail=message)
    
    return {"message": "用户信息更新成功"}

@user_router.post("/{username}/balance", summary="用户充值")
async def update_user_balance(username: str, balance_data: BalanceUpdate, current_user: str = Depends(get_current_user)):
    # 权限检查: 只能充值自己的账户
    if current_user != username:
        raise HTTPException(status_code=403, detail="无权更新其他用户余额")
    
    # 验证密码
    success, _ = db.verify_user(username, balance_data.password)
    if not success:
        raise HTTPException(status_code=401, detail="密码验证失败")
    
    # 充值金额必须为正数
    if balance_data.amount <= 0:
        raise HTTPException(status_code=400, detail="充值金额必须大于0")
    
    # 获取用户当前余额
    user_info = db.get_user_info(username)
    if not user_info:
        raise HTTPException(status_code=404, detail="用户不存在")
    
    # 更新用户余额
    current_balance = user_info.get("balance", 0)
    new_balance = current_balance + balance_data.amount
    
    success, message = db.update_user(username, {"balance": new_balance})
    if not success:
        raise HTTPException(status_code=400, detail=message)
    
    return {
        "message": "充值成功",
        "username": username,
        "previous_balance": current_balance,
        "deposit_amount": balance_data.amount,
        "new_balance": new_balance
    }

@user_router.post("/reset-password", summary="重置密码")
async def reset_password(reset_data: PasswordReset, current_user: str = Depends(get_current_user)):
    # 权限检查: 只能修改自己的密码
    if current_user != reset_data.username:
        raise HTTPException(status_code=403, detail="无权修改其他用户密码")
        
    # 验证当前密码
    success, _ = db.verify_user(reset_data.username, reset_data.current_password)
    if not success:
        raise HTTPException(status_code=401, detail="密码验证失败")
    
    # 更新密码
    success, message = db.update_user(
        reset_data.username, 
        {"password": reset_data.new_password}
    )
    if not success:
        raise HTTPException(status_code=400, detail=message)
    
    return {"message": "密码重置成功"}

@user_router.get("/{username}/statistics", summary="获取用户统计信息")
async def get_user_statistics(username: str, current_user: str = Depends(get_current_user)):
    # 权限检查: 只能查询自己的信息或系统管理员
    if current_user != username and current_user != "admin":
        raise HTTPException(status_code=403, detail="没有权限查询其他用户统计信息")
        
    # 检查用户是否存在
    user_info = db.get_user_info(username)
    if not user_info:
        raise HTTPException(status_code=404, detail="用户不存在")
        
    stats = db.get_user_statistics(username)
    return {
        "username": username,
        "statistics": stats
    }

@user_router.get("/{username}/game-records", summary="获取用户游戏历史记录")
async def get_user_game_records(
    username: str,
    limit: int = Query(10, description="每页记录数"),
    offset: int = Query(0, description="偏移量"),
    current_user: str = Depends(get_current_user)
):
    # 权限检查: 只能查询自己的信息或系统管理员
    if current_user != username and current_user != "admin":
        raise HTTPException(status_code=403, detail="没有权限查询其他用户游戏记录")
        
    # 检查用户是否存在
    user_info = db.get_user_info(username)
    if not user_info:
        raise HTTPException(status_code=404, detail="用户不存在")
        
    records = db.get_user_game_records(username, limit, offset)
    total = db.count_user_game_records(username)
    
    return {
        "username": username,
        "records": records,
        "total": total,
        "limit": limit,
        "offset": offset
    }

# 游戏记录相关路由
@records_router.get("/", summary="获取所有游戏历史记录")
async def get_all_game_records(
    limit: int = Query(10, description="每页记录数"),
    offset: int = Query(0, description="偏移量"),
    current_user: str = Depends(get_current_user)
):
    # 这里不做权限检查，因为游戏记录是公开的
    records = db.get_game_records(limit, offset)
    total = db.count_game_records()
    return {
        "records": records,
        "total": total,
        "limit": limit,
        "offset": offset
    }

# 排行榜相关路由
@leaderboard_router.get("/win-rate", summary="获取胜率排行榜")
async def get_win_rate_leaderboard(
    limit: int = Query(10, description="排行榜长度"),
    current_user: str = Depends(get_current_user)
):
    # 这里不做权限检查，因为排行榜是公开的
    leaderboard = db.get_win_rate_leaderboard(limit)
    return {
        "leaderboard": leaderboard,
        "limit": limit
    }

@leaderboard_router.get("/profit", summary="获取盈利排行榜")
async def get_profit_leaderboard(
    limit: int = Query(10, description="排行榜长度"),
    current_user: str = Depends(get_current_user)
):
    # 这里不做权限检查，因为排行榜是公开的
    leaderboard = db.get_profit_leaderboard(limit)
    return {
        "leaderboard": leaderboard,
        "limit": limit
    }

# 统计相关路由
@stats_router.get("/platform", summary="获取平台统计信息")
async def get_platform_statistics(current_user: str = Depends(get_current_user)):
    # 这里不做权限检查，因为平台统计信息是公开的
    stats = db.get_platform_statistics()
    return stats

# 导出所有路由器
routers = [auth_router, user_router, stats_router, leaderboard_router, records_router]
# 确保导出 router (为了兼容性)
__all__ = ['routers']