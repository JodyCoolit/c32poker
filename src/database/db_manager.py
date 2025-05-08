import sqlite3
import hashlib
from pathlib import Path
import time
import threading
import logging
import functools
import os
import atexit

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("database")

class DBConnectionPool:
    """改进的SQLite连接池实现，带有超时控制和健康检查"""
    
    def __init__(self, db_path, max_connections=5, timeout=10.0):
        self.db_path = db_path
        self.max_connections = max_connections
        self.timeout = timeout
        self.connections = []
        self.lock = threading.Lock()
        self.connection_attempts = 0
        self.last_connection_error = None
        self.last_health_check = time.time()
        self.health_check_interval = 60.0  # 1分钟检查一次连接健康
        
    def get_connection(self):
        """获取一个数据库连接，带有超时控制"""
        # 记录获取连接的开始时间和尝试ID
        start_time = time.time()
        self.connection_attempts += 1
        attempt_id = self.connection_attempts
        max_wait_time = 5.0  # 最多等待5秒
        
        logger.debug(f"尝试获取连接 #{attempt_id}")
        
        # 循环尝试获取连接，直到成功或超时
        while time.time() - start_time < max_wait_time:
            try:
                with self.lock:
                    # 尝试获取一个现有的空闲连接，并进行健康检查
                    if self.connections:
                        conn = self.connections.pop()
                        
                        # 检查连接是否健康
                        try:
                            # 简单测试连接是否有效
                            conn.execute("SELECT 1").fetchone()
                            logger.debug(f"连接 #{attempt_id}: 从连接池获取空闲连接并通过健康检查")
                            return conn
                        except Exception as e:
                            # 连接不健康，关闭并创建新连接
                            logger.warning(f"连接 #{attempt_id}: 连接健康检查失败: {str(e)}")
                            try:
                                conn.close()
                            except:
                                pass
                    
                    # 如果没有空闲连接且未达到最大连接数，创建新连接
                    if len(self.connections) < self.max_connections:
                        try:
                            logger.info(f"连接 #{attempt_id}: 创建新连接: {self.db_path}")
                            # 使用参数化的超时设置创建新连接
                            conn = sqlite3.connect(self.db_path, timeout=self.timeout)
                            # 启用外键约束
                            conn.execute("PRAGMA foreign_keys = ON")
                            # 设置更安全的等待超时
                            conn.execute(f"PRAGMA busy_timeout = {int(self.timeout * 1000)}")
                            return conn
                        except Exception as e:
                            self.last_connection_error = e
                            logger.error(f"连接 #{attempt_id}: 创建数据库连接失败: {str(e)}")
                            # 抛出异常，允许外部处理
                            raise
                    
                    # 如果已达到最大连接数，等待并重试
                    logger.warning(f"连接 #{attempt_id}: 已达到最大连接数 {self.max_connections}，等待空闲连接")
            
            # 在循环中释放锁，避免死锁
            except Exception as e:
                logger.error(f"连接 #{attempt_id}: 获取连接时发生错误: {str(e)}")
                # 小延迟后重试
                time.sleep(0.1)
                continue
            
            # 添加随机等待时间，避免多个请求同时重试导致的冲突
            # 使用随机退避策略
            import random
            wait_time = 0.1 + (random.random() * 0.2)
            time.sleep(wait_time)
            
            # 检查是否已经等待太久
            elapsed = time.time() - start_time
            if elapsed > max_wait_time - 0.5:  # 预留0.5秒用于最后处理
                logger.error(f"连接 #{attempt_id}: 获取连接超时（>{max_wait_time}秒），可能存在死锁")
                break
        
        # 如果达到这里，表示获取连接超时
        raise Exception(f"获取数据库连接超时，已等待{time.time() - start_time:.2f}秒，最大连接数:{self.max_connections}")
    
    def release_connection(self, conn):
        """归还连接到连接池，包含健康检查"""
        if not conn:
            return
            
        try:
            with self.lock:
                # 进行周期性健康检查
                current_time = time.time()
                should_check_health = (current_time - self.last_health_check) > self.health_check_interval
                
                if should_check_health:
                    self.last_health_check = current_time
                    self._check_pool_health()
                
                # 测试连接是否有效
                try:
                    conn.execute("SELECT 1").fetchone()
                    
                    # 如果连接有效且连接池未满，则归还
                    if len(self.connections) < self.max_connections:
                        self.connections.append(conn)
                        logger.debug(f"成功归还连接到连接池，当前连接数: {len(self.connections)}")
                    else:
                        # 如果连接池已满，关闭连接
                        conn.close()
                        logger.debug(f"连接池已满，关闭连接")
                except Exception as e:
                    # 如果连接已无效，直接关闭
                    logger.warning(f"归还无效连接，关闭: {str(e)}")
                    try:
                        conn.close()
                    except:
                        pass
        except Exception as e:
            logger.error(f"归还连接到连接池时发生错误: {str(e)}")
            # 尝试关闭连接，避免泄漏
            try:
                conn.close()
            except:
                pass
    
    def _check_pool_health(self):
        """检查连接池中所有连接的健康状态"""
        logger.debug(f"执行连接池健康检查，当前连接数: {len(self.connections)}")
        healthy_connections = []
        
        for conn in self.connections:
            try:
                # 测试连接是否有效
                conn.execute("SELECT 1").fetchone()
                healthy_connections.append(conn)
            except Exception as e:
                logger.warning(f"移除不健康的连接: {str(e)}")
                try:
                    conn.close()
                except:
                    pass
        
        # 更新连接池为健康的连接
        self.connections = healthy_connections
        logger.debug(f"健康检查完成，保留 {len(self.connections)} 个健康连接")
    
    def close_all(self):
        """关闭所有连接，在应用退出时调用"""
        with self.lock:
            for conn in self.connections:
                try:
                    conn.close()
                except:
                    pass
            self.connections = []
            logger.info("已关闭所有数据库连接")

# 数据库操作装饰器 - 处理连接获取、异常处理和重试
def db_operation(max_attempts=3, initial_delay=0.1, operation_timeout=5.0):
    def decorator(func):
        @functools.wraps(func)
        def wrapper(self, *args, **kwargs):
            attempts = 0
            last_error = None
            start_time = time.time()
            
            while attempts < max_attempts:
                conn = None
                operation_timer = None
                
                try:
                    # 设置操作超时定时器
                    operation_timer = threading.Timer(
                        operation_timeout, 
                        lambda: logger.error(f"数据库操作超时: {func.__name__}, 参数: {args}, {kwargs}")
                    )
                    operation_timer.daemon = True
                    operation_timer.start()
                    
                    # 记录开始获取连接的时间
                    conn_start_time = time.time()
                    logger.debug(f"开始获取数据库连接: {func.__name__}")
                    
                    # 获取连接，添加最大等待时间（5秒）
                    conn_timeout = 5.0
                    conn_timer = threading.Timer(
                        conn_timeout, 
                        lambda: logger.error(f"获取数据库连接超时: {func.__name__}, 已等待{conn_timeout}秒")
                    )
                    conn_timer.daemon = True
                    conn_timer.start()
                    
                    # 尝试获取连接
                    conn = self.connection_pool.get_connection()
                    
                    # 取消连接超时定时器
                    if conn_timer.is_alive():
                        conn_timer.cancel()
                    
                    conn_elapsed = time.time() - conn_start_time
                    logger.debug(f"获取连接耗时: {conn_elapsed:.3f}秒")
                    
                    # 调用原始函数，传入连接
                    logger.debug(f"执行数据库操作: {func.__name__}")
                    result = func(self, conn, *args, **kwargs)
                    
                    # 取消操作超时定时器
                    if operation_timer.is_alive():
                        operation_timer.cancel()
                    
                    elapsed = time.time() - start_time
                    logger.debug(f"数据库操作完成: {func.__name__}, 耗时: {elapsed:.3f}秒")
                    
                    return result
                    
                except sqlite3.OperationalError as e:
                    # 处理数据库锁定或超时错误
                    attempts += 1
                    last_error = e
                    logger.warning(f"数据库操作失败 (attempt {attempts}/{max_attempts}): {str(e)}")
                    
                    if "database is locked" in str(e) or "timeout" in str(e):
                        # 指数退避延迟
                        delay = initial_delay * (2 ** attempts)
                        logger.info(f"等待 {delay}秒后重试...")
                        time.sleep(delay)
                    else:
                        # 其他操作错误直接失败
                        raise
                        
                except Exception as e:
                    # 非数据库锁定相关错误
                    logger.error(f"数据库操作出现意外错误: {str(e)}")
                    raise
                    
                finally:
                    # 取消操作超时定时器（如果仍然活动）
                    if operation_timer and operation_timer.is_alive():
                        operation_timer.cancel()
                    
                    # 确保连接被归还到连接池
                    if conn:
                        try:
                            logger.debug(f"释放数据库连接: {func.__name__}")
                            self.connection_pool.release_connection(conn)
                        except Exception as e:
                            logger.error(f"归还连接到连接池失败: {str(e)}")
                    
                    # 检查总操作时间是否超过允许的最大时间
                    elapsed = time.time() - start_time
                    if elapsed > operation_timeout * 1.5:  # 给1.5倍的余量
                        logger.warning(f"数据库操作耗时过长: {func.__name__}, 已耗时 {elapsed:.3f}秒")
                        if attempts >= max_attempts - 1:  # 如果是最后一次尝试
                            break
            
            # 达到最大重试次数后仍然失败
            if last_error:
                elapsed = time.time() - start_time
                logger.error(f"数据库操作失败，已达到最大重试次数 {max_attempts}: {str(last_error)}, 总耗时: {elapsed:.3f}秒")
                raise last_error
                
        return wrapper
    return decorator

class DBManager:
    def __init__(self):
        # 使用环境变量设置数据库路径，如果没有设置则使用默认路径
        db_path_env = os.getenv("DB_PATH")
        if db_path_env:
            # 使用环境变量中的路径
            self.db_path = db_path_env
            logger.info(f"使用环境变量中的数据库路径: {self.db_path}")
        else:
            # 默认的开发环境路径
            self.db_path = "poker.db"  # 使用相对路径，更加通用
            logger.info(f"使用默认数据库路径: {self.db_path}")
        
        # 创建连接池
        self.connection_pool = DBConnectionPool(self.db_path, max_connections=10, timeout=15.0)
        
        # 设置进程退出时的清理函数
        atexit.register(self._cleanup_resources)
        
        # 初始化数据库
        self.init_database()
        
        logger.info("数据库管理器初始化完成")
    
    def _cleanup_resources(self):
        """在进程退出时清理资源"""
        try:
            logger.info("正在清理数据库资源...")
            if hasattr(self, 'connection_pool'):
                self.connection_pool.close_all()
            logger.info("数据库资源清理完成")
        except Exception as e:
            logger.error(f"清理数据库资源时出错: {str(e)}")
            
    def __del__(self):
        """析构函数，确保资源被释放"""
        self._cleanup_resources()
    
    def init_database(self):
        """初始化数据库表结构"""
        conn = None
        try:
            conn = self.connection_pool.get_connection()
            c = conn.cursor()
            
            # 创建用户表
            c.execute('''
            CREATE TABLE IF NOT EXISTS users (
                username TEXT PRIMARY KEY,
                password_hash TEXT NOT NULL,
                balance INTEGER DEFAULT 0,
                email TEXT,
                avatar TEXT
            )
            ''')
            
            # 创建游戏记录表
            c.execute('''
            CREATE TABLE IF NOT EXISTS game_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                room_id TEXT,
                player TEXT,
                buy_in INTEGER,
                cash_out INTEGER,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )
            ''')
            
            # 创建Bug报告表
            c.execute('''
            CREATE TABLE IF NOT EXISTS bug_reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT,
                description TEXT NOT NULL,
                contact TEXT,
                system_info TEXT,
                status TEXT DEFAULT 'pending',
                images TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(username)
            )
            ''')
            
            conn.commit()
            logger.info("数据库初始化成功")
            
        except Exception as e:
            logger.error(f"初始化数据库失败: {str(e)}")
            raise
        finally:
            if conn:
                self.connection_pool.release_connection(conn)
    
    @db_operation(max_attempts=3)
    def register_user(self, conn, username, password, avatar):
        """注册新用户"""
        password_hash = hashlib.sha256(password.encode()).hexdigest()
        try:
            c = conn.cursor()
            c.execute('INSERT INTO users (username, password_hash, avatar) VALUES (?, ?, ?)',
                     (username, password_hash, avatar))
            conn.commit()
            return True, "注册成功"
        except sqlite3.IntegrityError:
            return False, "用户名已存在"
            
    @db_operation(max_attempts=3)        
    def verify_user(self, conn, username, password):
        """验证用户登录"""
        password_hash = hashlib.sha256(password.encode()).hexdigest()
        c = conn.cursor()
        c.execute('SELECT password_hash FROM users WHERE username = ?', (username,))
        result = c.fetchone()
        
        if result and result[0] == password_hash:
            return True, "登录成功"
        return False, "用户名或密码错误"
        
    @db_operation(max_attempts=3)        
    def record_game(self, conn, room_id, player, buy_in, cash_out):
        """记录游戏结果"""
        c = conn.cursor()
        c.execute('''
        INSERT INTO game_records (room_id, player, buy_in, cash_out)
        VALUES (?, ?, ?, ?)
        ''', (room_id, player, buy_in, cash_out))
        conn.commit()
        return True
        
    @db_operation(max_attempts=3)        
    def get_user_info(self, conn, username):
        """获取用户信息"""
        try:
            print(f"[DATABASE][get_user_info] 获取用户信息: username={username}")
            logger.info(f"获取用户信息: username={username}")
            
            c = conn.cursor()
            c.execute('SELECT username, balance, email, avatar FROM users WHERE username = ?', (username,))
            result = c.fetchone()
            
            if result:
                user_info = {
                    "username": result[0],
                    "balance": result[1],
                    "email": result[2],
                    "avatar": result[3]
                }
                logger.info(f"成功获取用户 {username} 的信息")
                return user_info
            
            logger.warning(f"用户不存在: {username}")
            print(f"[DATABASE][get_user_info] 用户不存在: {username}")
            return None
        except Exception as e:
            logger.error(f"获取用户信息时出错: {str(e)}")
            print(f"[DATABASE][get_user_info] 出错: {str(e)}")
            raise
    
    @db_operation(max_attempts=3)        
    def update_user_balance(self, conn, username, new_balance):
        """更新用户余额"""
        c = conn.cursor()
        
        c.execute('UPDATE users SET balance = ? WHERE username = ?', (new_balance, username))
        conn.commit()
        
        if c.rowcount == 0:
            return False, "用户不存在"
            
        return True, "余额更新成功"
    
    @db_operation(max_attempts=3)    
    def update_user(self, conn, username, update_data):
        """更新用户信息"""
        # 构建更新语句
        update_fields = []
        values = []
        
        if "password" in update_data:
            update_fields.append("password_hash = ?")
            password_hash = hashlib.sha256(update_data["password"].encode()).hexdigest()
            values.append(password_hash)
            
        if "email" in update_data:
            update_fields.append("email = ?")
            values.append(update_data["email"])
            
        if "avatar" in update_data:
            update_fields.append("avatar = ?")
            values.append(update_data["avatar"])
            
        if "balance" in update_data:
            update_fields.append("balance = ?")
            values.append(update_data["balance"])
        
        if not update_fields:
            return False, "没有要更新的字段"
            
        # 构建并执行SQL
        c = conn.cursor()
        sql = f"UPDATE users SET {', '.join(update_fields)} WHERE username = ?"
        values.append(username)
        
        c.execute(sql, values)
        conn.commit()
        
        if c.rowcount == 0:
            return False, "用户不存在"
            
        return True, "更新成功"

    def get_game_records(self, limit=10, offset=0):
        """获取所有游戏记录，支持分页"""
        conn = None
        try:
            conn = self.connection_pool.get_connection()
            c = conn.cursor()
            c.execute('''
            SELECT id, room_id, player, buy_in, cash_out, timestamp
            FROM game_records
            ORDER BY timestamp DESC
            LIMIT ? OFFSET ?
            ''', (limit, offset))
            
            records = []
            for row in c.fetchall():
                records.append({
                    "id": row[0],
                    "room_id": row[1],
                    "player": row[2],
                    "buy_in": row[3],
                    "cash_out": row[4],
                    "profit": row[4] - row[3],  # 计算盈亏
                    "timestamp": row[5]
                })
            
            return records
        finally:
            if conn:
                self.connection_pool.release_connection(conn)
        
    def count_game_records(self):
        """获取游戏记录总数"""
        conn = None
        try:
            conn = self.connection_pool.get_connection()
            c = conn.cursor()
            c.execute('SELECT COUNT(*) FROM game_records')
            count = c.fetchone()[0]
            return count
        finally:
            if conn:
                self.connection_pool.release_connection(conn)
        
    def get_user_game_records(self, username, limit=10, offset=0):
        """获取指定用户的游戏记录，支持分页"""
        conn = None
        try:
            conn = self.connection_pool.get_connection()
            c = conn.cursor()
            c.execute('''
            SELECT id, room_id, player, buy_in, cash_out, timestamp
            FROM game_records
            WHERE player = ?
            ORDER BY timestamp DESC
            LIMIT ? OFFSET ?
            ''', (username, limit, offset))
            
            records = []
            for row in c.fetchall():
                records.append({
                    "id": row[0],
                    "room_id": row[1],
                    "player": row[2],
                    "buy_in": row[3],
                    "cash_out": row[4],
                    "profit": row[4] - row[3],  # 计算盈亏
                    "timestamp": row[5]
                })
            
            return records
        finally:
            if conn:
                self.connection_pool.release_connection(conn)
        
    def count_user_game_records(self, username):
        """获取指定用户的游戏记录总数"""
        conn = None
        try:
            conn = self.connection_pool.get_connection()
            c = conn.cursor()
            c.execute('SELECT COUNT(*) FROM game_records WHERE player = ?', (username,))
            count = c.fetchone()[0]
            return count
        finally:
            if conn:
                self.connection_pool.release_connection(conn)
        
    def get_win_rate_leaderboard(self, limit=10):
        """获取胜率排行榜"""
        conn = None
        try:
            conn = self.connection_pool.get_connection()
            c = conn.cursor()
            
            # 查询每个玩家的游戏次数和赢得次数
            c.execute('''
            WITH player_games AS (
                SELECT 
                    player,
                    COUNT(*) as total_games,
                    SUM(CASE WHEN cash_out > buy_in THEN 1 ELSE 0 END) as wins
                FROM game_records
                GROUP BY player
            )
            SELECT 
                player,
                total_games,
                wins,
                CASE WHEN total_games > 0 THEN (wins * 100.0 / total_games) ELSE 0 END as win_rate
            FROM player_games
            ORDER BY win_rate DESC, total_games DESC
            LIMIT ?
            ''', (limit,))
            
            leaderboard = []
            for row in c.fetchall():
                leaderboard.append({
                    "username": row[0],
                    "total_games": row[1],
                    "wins": row[2],
                    "win_rate": round(row[3], 2)  # 四舍五入到2位小数
                })
            
            return leaderboard
        finally:
            if conn:
                self.connection_pool.release_connection(conn)
        
    def get_profit_leaderboard(self, limit=10):
        """获取盈利排行榜"""
        conn = None
        try:
            conn = self.connection_pool.get_connection()
            c = conn.cursor()
            
            # 查询每个玩家的总买入和总提现
            c.execute('''
            SELECT 
                player,
                SUM(buy_in) as total_buy_in,
                SUM(cash_out) as total_cash_out,
                SUM(cash_out - buy_in) as profit
            FROM game_records
            GROUP BY player
            ORDER BY profit DESC
            LIMIT ?
            ''', (limit,))
            
            leaderboard = []
            for row in c.fetchall():
                leaderboard.append({
                    "username": row[0],
                    "total_buy_in": row[1],
                    "total_cash_out": row[2],
                    "profit": row[3]
                })
            
            return leaderboard
        finally:
            if conn:
                self.connection_pool.release_connection(conn)
        
    def get_user_statistics(self, username):
        """获取用户统计信息"""
        conn = None
        try:
            conn = self.connection_pool.get_connection()
            c = conn.cursor()
            
            # 查询用户的游戏总数、赢的次数、总买入、总提现和盈利情况
            c.execute('''
            SELECT 
                COUNT(*) as total_games,
                SUM(CASE WHEN cash_out > buy_in THEN 1 ELSE 0 END) as wins,
                SUM(CASE WHEN cash_out < buy_in THEN 1 ELSE 0 END) as losses,
                SUM(CASE WHEN cash_out = buy_in THEN 1 ELSE 0 END) as draws,
                SUM(buy_in) as total_buy_in,
                SUM(cash_out) as total_cash_out,
                SUM(cash_out - buy_in) as profit
            FROM game_records
            WHERE player = ?
            ''', (username,))
            
            row = c.fetchone()
            
            if row:
                total_games = row[0]
                wins = row[1] or 0
                losses = row[2] or 0
                draws = row[3] or 0
                total_buy_in = row[4] or 0
                total_cash_out = row[5] or 0
                profit = row[6] or 0
                
                # 计算胜率
                win_rate = (wins * 100.0 / total_games) if total_games > 0 else 0
                
                stats = {
                    "total_games": total_games,
                    "wins": wins,
                    "losses": losses,
                    "draws": draws,
                    "win_rate": round(win_rate, 2),  # 四舍五入到2位小数
                    "total_buy_in": total_buy_in,
                    "total_cash_out": total_cash_out,
                    "profit": profit
                }
            else:
                # 用户没有游戏记录
                stats = {
                    "total_games": 0,
                    "wins": 0,
                    "losses": 0,
                    "draws": 0,
                    "win_rate": 0,
                    "total_buy_in": 0,
                    "total_cash_out": 0,
                    "profit": 0
                }
            
            return stats
        finally:
            if conn:
                self.connection_pool.release_connection(conn)
        
    def get_platform_statistics(self):
        """获取平台整体统计信息"""
        conn = None
        try:
            conn = self.connection_pool.get_connection()
            c = conn.cursor()
            
            # 查询总用户数
            c.execute('SELECT COUNT(*) FROM users')
            total_users = c.fetchone()[0]
            
            # 查询总游戏局数
            c.execute('SELECT COUNT(*) FROM game_records')
            total_games = c.fetchone()[0]
            
            # 查询总交易量
            c.execute('SELECT SUM(buy_in) FROM game_records')
            total_buy_in = c.fetchone()[0] or 0
            
            # 查询总提现
            c.execute('SELECT SUM(cash_out) FROM game_records')
            total_cash_out = c.fetchone()[0] or 0
            
            # 查询平均每局金额
            average_pot = total_buy_in / total_games if total_games > 0 else 0
            
            # 查询最高盈利玩家
            c.execute('''
            SELECT player, SUM(cash_out - buy_in) as profit
            FROM game_records
            GROUP BY player
            ORDER BY profit DESC
            LIMIT 1
            ''')
            top_profit_row = c.fetchone()
            top_profit_player = {
                "username": top_profit_row[0],
                "profit": top_profit_row[1]
            } if top_profit_row else None
            
            # 查询最高胜率玩家
            c.execute('''
            WITH player_games AS (
                SELECT 
                    player,
                    COUNT(*) as total_games,
                    SUM(CASE WHEN cash_out > buy_in THEN 1 ELSE 0 END) as wins
                FROM game_records
                GROUP BY player
                HAVING total_games >= 5
            )
            SELECT 
                player,
                total_games,
                wins,
                (wins * 100.0 / total_games) as win_rate
            FROM player_games
            ORDER BY win_rate DESC
            LIMIT 1
            ''')
            top_win_rate_row = c.fetchone()
            top_win_rate_player = {
                "username": top_win_rate_row[0],
                "games": top_win_rate_row[1],
                "wins": top_win_rate_row[2],
                "win_rate": round(top_win_rate_row[3], 2)
            } if top_win_rate_row else None
            
            return {
                "total_users": total_users,
                "total_games": total_games,
                "total_buy_in": total_buy_in,
                "total_cash_out": total_cash_out,
                "platform_profit": total_buy_in - total_cash_out,
                "average_pot": round(average_pot, 2),
                "top_profit_player": top_profit_player,
                "top_win_rate_player": top_win_rate_player
            }
        finally:
            if conn:
                self.connection_pool.release_connection(conn)
        
    def submit_bug_report(self, user_id, description, contact=None, system_info=None, images=None):
        """提交Bug报告"""
        conn = None
        try:
            conn = self.connection_pool.get_connection()
            c = conn.cursor()
            
            # 将图片和系统信息转换为JSON字符串存储
            import json
            images_json = json.dumps(images) if images else None
            system_info_json = json.dumps(system_info) if system_info else None
            
            c.execute('''
            INSERT INTO bug_reports (user_id, description, contact, system_info, images)
            VALUES (?, ?, ?, ?, ?)
            ''', (user_id, description, contact, system_info_json, images_json))
            
            report_id = c.lastrowid
            conn.commit()
            
            return True, report_id
        except Exception as e:
            return False, f"提交Bug报告失败: {str(e)}"
        finally:
            if conn:
                self.connection_pool.release_connection(conn)
            
    def get_bug_reports(self, limit=10, offset=0, status=None):
        """获取Bug报告列表，支持分页和状态筛选"""
        conn = None
        try:
            conn = self.connection_pool.get_connection()
            c = conn.cursor()
            
            query = '''
            SELECT id, user_id, description, contact, system_info, status, images, created_at
            FROM bug_reports
            '''
            
            params = []
            
            if status:
                query += ' WHERE status = ?'
                params.append(status)
            
            query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
            params.extend([limit, offset])
            
            c.execute(query, params)
            
            reports = []
            for row in c.fetchall():
                import json
                system_info = json.loads(row[4]) if row[4] else None
                images = json.loads(row[6]) if row[6] else None
                
                reports.append({
                    "id": row[0],
                    "user_id": row[1],
                    "description": row[2],
                    "contact": row[3],
                    "system_info": system_info,
                    "status": row[5],
                    "images": images,
                    "created_at": row[7]
                })
            
            return reports
        finally:
            if conn:
                self.connection_pool.release_connection(conn)
            
    def get_bug_report_by_id(self, report_id):
        """根据ID获取Bug报告详情"""
        conn = None
        try:
            conn = self.connection_pool.get_connection()
            c = conn.cursor()
            
            c.execute('''
            SELECT id, user_id, description, contact, system_info, status, images, created_at
            FROM bug_reports
            WHERE id = ?
            ''', (report_id,))
            
            row = c.fetchone()
            return {
                "id": row[0],
                "user_id": row[1],
                "description": row[2],
                "contact": row[3],
                "system_info": row[4],
                "status": row[5],
                "images": row[6],
                "created_at": row[7]
            }
        finally:
            if conn:
                self.connection_pool.release_connection(conn)
        
    def update_bug_report_status(self, report_id, status):
        """更新Bug报告状态"""
        conn = None
        try:
            conn = self.connection_pool.get_connection()
            c = conn.cursor()
            
            c.execute('''
            UPDATE bug_reports
            SET status = ?
            WHERE id = ?
            ''', (status, report_id))
            
            conn.commit()
            
            if c.rowcount == 0:
                return False, "Bug报告不存在"
                
            return True, "状态更新成功"
        except Exception as e:
            return False, f"更新状态失败: {str(e)}"
        finally:
            if conn:
                self.connection_pool.release_connection(conn)