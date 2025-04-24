import React from 'react';
import { Box, Paper, Typography, Badge, Avatar } from '@mui/material';
import Card from './Card';
import DealerButton from './DealerButton';

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
                        <Card 
                                    card={cardValue || ''} 
                            size="small"
                            faceDown={!shouldShowCards}
                                    style={{
                                        border: '2px solid white',
                                        boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
                                    }}
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
                            <Card 
                                card={typeof discardedCard === 'string' ? discardedCard : 
                                    (discardedCard.display || discardedCard.value || discardedCard)} 
                                size="small"
                                style={{
                                    opacity: 0.8,
                                    border: '2px solid rgba(255,0,0,0.5)'
                                }}
                            />
                        </Box>
                    )}
                </Box>
            );
        } else if (hasHand || player.hasHand || (gameState && gameState.status === 'playing')) {
            // 没有手牌数据但有手牌标志或游戏正在进行中，显示卡背
            // 根据游戏类型决定显示几张牌（德州扑克2张，其他可能更多）
            const cardCount = 2; // 默认两张
            
            return (
                <Box sx={{ 
                    display: 'flex', 
                    gap: 0.5, 
                    justifyContent: 'center',
                    mt: 1,
                    position: 'relative',
                    transform: 'translateY(10px)',
                    zIndex: 5
                }}>
                    {/* 显示卡背 */}
                    {Array.from({ length: cardCount }).map((_, index) => (
                        <Box key={index} sx={{ 
                            position: 'relative',
                            transform: `rotate(${index === 0 ? '-5deg' : '5deg'})`,
                            zIndex: index + 1
                        }}>
                            <Card 
                                card="" 
                                size="small"
                                faceDown={true}
                            style={{
                                border: '2px solid white',
                                boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
                            }}
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
                        <Card 
                                card={typeof discardedCard === 'string' ? discardedCard : 
                                    (discardedCard.display || discardedCard.value || discardedCard)} 
                            size="small"
                            style={{
                                opacity: 0.8,
                                border: '2px solid rgba(255,0,0,0.5)'
                            }}
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
                {(isActive || turnTimeRemaining > 0) && (
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
                    border: isActive ? '2px solid #4CAF50' : isCurrentPlayer ? '2px solid #2196F3' : '1px solid rgba(255,255,255,0.2)',
                    transition: 'all 0.3s ease',
                    boxShadow: '0 4px 8px rgba(0,0,0,0.5)',
                    position: 'relative',
                    overflow: 'visible'
                }}
            >
                {/* Avatar */}
                <Box sx={{ textAlign: 'center', mb: 0.5 }}>
                    <Avatar 
                        sx={{ 
                            width: 36, 
                            height: 36, 
                            bgcolor: getPlayerColor(),
                            color: 'white',
                            border: '2px solid',
                            borderColor: isActive ? '#4CAF50' : 'transparent',
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
                        fontSize: '0.7rem'
                    }}
                >
                    {player.name}
                </Typography>
                
                {/* Player chips */}
                <Typography 
                    sx={{ 
                        color: '#FFD700', 
                        textAlign: 'center',
                        fontWeight: 'bold',
                        fontSize: '0.75rem'
                    }}
                >
                    {player.chips || 0} BB
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

            {/* Pending chips indicator */}
            {player.pending_chips > 0 && (
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
                    +{player.pending_chips} BB
                </Box>
            )}
        </Box>
    );
};

export default Player; 