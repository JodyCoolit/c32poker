from fastapi import APIRouter, HTTPException, Depends, Query, Header, Body
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from src.database.db_manager import DBManager
from src.api_routes import get_current_user
import base64
import json
import time
from datetime import datetime
import os
from pathlib import Path

# 创建Bug报告相关的路由器
bug_router = APIRouter(
    prefix="/bug-reports",
    tags=["Bug报告"]
)

db = DBManager()

# 创建保存图片的目录
# 使用环境变量或默认为当前目录中的bug_report_images
IMAGES_DIR_ENV = os.getenv("BUG_IMAGES_DIR", "bug_report_images")
IMAGES_DIR = Path(IMAGES_DIR_ENV)
IMAGES_DIR.mkdir(parents=True, exist_ok=True)

class BugReportImage(BaseModel):
    data: str  # base64编码的图片数据
    name: str
    type: str

class SystemInfo(BaseModel):
    userAgent: Optional[str] = None
    screenSize: Optional[str] = None
    currentUrl: Optional[str] = None
    timestamp: Optional[str] = None
    browser: Optional[str] = None
    clientTime: Optional[str] = None

class BugReportCreate(BaseModel):
    description: str
    contact: Optional[str] = None
    images: Optional[List[BugReportImage]] = None
    systemInfo: Optional[SystemInfo] = None

class BugReportUpdateStatus(BaseModel):
    status: str  # pending, in_progress, resolved, rejected

# 保存图片到文件系统
def save_image(image_data: str, image_name: str) -> str:
    try:
        # 去除base64前缀
        if "," in image_data:
            image_data = image_data.split(",")[1]
            
        # 解码base64
        decoded_image = base64.b64decode(image_data)
        
        # 生成唯一文件名
        timestamp = int(time.time())
        filename = f"{timestamp}_{image_name}"
        file_path = IMAGES_DIR / filename
        
        # 保存图片
        with open(file_path, "wb") as f:
            f.write(decoded_image)
            
        return str(file_path)
    except Exception as e:
        print(f"保存图片失败: {str(e)}")
        return None

@bug_router.post("/", summary="提交Bug报告")
async def submit_bug_report(
    report: BugReportCreate = Body(...),
    current_user: str = Depends(get_current_user)
):
    # 保存图片到文件系统
    saved_images = []
    if report.images:
        for img in report.images:
            file_path = save_image(img.data, img.name)
            if file_path:
                saved_images.append({
                    "name": img.name,
                    "type": img.type,
                    "path": file_path,
                    "original_length": len(img.data) if img.data else 0
                })
    
    # 提交Bug报告
    success, result = db.submit_bug_report(
        user_id=current_user,
        description=report.description,
        contact=report.contact,
        system_info=report.systemInfo.dict() if report.systemInfo else None,
        images=saved_images
    )
    
    if not success:
        raise HTTPException(status_code=400, detail=result)
    
    return {"message": "Bug报告提交成功", "report_id": result}

@bug_router.get("/", summary="获取Bug报告列表")
async def get_bug_reports(
    limit: int = Query(10, description="每页记录数"),
    offset: int = Query(0, description="偏移量"),
    status: Optional[str] = Query(None, description="Bug状态筛选"),
    current_user: str = Depends(get_current_user)
):
    # 检查权限：只有管理员可以查看所有Bug报告
    if current_user != "admin":
        raise HTTPException(status_code=403, detail="无权查看所有Bug报告")
    
    reports = db.get_bug_reports(limit=limit, offset=offset, status=status)
    return {"reports": reports, "total": len(reports)}

@bug_router.get("/{report_id}", summary="获取Bug报告详情")
async def get_bug_report(
    report_id: int,
    current_user: str = Depends(get_current_user)
):
    report = db.get_bug_report_by_id(report_id)
    
    if not report:
        raise HTTPException(status_code=404, detail="Bug报告不存在")
    
    # 检查权限：只有Bug提交者或管理员可以查看详情
    if current_user != report["user_id"] and current_user != "admin":
        raise HTTPException(status_code=403, detail="无权查看此Bug报告")
    
    return report

@bug_router.put("/{report_id}/status", summary="更新Bug报告状态")
async def update_bug_report_status(
    report_id: int,
    status_update: BugReportUpdateStatus,
    current_user: str = Depends(get_current_user)
):
    # 检查权限：只有管理员可以更新Bug状态
    if current_user != "admin":
        raise HTTPException(status_code=403, detail="无权更新Bug报告状态")
    
    # 检查状态值是否有效
    valid_statuses = ["pending", "in_progress", "resolved", "rejected"]
    if status_update.status not in valid_statuses:
        raise HTTPException(
            status_code=400, 
            detail=f"无效的状态值，有效值为: {', '.join(valid_statuses)}"
        )
    
    success, message = db.update_bug_report_status(report_id, status_update.status)
    
    if not success:
        raise HTTPException(status_code=400, detail=message)
    
    return {"message": "Bug报告状态更新成功"}

@bug_router.get("/user/{username}", summary="获取用户提交的Bug报告")
async def get_user_bug_reports(
    username: str,
    limit: int = Query(10, description="每页记录数"),
    offset: int = Query(0, description="偏移量"),
    current_user: str = Depends(get_current_user)
):
    # 检查权限：只能查看自己的Bug报告或管理员可以查看所有人的
    if current_user != username and current_user != "admin":
        raise HTTPException(status_code=403, detail="无权查看其他用户的Bug报告")
    
    # 获取用户的Bug报告
    reports = db.get_bug_reports(limit=limit, offset=offset)
    user_reports = [r for r in reports if r["user_id"] == username]
    
    return {"reports": user_reports, "total": len(user_reports)} 