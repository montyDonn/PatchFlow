import urllib.request
import json

def test_api():
    # Login
    try:
        req = urllib.request.Request(
            "http://localhost:8080/api/auth/login",
            data=json.dumps({"username": "admin", "password": "upcl@123"}).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req) as res:
            login_data = json.loads(res.read().decode())
            token = login_data["token"]
            print("Login success.")
    except Exception as e:
        print("Login failed:", e)
        return

    # Fetch tasks
    try:
        req = urllib.request.Request(
            "http://localhost:8080/api/tasks",
            headers={"Authorization": f"Bearer {token}"},
            method="GET"
        )
        with urllib.request.urlopen(req) as res:
            tasks = json.loads(res.read().decode())
            print(f"Fetch tasks success: {len(tasks)} tasks.")
    except urllib.error.HTTPError as e:
        print("Fetch tasks HTTP Error:", e.code, e.read().decode())
    except Exception as e:
        print("Fetch tasks general error:", e)

    # Fetch modules
    try:
        req = urllib.request.Request(
            "http://localhost:8080/api/modules",
            headers={"Authorization": f"Bearer {token}"},
            method="GET"
        )
        with urllib.request.urlopen(req) as res:
            modules = json.loads(res.read().decode())
            print(f"Fetch modules success: {len(modules)} modules.")
    except urllib.error.HTTPError as e:
        print("Fetch modules HTTP Error:", e.code, e.read().decode())
    except Exception as e:
        print("Fetch modules general error:", e)

if __name__ == "__main__":
    test_api()
