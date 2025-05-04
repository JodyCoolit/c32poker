import sqlite3
import hashlib
from pathlib import Path
import time

class DBManager:
    def __init__(self):
        self.db_path = Path("d:/c32poker/poker.db")
        self.init_database()
        
    def init_database(self):
        conn = sqlite3.connect(self.db_path)
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
        conn.close()
        
    def register_user(self, username, password):
        password_hash = hashlib.sha256(password.encode()).hexdigest()
        try:
            conn = sqlite3.connect(self.db_path)
            c = conn.cursor()
            c.execute('INSERT INTO users (username, password_hash) VALUES (?, ?)',
                     (username, password_hash))
            conn.commit()
            return True, "注册成功"
        except sqlite3.IntegrityError:
            return False, "用户名已存在"
        finally:
            conn.close()
            
    def verify_user(self, username, password):
        password_hash = hashlib.sha256(password.encode()).hexdigest()
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        c.execute('SELECT password_hash FROM users WHERE username = ?', (username,))
        result = c.fetchone()
        conn.close()
        
        if result and result[0] == password_hash:
            return True, "登录成功"
        return False, "用户名或密码错误"
        
    def record_game(self, room_id, player, buy_in, cash_out):
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        c.execute('''
        INSERT INTO game_records (room_id, player, buy_in, cash_out)
        VALUES (?, ?, ?, ?)
        ''', (room_id, player, buy_in, cash_out))
        conn.commit()
        conn.close()
        
    def get_user_info(self, username):
        """获取用户信息"""
        attempts = 0
        max_attempts = 3
        timeout = 10.0  # 数据库超时时间设置为10秒
        
        while attempts < max_attempts:
            try:
                # 使用超时参数创建连接
                conn = sqlite3.connect(self.db_path, timeout=timeout)
                c = conn.cursor()
                c.execute('SELECT username, balance, email, avatar FROM users WHERE username = ?', (username,))
                result = c.fetchone()
                conn.close()
                
                if result:
                    return {
                        "username": result[0],
                        "balance": result[1],
                        "email": result[2],
                        "avatar": result[3]
                    }
                return None
                
            except sqlite3.OperationalError as e:
                # 数据库锁定或超时错误
                attempts += 1
                print(f"数据库访问错误 (attempt {attempts}/{max_attempts}): {str(e)}")
                if attempts >= max_attempts:
                    print(f"获取用户信息失败，已达到最大重试次数: {username}")
                    return None
                
                # 增加指数退避延迟
                delay = 0.1 * (2 ** attempts)  # 0.2, 0.4, 0.8秒...
                time.sleep(delay)
                
            except Exception as e:
                print(f"获取用户信息出现未预期错误: {str(e)}")
                return None
            finally:
                # 确保连接关闭
                try:
                    if 'conn' in locals() and conn:
                        conn.close()
                except:
                    pass
        
    def update_user_balance(self, username, new_balance):
        """更新用户余额"""
        try:
            conn = sqlite3.connect(self.db_path)
            c = conn.cursor()
            
            c.execute('UPDATE users SET balance = ? WHERE username = ?', (new_balance, username))
            conn.commit()
            
            if c.rowcount == 0:
                return False, "用户不存在"
                
            return True, "余额更新成功"
        except Exception as e:
            return False, f"余额更新失败: {str(e)}"
        finally:
            conn.close()
        
    def update_user(self, username, update_data):
        """更新用户信息"""
        try:
            conn = sqlite3.connect(self.db_path)
            c = conn.cursor()
            
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
            sql = f"UPDATE users SET {', '.join(update_fields)} WHERE username = ?"
            values.append(username)
            
            c.execute(sql, values)
            conn.commit()
            
            if c.rowcount == 0:
                return False, "用户不存在"
                
            return True, "更新成功"
            
        except Exception as e:
            return False, f"更新失败: {str(e)}"
        finally:
            conn.close()
        
    def get_game_records(self, limit=10, offset=0):
        """获取所有游戏记录，支持分页"""
        conn = sqlite3.connect(self.db_path)
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
            
        conn.close()
        return records
        
    def count_game_records(self):
        """获取游戏记录总数"""
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        c.execute('SELECT COUNT(*) FROM game_records')
        count = c.fetchone()[0]
        conn.close()
        return count
        
    def get_user_game_records(self, username, limit=10, offset=0):
        """获取指定用户的游戏记录，支持分页"""
        conn = sqlite3.connect(self.db_path)
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
            
        conn.close()
        return records
        
    def count_user_game_records(self, username):
        """获取指定用户的游戏记录总数"""
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        c.execute('SELECT COUNT(*) FROM game_records WHERE player = ?', (username,))
        count = c.fetchone()[0]
        conn.close()
        return count
        
    def get_win_rate_leaderboard(self, limit=10):
        """获取胜率排行榜"""
        conn = sqlite3.connect(self.db_path)
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
            
        conn.close()
        return leaderboard
        
    def get_profit_leaderboard(self, limit=10):
        """获取盈利排行榜"""
        conn = sqlite3.connect(self.db_path)
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
            
        conn.close()
        return leaderboard
        
    def get_user_statistics(self, username):
        """获取用户统计信息"""
        conn = sqlite3.connect(self.db_path)
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
            
        conn.close()
        return stats
        
    def get_platform_statistics(self):
        """获取平台整体统计信息"""
        conn = sqlite3.connect(self.db_path)
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
        
        conn.close()
        
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
        
    def submit_bug_report(self, user_id, description, contact=None, system_info=None, images=None):
        """提交Bug报告"""
        try:
            conn = sqlite3.connect(self.db_path)
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
            conn.close()
            
    def get_bug_reports(self, limit=10, offset=0, status=None):
        """获取Bug报告列表，支持分页和状态筛选"""
        conn = sqlite3.connect(self.db_path)
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
            
        conn.close()
        return reports
        
    def get_bug_report_by_id(self, report_id):
        """根据ID获取Bug报告详情"""
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        
        c.execute('''
        SELECT id, user_id, description, contact, system_info, status, images, created_at
        FROM bug_reports
        WHERE id = ?
        ''', (report_id,))
        
        row = c.fetchone()
        conn.close()
        
        if not row:
            return None
            
        import json
        system_info = json.loads(row[4]) if row[4] else None
        images = json.loads(row[6]) if row[6] else None
        
        return {
            "id": row[0],
            "user_id": row[1],
            "description": row[2],
            "contact": row[3],
            "system_info": system_info,
            "status": row[5],
            "images": images,
            "created_at": row[7]
        }
        
    def update_bug_report_status(self, report_id, status):
        """更新Bug报告状态"""
        try:
            conn = sqlite3.connect(self.db_path)
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
            conn.close()