import sqlite3
import os
from pathlib import Path

def upgrade_database():
    """升级数据库结构，添加新字段"""
    # 使用环境变量或默认为当前目录中的poker.db
    db_path_env = os.getenv("DB_PATH", "poker.db")
    db_path = Path(db_path_env)
    
    # 检查数据库是否存在
    if not db_path.exists():
        print(f"数据库文件 {db_path} 不存在，请先运行主程序创建数据库。")
        return False
    
    try:
        conn = sqlite3.connect(db_path)
        c = conn.cursor()
        
        # 获取users表的字段信息
        c.execute("PRAGMA table_info(users)")
        columns = c.fetchall()
        column_names = [column[1] for column in columns]
        
        # 检查并添加email字段
        if "email" not in column_names:
            print("添加 email 字段到 users 表...")
            c.execute("ALTER TABLE users ADD COLUMN email TEXT")
        else:
            print("email 字段已存在。")
            
        # 检查并添加avatar字段
        if "avatar" not in column_names:
            print("添加 avatar 字段到 users 表...")
            c.execute("ALTER TABLE users ADD COLUMN avatar TEXT")
        else:
            print("avatar 字段已存在。")
            
        # 提交更改
        conn.commit()
        print("数据库升级完成。")
        
        return True
    except Exception as e:
        print(f"升级数据库时出错: {str(e)}")
        return False
    finally:
        conn.close()

if __name__ == "__main__":
    print("开始升级数据库...")
    success = upgrade_database()
    if success:
        print("数据库结构已成功更新。")
    else:
        print("数据库升级失败。") 