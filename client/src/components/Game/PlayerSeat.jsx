const PlayerSeat = ({ position, data, onSeatClick }) => {
  // 渲染思考时间进度条
  const renderThinkingTimer = () => {
    // 确保数据存在且是当前玩家的回合
    if (data && data.isTurn && data.turnTimeLimit && data.turnTimeRemaining !== undefined) {
      // 计算进度条百分比
      const progressPercent = Math.max(0, Math.min(100, (data.turnTimeRemaining / data.turnTimeLimit) * 100));
      
      console.log(`渲染思考时间: ${data.turnTimeRemaining}/${data.turnTimeLimit} (${progressPercent}%)`);
      
      return (
        <div className="thinking-timer-container">
          <div className="thinking-timer-progress" style={{ width: `${progressPercent}%` }}></div>
          <div className="thinking-timer-text">{Math.ceil(data.turnTimeRemaining)}s</div>
        </div>
      );
    }
    return null;
  };

  return (
    <div 
      className={`player-seat ${getSeatClassName()}`}
      style={getSeatStyle()}
      onClick={handleSeatClick}
    >
      {/* 思考时间显示 */}
      {renderThinkingTimer()}
    </div>
  );
}; 