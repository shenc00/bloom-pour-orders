"""Tiny fal queue client: upload a local file, run an endpoint, download the result. Key from OpenMontage .env, never printed."""
import json, os, sys, time
import requests
from dotenv import load_dotenv

load_dotenv(r"C:\Users\Admin\OneDrive\Documents\Github\OpenMontage\.env")
KEY = os.environ.get("FAL_KEY") or sys.exit("FAL_KEY missing")
H = {"Authorization": f"Key {KEY}", "Content-Type": "application/json"}
SPENT = os.path.join(os.path.dirname(__file__), "fal_spend.log")


def upload(path, ctype="video/mp4"):
    r = requests.post("https://rest.alpha.fal.ai/storage/upload/initiate", headers=H, timeout=60,
                      json={"content_type": ctype, "file_name": os.path.basename(path)})
    r.raise_for_status(); j = r.json()
    for attempt in range(3):  # big files sometimes drop mid-transfer
        try:
            with open(path, "rb") as f:
                requests.put(j["upload_url"], data=f, headers={"Content-Type": ctype}, timeout=1800).raise_for_status()
            return j["file_url"]
        except requests.exceptions.ConnectionError as e:
            print(f"upload retry {attempt + 1}: {e}", flush=True); time.sleep(10)
    sys.exit("upload failed 3 times")


def run(endpoint, payload, label, est, timeout=3600):
    """submit, poll, return result json; logs the estimated cost of every completed call"""
    print(f"[{label}] submit {endpoint} (est ${est:.2f})", flush=True)
    q = requests.post(f"https://queue.fal.run/{endpoint}", headers=H, json=payload, timeout=60)
    if q.status_code >= 400:
        sys.exit(f"[{label}] REJECTED {q.status_code}: {q.text[:500]}")
    q = q.json(); t0 = time.time()
    print(f"[{label}] request {q.get('request_id')} status {q['status_url']} response {q['response_url']}", flush=True)
    while True:
        s = requests.get(q["status_url"], headers=H, timeout=60).json()
        if s.get("status") == "COMPLETED": break
        if s.get("status") in ("FAILED", "ERROR") or time.time() - t0 > timeout:
            sys.exit(f"[{label}] FAILED: {json.dumps(s)[:500]}")
        time.sleep(5)
    for attempt in range(20):  # the result can 5xx for a while (downstream briefly unavailable): keep asking
        r = requests.get(q["response_url"], headers=H, timeout=120)
        if r.status_code < 500: break
        print(f"[{label}] result {r.status_code}, retry {attempt + 1}: {r.text[:200]}", flush=True); time.sleep(30)
    if r.status_code >= 400:
        sys.exit(f"[{label}] RESULT ERROR {r.status_code}: {r.text[:500]}")
    with open(SPENT, "a") as f:
        f.write(f"{time.strftime('%Y-%m-%d %H:%M')}\t{label}\t{endpoint}\t{est:.2f}\n")
    print(f"[{label}] done in {time.time() - t0:.0f}s", flush=True)
    return r.json()


def fetch(url, path):
    with requests.get(url, stream=True, timeout=1800) as d:
        d.raise_for_status()
        with open(path, "wb") as f:
            for c in d.iter_content(1 << 20): f.write(c)
    return path
