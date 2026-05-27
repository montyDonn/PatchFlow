import urllib.request
import json

def test_endpoints():
    endpoints = [
        ("http://localhost:8080/api/health", "GET", None),
        ("http://localhost:8080/api/auth/login", "POST", {"username": "admin", "password": "upcl@123"})
    ]

    for url, method, data in endpoints:
        print(f"Testing {method} {url}...")
        req = urllib.request.Request(url, method=method)
        if data:
            req.data = json.dumps(data).encode("utf-8")
            req.add_header("Content-Type", "application/json")
        try:
            with urllib.request.urlopen(req) as response:
                print(f"Status: {response.status}")
                print(f"Body: {response.read().decode('utf-8')[:300]}")
        except urllib.error.HTTPError as e:
            print(f"HTTP Error {e.code}:")
            print(e.read().decode("utf-8"))
        except Exception as e:
            print(f"Connection error: {e}")

if __name__ == "__main__":
    test_endpoints()
