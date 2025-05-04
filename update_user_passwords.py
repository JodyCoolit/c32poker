import sqlite3
import hashlib
import os

# User credentials to update
users = {
    "test_user": "test_password",
    "player1": "player1_password",
    "player2": "player2_password"
}

def update_password(username, password):
    # Generate password hash
    password_hash = hashlib.sha256(password.encode()).hexdigest()
    
    # 使用环境变量或默认为当前目录中的poker.db
    db_path = os.getenv("DB_PATH", "poker.db")
    
    # Connect to database
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    
    # Check if user exists
    c.execute('SELECT username FROM users WHERE username = ?', (username,))
    user = c.fetchone()
    
    if user:
        # Update password
        c.execute('UPDATE users SET password_hash = ? WHERE username = ?', (password_hash, username))
        conn.commit()
        print(f"Updated password for {username}")
    else:
        # Create user
        c.execute('INSERT INTO users (username, password_hash) VALUES (?, ?)', (username, password_hash))
        conn.commit()
        print(f"Created user {username}")
    
    conn.close()

def main():
    print("Updating user passwords...")
    for username, password in users.items():
        update_password(username, password)
    print("Done!")

if __name__ == "__main__":
    main() 