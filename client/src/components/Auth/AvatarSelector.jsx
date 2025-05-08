import React, { useState, useEffect } from 'react';
import { Box, Grid, Paper, Typography, styled } from '@mui/material';

// 样式化组件
const AvatarItem = styled(Paper)(({ theme, selected }) => ({
  padding: theme.spacing(1),
  textAlign: 'center',
  cursor: 'pointer',
  border: selected ? `2px solid ${theme.palette.primary.main}` : '2px solid transparent',
  transition: 'all 0.2s ease',
  '&:hover': {
    transform: 'scale(1.05)',
    boxShadow: theme.shadows[3],
  },
  backgroundColor: selected ? theme.palette.primary.light + '20' : theme.palette.background.paper,
}));

const AvatarImage = styled('img')({
  width: '100%',
  height: 'auto',
  borderRadius: '50%',
  objectFit: 'cover',
});

const SelectedAvatarPreview = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  marginTop: theme.spacing(3),
}));

const AvatarSelector = ({ onSelect, initialAvatar = "gg_plankton.webp" }) => {
  const [selectedAvatar, setSelectedAvatar] = useState(initialAvatar);
  const [avatars, setAvatars] = useState([]);

  // 初始化头像列表
  useEffect(() => {
    // 根据文件名模式生成头像列表
    const generateAvatars = () => {
      const avatarList = [];

      // 添加以gg_开头的特殊头像
      const specialAvatars = [
        'gg_plankton.webp', 'gg_fish.webp', 'gg_shrimp.webp', 
        'gg_crab.webp', 'gg_octopus.webp', 'gg_whale.webp', 'gg_shark.webp'
      ];
      specialAvatars.forEach(avatar => avatarList.push(avatar));

      // 添加动物头像
      for (let i = 1; i <= 9; i++) {
        avatarList.push(`animal_${i}.png`);
      }

      // 添加女性头像
      for (let i = 1; i <= 9; i++) {
        avatarList.push(`female_${i}.png`);
      }

      // 添加男性头像
      for (let i = 1; i <= 9; i++) {
        avatarList.push(`male_${i}.png`);
      }

      return avatarList;
    };

    setAvatars(generateAvatars());
  }, []);

  // 处理头像选择
  const handleSelect = (avatar) => {
    setSelectedAvatar(avatar);
    onSelect(avatar);
  };

  return (
    <Box sx={{ mt: 3, mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        选择头像
      </Typography>

      <Grid container spacing={2} sx={{ maxHeight: '300px', overflow: 'auto' }}>
        {avatars.map((avatar) => (
          <Grid item xs={3} sm={2} md={2} key={avatar}>
            <AvatarItem 
              selected={selectedAvatar === avatar} 
              onClick={() => handleSelect(avatar)}
            >
              <AvatarImage
                src={`/assets/images/avatar/${avatar}`}
                alt={`头像 ${avatar}`}
                loading="lazy"
              />
            </AvatarItem>
          </Grid>
        ))}
      </Grid>

      <SelectedAvatarPreview>
        <Typography variant="subtitle1" gutterBottom>
          已选头像
        </Typography>
        <Box 
          component="img"
          src={`/assets/images/avatar/${selectedAvatar}`}
          alt="Selected avatar"
          sx={{ 
            width: 80, 
            height: 80, 
            borderRadius: '50%',
            border: '3px solid',
            borderColor: 'primary.main',
            boxShadow: 3
          }}
        />
      </SelectedAvatarPreview>
    </Box>
  );
};

export default AvatarSelector; 