#!/usr/bin/env python3
import os
import re

# 查找数据库路径配置
files_to_check = [
    "src/database/db_manager.py",
]

db_paths = []

for file_path in files_to_check:
    if not os.path.exists(file_path):
        print(f"文件 {file_path} 不存在，跳过")
        continue
    
    with open(file_path, 'r') as file:
        content = file.read()
    
    # 查找可能的数据库路径配置
    path_matches = re.findall(r'[\'"]([^\'"]*/[^\'"]*\.db)[\'"]', content)
    if path_matches:
        print(f"在 {file_path} 中找到可能的数据库路径:")
        for match in path_matches:
            db_paths.append(match)
            print(f"  - {match}")
    
    # 查找初始化方法中的路径
    constructor = re.search(r'def __init__\(.*?\):.*?self\.db_path\s*=\s*[\'"]?([^\'"]+)[\'"]?', content, re.DOTALL)
    if constructor:
        path = constructor.group(1)
        print(f"在构造函数中找到数据库路径: {path}")
        if path not in db_paths:
            db_paths.append(path)

if db_paths:
    print("\n可能的数据库路径:")
    for path in db_paths:
        print(f"  - {path}")
        # 检查相对路径是否存在
        if not path.startswith('/'):
            resolved_path = os.path.abspath(path)
            print(f"    绝对路径: {resolved_path}")
            if os.path.exists(resolved_path):
                print(f"    ✓ 文件存在")
            else:
                print(f"    ✗ 文件不存在")
else:
    print("未找到任何数据库路径配置")

# 尝试修改数据库路径
if db_paths:
    for file_path in files_to_check:
        if not os.path.exists(file_path):
            continue
            
        with open(file_path, 'r') as file:
            content = file.read()
        
        modified = False
        
        # 替换绝对路径为相对路径
        for db_path in db_paths:
            if db_path.startswith('/'):
                new_path = os.path.basename(db_path)
                modified_content = content.replace(db_path, new_path)
                if modified_content != content:
                    content = modified_content
                    modified = True
                    print(f"在 {file_path} 中将 {db_path} 替换为 {new_path}")
        
        if modified:
            with open(file_path, 'w') as file:
                file.write(content)
            print(f"已更新 {file_path}")

print("\n检查完成") 