#!/bin/bash

# 确保日志文件存在并且有正确的权限
touch poker_server.log
chmod 666 poker_server.log
echo "创建了poker_server.log文件并设置了权限"

# 创建一个补丁文件用于修复代码中硬编码的日志路径问题
cat > patch_logs.py << EOF
#!/usr/bin/env python3
import os
import re

# 要修改的文件路径
file_paths = [
    "src/models/game.py",
]

# 搜索并替换硬编码的日志文件路径
for file_path in file_paths:
    if not os.path.exists(file_path):
        print(f"文件 {file_path} 不存在，跳过")
        continue
        
    with open(file_path, 'r') as file:
        content = file.read()
        
    # 替换硬编码的日志路径
    modified_content = re.sub(
        r'logging\.FileHandler\([\'"]poker_server\.log[\'"]\)',
        'logging.FileHandler(os.path.join(os.getcwd(), "logs", "poker_server.log"))',
        content
    )
    
    # 确保导入了os模块
    if 'import os' not in modified_content:
        modified_content = 'import os\n' + modified_content
    
    # 写回文件
    with open(file_path, 'w') as file:
        file.write(modified_content)
        
    print(f"修复了 {file_path} 中的日志路径")

print("日志路径修复完成")
EOF

# 运行补丁脚本
chmod +x patch_logs.py
python3 patch_logs.py

echo "日志准备工作完成" 