import requests

# Base URL for API
API_URL = "http://127.0.0.1:8000/api"

# Test users with updated credentials
users = {
    "test_user": "test_password",
    "player1": "player1_password",
    "player2": "player2_password"
}

# Register a user
def register_user(username, password):
    response = requests.post(
        f"{API_URL}/auth/register",
        json={"username": username, "password": password, "email": f"{username}@example.com"}
    )
    print(f"Register {username}: {response.status_code}, {response.text}")
    return response.status_code == 200 or response.status_code == 400

# Register all test users
def main():
    for username, password in users.items():
        success = register_user(username, password)
        if not success:
            print(f"Failed to register {username}")

if __name__ == "__main__":
    main() 