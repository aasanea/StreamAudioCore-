"""
StreamAudio Core - Upload Release to Cloudflare R2
Uses Cloudflare API (not S3) to upload build artifacts to R2.
Reads version automatically from tauri.conf.json.
"""

import json
import os
import sys
import urllib.request
import urllib.error

# --- Configuration ---
ACCOUNT_ID = "bb412fd529888198c7f77d4e3652d091"
BUCKET_NAME = "streamaudio-updates"
ZONE_ID = "b5dec95ae7de9ce127a15fe786acb3a9"

# API Token - read from environment variable
API_TOKEN = os.environ.get("CLOUDFLARE_API_TOKEN")

if not API_TOKEN:
    print("❌ ERROR: CLOUDFLARE_API_TOKEN environment variable is not set!")
    sys.exit(1)


# Paths
PROJECT_ROOT = r"D:\StreamAudioCore"
TAURI_CONF = os.path.join(PROJECT_ROOT, "streamaudio-core", "src-tauri", "tauri.conf.json")
NSIS_DIR = os.path.join(PROJECT_ROOT, "streamaudio-core", "src-tauri", "target", "release", "bundle", "nsis")


def get_version():
    """Read version from tauri.conf.json"""
    with open(TAURI_CONF, "r", encoding="utf-8") as f:
        conf = json.load(f)
    return conf["version"]


def upload_to_r2(local_path, remote_key, content_type="application/octet-stream"):
    """Upload a file to Cloudflare R2 using the S3-compatible API via presigned or direct PUT"""
    url = f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/r2/buckets/{BUCKET_NAME}/objects/{remote_key}"

    file_size = os.path.getsize(local_path)
    print(f"  Uploading: {os.path.basename(local_path)} ({file_size / 1024 / 1024:.2f} MB)")
    print(f"  Destination: {BUCKET_NAME}/{remote_key}")

    with open(local_path, "rb") as f:
        data = f.read()

    req = urllib.request.Request(url, data=data, method="PUT")
    req.add_header("Authorization", f"Bearer {API_TOKEN}")
    req.add_header("Content-Type", content_type)

    try:
        with urllib.request.urlopen(req) as response:
            result = json.loads(response.read().decode())
            if result.get("success"):
                print(f"  [OK] Upload successful!")
                return True
            else:
                print(f"  [FAIL] Upload failed: {result.get('errors', 'Unknown error')}")
                return False
    except urllib.error.HTTPError as e:
        error_body = e.read().decode()
        print(f"  [FAIL] HTTP Error {e.code}: {error_body}")
        return False


def purge_cache():
    """Purge Cloudflare cache for the zone"""
    print("\n[3/3] Purging Cloudflare cache...")
    url = f"https://api.cloudflare.com/client/v4/zones/{ZONE_ID}/purge_cache"
    data = json.dumps({"purge_everything": True}).encode()

    req = urllib.request.Request(url, data=data, method="POST")
    req.add_header("Authorization", f"Bearer {API_TOKEN}")
    req.add_header("Content-Type", "application/json")

    try:
        with urllib.request.urlopen(req) as response:
            result = json.loads(response.read().decode())
            if result.get("success"):
                print("  [OK] Cache purged successfully!")
                return True
            else:
                print(f"  [FAIL] Cache purge failed: {result.get('errors')}")
                return False
    except urllib.error.HTTPError as e:
        print(f"  [FAIL] Cache purge HTTP Error {e.code}: {e.read().decode()}")
        return False


def verify_update():
    """Verify the update is accessible"""
    print("\n[Verification] Checking live update endpoint...")
    url = "https://updates.aasanea.com/releases/latest.json"

    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            live_version = data.get("version", "unknown")
            print(f"  Live version: {live_version}")
            return live_version
    except Exception as e:
        print(f"  [WARNING] Could not verify: {e}")
        return None


def main():
    print("")
    print("=== StreamAudio Core - Upload Release to R2 ===")
    print("")

    # Step 1: Read version
    version = get_version()
    print(f"[1/3] Detected version: {version}")

    # Define files to upload
    exe_filename = f"streamaudio-core_{version}_x64-setup.exe"
    exe_path = os.path.join(NSIS_DIR, exe_filename)
    json_path = os.path.join(NSIS_DIR, "latest.json")

    # Verify artifacts exist
    for path in [exe_path, json_path]:
        if not os.path.exists(path):
            print(f"[FAIL] ERROR: File not found: {path}")
            print("Please run the build script first!")
            sys.exit(1)

    # Step 2: Upload files
    print(f"\n[2/3] Uploading artifacts to R2...")

    success = True
    if not upload_to_r2(exe_path, f"releases/{exe_filename}", "application/x-msdownload"):
        success = False
    if not upload_to_r2(json_path, "releases/latest.json", "application/json"):
        success = False

    if not success:
        print("\n[FAIL] Upload failed! Please check errors above.")
        sys.exit(1)

    # Step 3: Purge cache
    purge_cache()

    # Verify
    live_version = verify_update()
    if live_version == version:
        print(f"\nSUCCESS! Version {version} is now live for all users!")
    else:
        print(f"\n[WARNING] Version mismatch: expected {version}, got {live_version}")
        print("Cache may still be propagating. Try again in a few minutes.")

    print("")


if __name__ == "__main__":
    main()
