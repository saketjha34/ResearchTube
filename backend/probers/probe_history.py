import httpx

BASE_URL = "http://localhost:8000"

def run_history_prober(token: str):
    print("==================================================")
    print("PROBING: History endpoints (/youtube/history, /youtube/history/{run_id})")
    print("==================================================")

    client = httpx.Client(base_url=BASE_URL, headers={"Authorization": f"Bearer {token}"})
    
    # 1. Get History List
    print("[*] Fetching history list...")
    list_res = client.get("/youtube/history")
    
    if list_res.status_code != 200:
        print(f"[ERROR] Failed to fetch history: {list_res.status_code} - {list_res.text}")
        return False
        
    data = list_res.json()
    items = data.get("items", [])
    print(f"[+] History list fetched. Total runs found: {len(items)}")
    
    if len(items) == 0:
        print("[!] No history entries found. Run the research prober first to populate history.")
        return True
        
    # 2. Get details for the first run
    first_run_id = items[0]["id"]
    print(f"[*] Fetching details for run_id: {first_run_id}...")
    
    detail_res = client.get(f"/youtube/history/{first_run_id}")
    if detail_res.status_code == 200:
        detail_data = detail_res.json()
        print("[+] History detail fetched successfully.")
        print(f"[+] Topic: {detail_data.get('topic')}")
        print(f"[+] Total Videos: {len(detail_data.get('videos', []))}")
        return True
    else:
        print(f"[ERROR] Failed to fetch history detail: {detail_res.status_code} - {detail_res.text}")
        return False

if __name__ == "__main__":
    from probe_auth import run_auth_prober
    token = run_auth_prober()
    if token:
        run_history_prober(token)