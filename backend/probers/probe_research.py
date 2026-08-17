import httpx

BASE_URL = "http://localhost:8000"

def run_research_prober(token: str):
    print("==================================================")
    print("PROBING: Research endpoint (/youtube/research)")
    print("==================================================")

    client = httpx.Client(base_url=BASE_URL, headers={"Authorization": f"Bearer {token}"})
    
    payload = {
        "query": "What is Python?",
        "video_count": 1
    }
    
    print(f"[*] Starting YouTube research for query: '{payload['query']}'...")
    print("[*] Note: This may take a minute as it runs the 3-agent pipeline...")
    
    # Use a longer timeout for research
    res = client.post("/youtube/research", json=payload, timeout=120.0)
    
    if res.status_code == 200:
        data = res.json()
        print("[+] Research successful.")
        print(f"[+] Final Report Title: {data.get('report', {}).get('research_question')}")
        return True
    else:
        print(f"[ERROR] Research failed: {res.status_code} - {res.text}")
        return False

if __name__ == "__main__":
    from probe_auth import run_auth_prober
    token = run_auth_prober()
    if token:
        run_research_prober(token)
