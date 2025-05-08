import React from 'react';
import { Box, Paper, Typography, Badge, Avatar } from '@mui/material';
import PlayingCard from './PlayingCard';
import DealerButton from './DealerButton';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents'; // 导入奖杯图标
import StarIcon from '@mui/icons-material/Star'; // 导入备用星星图标

/**
 * Player component for displaying player information at the poker table
 * @param {Object} props Component props
 * @param {Object} props.player Player data
 * @param {boolean} props.isCurrentPlayer Whether this is the current user
 * @param {boolean} props.isDealer Whether this player is the dealer
 * @param {boolean} props.isActive Whether this player is the active player
 * @param {boolean} props.showCards Whether to show this player's cards
 * @param {number} props.turnTimeRemaining Remaining time for the current turn
 * @param {number} props.turnTimeLimit Maximum time allowed for the current turn
 * @param {boolean} props.hasHand Whether this player has a hand
 */
const Player = ({ 
    player, 
    isCurrentPlayer = false,
    isDealer = false,
    isActive = false,
    showCards = false,
    turnTimeRemaining = 30,
    turnTimeLimit = 30,
    hasHand = false,
    gameState
}) => {
    if (!player) return null;
    // Use hasDiscarded property if provided, otherwise default to false
    const hasDiscarded = player.hasDiscarded || false;
    const discardedCard = player.discardedCard || null;
    
    // 检查游戏是否暂停
    const isPaused = gameState?.status === 'paused';
    
    // 检查玩家是否是获胜者
    const isWinner = player.is_winner || false;
    
    // 在暂停状态下不显示思考进度条
    const shouldShowTimer = isActive && !isPaused && turnTimeRemaining > 0;
    
    // Random color from a predefined set for player avatars
    const getPlayerColor = () => {
        const colors = ['#F44336', '#2196F3', '#4CAF50', '#FFC107', '#9C27B0', '#FF9800', '#795548', '#607D8B'];
        const nameHash = player.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        return colors[nameHash % colors.length];
    };
    
    // Render player's hand
    const renderHand = () => {
        // 如果是当前玩家，不显示手牌，因为已经在别处显示了
        if (isCurrentPlayer) {
            return null;
        }
        
        // 检查玩家是否有手牌数据
        if (player.hand && player.hand.length > 0) {
            // 有手牌数据，按正常逻辑显示
            const shouldShowCards = showCards;
        
        return (
            <Box sx={{ 
                display: 'flex', 
                gap: 0.5, 
                justifyContent: 'center',
                mt: 1,
                position: 'relative',
                transform: 'translateY(10px)', // 向下移动，不遮挡头像和筹码
                zIndex: 5
            }}>
                    {player.hand.map((card, index) => {
                        // 统一卡片格式，支持多种可能的数据结构
                        const cardValue = typeof card === 'string' ? card : 
                                         card.display ? card.display : 
                                         card.value && card.suit ? `${card.value}${card.suit.charAt(0)}` : 
                                         '';
                        
                        return (
                    <Box key={index} sx={{ 
                        position: 'relative',
                        transform: `rotate(${index === 0 ? '-5deg' : '5deg'})`,
                        zIndex: index + 1
                    }}>
                        <PlayingCard 
                                    card={cardValue || ''} 
                                    faceUp={shouldShowCards}
                                    selected={false}
                                    onClick={() => {}}
                                />
                            </Box>
                        );
                    })}
                    
                    {/* Show discarded card if player has discarded */}
                    {hasDiscarded && discardedCard && (
                        <Box sx={{ 
                            position: 'absolute', 
                            top: -40, 
                            right: -20,
                            transform: 'rotate(15deg)'
                        }}>
                            <PlayingCard 
                                card={typeof discardedCard === 'string' ? discardedCard : 
                                    (discardedCard.display || discardedCard.value || discardedCard)} 
                                faceUp={true}
                                selected={false}
                            />
                        </Box>
                    )}
                </Box>
            );
        } else if (gameState && gameState.status === 'playing') {
            // 玩家未弃牌且游戏进行中，显示卡背
            const cardCount = 2; // 默认两张
            
            return (
                <Box sx={{ 
                    display: 'flex', 
                    gap: 0.5, 
                    justifyContent: 'center',
                    mt: 1,
                    position: 'relative',
                    transform: 'translateY(10px)',
                    zIndex: 5,
                    opacity: player.folded ? 0.3 : 1,
                    transition: 'opacity 0.8s ease-out, transform 0.8s ease-out',
                    transform: player.folded ? 'translateY(20px)' : 'translateY(10px)',
                }}>
                    {/* 显示卡背 */}
                    {Array.from({ length: cardCount }).map((_, index) => (
                        <Box key={index} sx={{ 
                            position: 'relative',
                            transform: `rotate(${index === 0 ? '-5deg' : '5deg'})`,
                            zIndex: index + 1
                        }}>
                            <PlayingCard 
                                card="" 
                                faceUp={false}
                                selected={false}
                            />
                        </Box>
                    ))}
                    
                {/* Show discarded card if player has discarded */}
                {hasDiscarded && discardedCard && (
                    <Box sx={{ 
                        position: 'absolute', 
                        top: -40, 
                        right: -20,
                        transform: 'rotate(15deg)'
                    }}>
                        <PlayingCard 
                                card={typeof discardedCard === 'string' ? discardedCard : 
                                    (discardedCard.display || discardedCard.value || discardedCard)} 
                                faceUp={true}
                                selected={false}
                        />
                    </Box>
                )}
            </Box>
        );
        }
        
        // 没有手牌，返回null
        return null;
    };

    return (
        <Box sx={{ 
            position: 'relative', 
            width: 'fit-content'
        }}>
            {/* Position number indicator */}
            <Box sx={{ 
                position: 'absolute',
                top: -5,
                left: -5,
                width: 24,
                height: 24,
                borderRadius: '50%',
                backgroundColor: getPlayerColor(),
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                fontSize: '0.75rem',
                border: '2px solid #000',
                zIndex: 12,
                boxShadow: '0 2px 4px rgba(0,0,0,0.5)'
            }}>
                {player.position !== undefined ? player.position : '?'}
            </Box>
            
            {/* Player status indicators - 只保留庄家按钮 */}
            <Box sx={{ 
                position: 'absolute',
                top: player.position === 0 ? -40 : -32, // 顶部位置的玩家位置更高
                left: 0,
                width: '100%',
                display: 'flex',
                justifyContent: 'center',
                gap: 0.5,
                zIndex: 100,
                visibility: 'visible',
                pointerEvents: 'none'
            }}>
                {isDealer && (
                    <DealerButton 
                        width={player.position === 0 ? 28 : 24} // 顶部位置的庄家图标更大
                        height={player.position === 0 ? 28 : 24}
                        style={{ 
                            position: 'absolute',
                            top: player.position === 0 ? -10 : -6, // 顶部位置调整
                            left: player.position === 0 ? -20 : -16,
                            transform: 'none',
                            zIndex: 101,
                            boxShadow: '0 0 10px rgba(255,215,0,0.8)',
                            visibility: 'visible',
                            pointerEvents: 'auto'
                        }} 
                    />
                )}
                
                {/* 思考时间进度条 - 在玩家为当前行动玩家时显示 */}
                {shouldShowTimer && (
                    <>
                        {/* 添加调试信息，帮助调试进度条 */}
                        <Box sx={{
                            height: player.position === 0 ? 6 : 4, // 顶部位置的进度条更高
                            width: '110%',
                            backgroundColor: 'rgba(0, 0, 0, 0.7)',
                            borderRadius: 4,
                            position: 'absolute',
                            top: player.position === 0 ? -35 : -26, // 顶部位置调整
                            left: '50%',
                            transform: 'translateX(-50%)',
                            boxShadow: '0 0 5px rgba(0, 0, 0, 0.7)',
                            zIndex: 105,
                            overflow: 'hidden',
                            border: '1px solid rgba(255, 255, 255, 0.3)',
                            visibility: 'visible'
                        }}>
                            <Box sx={{
                                height: '100%',
                                width: `${Math.max(0, Math.min(100, (turnTimeRemaining / turnTimeLimit) * 100))}%`,
                                backgroundColor: (() => {
                                    const ratio = turnTimeRemaining / turnTimeLimit;
                                    return ratio > 0.66 ? '#4CAF50' : ratio > 0.33 ? '#FFC107' : '#F44336';
                                })(),
                                borderRadius: 3,
                                transition: 'width 0.5s linear, background-color 0.5s linear',
                                boxShadow: (() => {
                                    const ratio = turnTimeRemaining / turnTimeLimit;
                                    return ratio > 0.66 ? '0 0 6px #4CAF50' : 
                                            ratio > 0.33 ? '0 0 6px #FFC107' : 
                                            '0 0 6px #F44336';
                                })(),
                                animation: 'pulse-glow 1.5s infinite',
                                '@keyframes pulse-glow': {
                                    '0%': { opacity: 0.8 },
                                    '50%': { opacity: 1 },
                                    '100%': { opacity: 0.8 }
                                },
                                visibility: 'visible'
                            }} />
                        </Box>
                    </>
                )}
            </Box>
            
            {/* Player information card */}
            <Paper 
                elevation={3}
                sx={{
                    p: 0.8,
                    bgcolor: 'rgba(30, 30, 30, 0.9)',
                    borderRadius: 2,
                    minWidth: 90,
                    color: 'white',
                    border: isWinner ? '3px solid #FFD700' : isActive ? '2px solid #4CAF50' : isCurrentPlayer ? '2px solid #2196F3' : '1px solid rgba(255,255,255,0.2)',
                    transition: 'all 0.3s ease',
                    boxShadow: isWinner ? '0 0 15px rgba(255, 215, 0, 0.7)' : '0 4px 8px rgba(0,0,0,0.5)',
                    position: 'relative',
                    overflow: 'visible',
                    animation: isWinner ? 'winner-pulse 1.5s infinite' : 'none',
                    '@keyframes winner-pulse': {
                        '0%': { boxShadow: '0 0 5px rgba(255, 215, 0, 0.5)' },
                        '50%': { boxShadow: '0 0 20px rgba(255, 215, 0, 0.8)' },
                        '100%': { boxShadow: '0 0 5px rgba(255, 215, 0, 0.5)' }
                    }
                }}
            >
                {/* 获胜者奖杯图标 */}
                {isWinner && (
                    <React.Fragment>
                        {/* 主要奖杯图标 */}
                        <Box
                            sx={{
                                position: 'absolute',
                                top: -15,
                                right: -10,
                                backgroundColor: '#FFD700',
                                borderRadius: '50%',
                                padding: '4px',
                                zIndex: 20,
                                boxShadow: '0 0 10px rgba(255, 215, 0, 0.8)',
                                animation: 'trophy-glow 2s infinite',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: 30,
                                height: 30,
                                '@keyframes trophy-glow': {
                                    '0%': { boxShadow: '0 0 5px rgba(255, 215, 0, 0.5)' },
                                    '50%': { boxShadow: '0 0 15px rgba(255, 215, 0, 0.9)' },
                                    '100%': { boxShadow: '0 0 5px rgba(255, 215, 0, 0.5)' }
                                }
                            }}
                        >
                            {/* 使用条件渲染，如果奖杯图标加载失败则显示星星图标 */}
                            <EmojiEventsIcon sx={{ color: '#8B4513', fontSize: '1.5rem' }} />
                        </Box>
                        
                        {/* 备用冠军标记 - 添加在图标可能无法显示的情况下 */}
                        <Box
                            sx={{
                                position: 'absolute',
                                top: -25,
                                right: -20,
                                backgroundColor: 'transparent',
                                zIndex: 19,
                                pointerEvents: 'none'
                            }}
                        >
                            <Typography 
                                sx={{ 
                                    fontSize: '1.8rem',
                                    fontWeight: 'bold',
                                    color: '#FFD700',
                                    textShadow: '0 0 3px #000',
                                    fontFamily: '"Arial Black", Gadget, sans-serif'
                                }}
                            >
                                ★
                            </Typography>
                        </Box>
                    </React.Fragment>
                )}
                
                {/* Avatar */}
                <Box sx={{ textAlign: 'center', mb: 0.5 }}>
                    <Avatar 
                        sx={{ 
                            width: 36, 
                            height: 36, 
                            bgcolor: getPlayerColor(),
                            color: 'white',
                            border: '2px solid',
                            borderColor: isWinner ? '#FFD700' : isActive ? '#4CAF50' : 'transparent',
                            margin: '0 auto'
                        }}
                    >
                        {player.name ? player.name.charAt(0).toUpperCase() : '?'}
                    </Avatar>
                </Box>
                
                {/* Player name */}
                <Typography 
                    variant="body2" 
                    sx={{ 
                        fontWeight: 'bold',
                        textAlign: 'center',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        fontSize: '0.7rem',
                        color: isWinner ? '#FFD700' : 'white'
                    }}
                >
                    {player.name}
                </Typography>
                
                {/* Player chips */}
                <Typography 
                    sx={{ 
                        color: isWinner ? '#FFD700' : '#FFD700', 
                        textAlign: 'center',
                        fontWeight: 'bold',
                        fontSize: '0.75rem'
                    }}
                >
                    {(player.chips || 0).toFixed(1)} BB
                </Typography>
                
                {/* Fold indicator */}
                {player.hasFolded && (
                    <Box 
                        sx={{ 
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            bgcolor: 'rgba(0,0,0,0.7)',
                            backdropFilter: 'blur(2px)',
                            zIndex: 5,
                            borderRadius: 2
                        }}
                    >
                        <Typography 
                            variant="caption" 
                            sx={{ 
                                bgcolor: 'rgba(255,0,0,0.7)',
                                px: 1,
                                py: 0.2,
                                borderRadius: 1,
                                fontWeight: 'bold',
                                border: '1px solid rgba(255,255,255,0.3)'
                            }}
                        >
                            弃牌
                        </Typography>
                    </Box>
                )}
            </Paper>
            
            {/* Player's cards - moved below the player avatar */}
            {renderHand()}

            {/* Pending buy-in indicator - 只使用pending_buy_in字段 */}
            {player.pending_buy_in > 0 && (
                <Box sx={{ 
                    position: 'absolute',
                    top: -5,
                    right: -5,
                    backgroundColor: 'rgba(76, 175, 80, 0.9)',
                    color: 'white',
                    fontSize: '0.6rem',
                    padding: '2px 4px',
                    borderRadius: '4px',
                    border: '1px solid white',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                    zIndex: 20
                }}>
                    +{player.pending_buy_in.toFixed(1)} BB
                </Box>
            )}
            
            {/* 获胜者筹码奖励指示器 */}
            {isWinner && player.chipsWon > 0 && (
                <Box sx={{ 
                    position: 'absolute',
                    bottom: -10,
                    right: -10,
                    backgroundColor: 'rgba(255, 215, 0, 0.9)',
                    color: 'black',
                    fontSize: '0.7rem',
                    fontWeight: 'bold',
                    padding: '3px 6px',
                    borderRadius: '4px',
                    border: '1px solid #FFD700',
                    boxShadow: '0 0 10px rgba(255, 215, 0, 0.5)',
                    zIndex: 20,
                    animation: 'chip-win-pulse 1.5s infinite',
                    '@keyframes chip-win-pulse': {
                        '0%': { transform: 'scale(1)' },
                        '50%': { transform: 'scale(1.1)' },
                        '100%': { transform: 'scale(1)' }
                    }
                }}>
                    +{player.chipsWon.toFixed(1)} BB
                </Box>
            )}
        </Box>
    );
};

export default Player; 