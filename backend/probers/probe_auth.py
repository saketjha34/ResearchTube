import httpx
import uuid

BASE_URL = "http://localhost:8000"

def run_auth_prober():
    print("==================================================")
    print("PROBING: Auth endpoints (/auth/register, /auth/login, etc.)")
    print("==================================================")

    client = httpx.Client(base_url=BASE_URL)
    
    # 1. Register a new user
    random_id = uuid.uuid4().hex[:8]
    email = f"testuser_{random_id}@example.com"
    password = "SecurePassword123!"
    full_name = "Test User"
    
    register_payload = {
        "email": email,
        "password": password,
        "username": f"testuser_{random_id}",
        "full_name": full_name
    }
    
    print(f"[*] Registering user: {email}...")
    register_res = client.post("/auth/register", json=register_payload)
    
    if register_res.status_code not in (200, 201):
        print(f"[ERROR] Register failed: {register_res.status_code} - {register_res.text}")
        return None
    
    print("[+] Registration successful.")
    
    # 2. Login
    print(f"[*] Logging in...")
    login_payload = {
        "email": email,
        "password": password
    }
    
    login_res = client.post("/auth/login", json=login_payload)
    if login_res.status_code == 200:
        token_data = login_res.json()
        print("[+] Login successful.")
        access_token = token_data.get("access_token")
        refresh_token = token_data.get("refresh_token")
    else:
        print(f"[ERROR] Login failed: {login_res.status_code} - {login_res.text}")
        return None

    # 3. Change Password
    print("[*] Changing password...")
    new_password = "NewSecurePassword123!"
    change_pw_payload = {
        "current_password": password,
        "new_password": new_password
    }
    change_res = client.post(
        "/auth/change-password", 
        json=change_pw_payload, 
        headers={"Authorization": f"Bearer {access_token}"}
    )
    if change_res.status_code == 200:
        print("[+] Password changed successfully.")
    else:
        print(f"[ERROR] Change password failed: {change_res.status_code} - {change_res.text}")

    # 4. Google Auth Redirect Check
    print("[*] Checking Google Auth redirect...")
    google_res = client.get("/auth/google", follow_redirects=False)
    if google_res.status_code in (302, 303, 307):
        print("[+] Google Auth redirect endpoint is active.")
    else:
        print(f"[WARNING] Google Auth redirect returned: {google_res.status_code}")

    # 5. Logout
    print("[*] Logging out...")
    logout_payload = {
        "refresh_token": refresh_token
    }
    logout_res = client.post("/auth/logout", json=logout_payload)
    if logout_res.status_code == 200:
        print("[+] Logout successful.")
    else:
        print(f"[ERROR] Logout failed: {logout_res.status_code} - {logout_res.text}")

    # 6. Re-login with new password to get active token for other probers
    print("[*] Logging in again with new password to get active token for other probers...")
    relogin_payload = {
        "email": email,
        "password": new_password
    }
    relogin_res = client.post("/auth/login", json=relogin_payload)
    if relogin_res.status_code == 200:
        print("[+] Re-login successful.")
        return relogin_res.json().get("access_token")
    else:
        print(f"[ERROR] Re-login failed: {relogin_res.status_code} - {relogin_res.text}")
        return None

if __name__ == "__main__":
    run_auth_prober()
