class User:
    def __init__(self, username, password_hash, balance=0):
        self.username = username
        self.password_hash = password_hash
        self.balance = balance
        self.current_room = None