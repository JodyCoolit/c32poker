from PIL import Image
import os

def slice_image(input_path, output_dir, prefix):
    # 读取图片
    img = Image.open(input_path)
    width, height = img.size
    
    # 图片的实际内容区域（去除四周padding）
    content_top = int(height * 0)
    content_bottom = int(height * 1)
    content_left = int(width * 0)
    content_right = int(width * 1)
    
    content_width = content_right - content_left
    content_height = content_bottom - content_top
    
    # 单元格间的间距（如果有的话）
    cell_spacing_h = int(content_width * 0.02)  # 水平间距，根据实际情况调整
    cell_spacing_v = int(content_height * 0.02) # 垂直间距，根据实际情况调整
    
    # 计算每个小图的实际大小（减去间距）
    effective_width = content_width - (2 * cell_spacing_h)
    effective_height = content_height - (2 * cell_spacing_v)
    
    cell_width = effective_width // 3
    cell_height = effective_height // 3
    
    # 确保输出目录存在
    os.makedirs(output_dir, exist_ok=True)
    
    # 切割图片
    for row in range(3):
        for col in range(3):
            # 计算裁剪坐标，考虑四周padding和单元格间距
            left = content_left + col * (cell_width + cell_spacing_h)
            upper = content_top + row * (cell_height + cell_spacing_v)
            right = left + cell_width
            lower = upper + cell_height
            
            # 裁剪并保存
            cell = img.crop((left, upper, right, lower))
            
            # 如果图像是RGBA模式，转换为RGB再保存为JPEG
            if cell.mode == 'RGBA':
                cell = cell.convert('RGB')
                
            cell_number = row * 3 + col + 1
            output_path = os.path.join(output_dir, f"{prefix}_{cell_number}.png")
            cell.save(output_path)
            print(f"Saved {output_path}")

# 处理三组图片
slice_image("avatar_animal.jpeg", "avatar", "animal")
slice_image("avatar_female.jpeg", "avatar", "female")
slice_image("avatar_male.jpeg", "avatar", "male")