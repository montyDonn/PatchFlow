import json
import urllib.request
import urllib.parse

def make_request(url, method="GET", headers=None, data=None):
    if headers is None:
        headers = {}
    if data is not None:
        req_data = json.dumps(data).encode("utf-8")
        headers["Content-Type"] = "application/json"
    else:
        req_data = None
    
    req = urllib.request.Request(url, data=req_data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as response:
            res_body = response.read().decode("utf-8")
            if res_body:
                return json.loads(res_body)
            return {}
    except urllib.error.HTTPError as e:
        print(f"HTTP Error {e.code}: {e.read().decode('utf-8')}")
        raise e

def login(username, password):
    res = make_request("http://localhost:8080/api/auth/login", method="POST", data={
        "username": username,
        "password": password
    })
    return res["token"]

def main():
    print("=== STARTING DYNAMIC CLIENT DEMO FLOW ===")
    
    # 1. Login as admin
    admin_token = login("admin", "admin123")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    
    # 2. Get user IDs dynamically
    users = make_request("http://localhost:8080/api/users", headers=admin_headers)
    user_ids = {u["username"]: u["id"] for u in users}
    
    client1_id = user_ids["client1"]
    pm_id = user_ids["manager1"]
    dev_id = user_ids["developer1"]
    qa_id = user_ids["verifier1"]
    
    print(f"Dynamic User IDs:")
    print(f"  client1: {client1_id}")
    print(f"  manager1: {pm_id}")
    print(f"  developer1: {dev_id}")
    print(f"  verifier1: {qa_id}")
    
    # 3. Create Billing Module
    modules = make_request("http://localhost:8080/api/modules", headers=admin_headers)
    billing_module = next((m for m in modules if m["name"] == "Billing Module"), None)
    if billing_module:
        module_id = billing_module["id"]
        print(f"Using Existing Module ID: {module_id}")
    else:
        module = make_request("http://localhost:8080/api/modules", method="POST", headers=admin_headers, data={
            "name": "Billing Module",
            "description": "Billing module for patch management"
        })
        module_id = module["id"]
        print(f"Created Module ID: {module_id}")
    
    # 4. Assign users to Billing Module
    for name, uid in user_ids.items():
        if name in ["client1", "manager1", "developer1", "verifier1"]:
            make_request(f"http://localhost:8080/api/users/{uid}/modules", method="PUT", headers=admin_headers, data={
                "moduleIds": [module_id],
                "reason": "Seeding for demo"
            })
    print("Assigned users to module.")
    
    # 5. Assign managers
    make_request(f"http://localhost:8080/api/users/{dev_id}/managers", method="PUT", headers=admin_headers, data={
        "managerIds": [pm_id],
        "reason": "Assigned pm"
    })
    make_request(f"http://localhost:8080/api/users/{qa_id}/managers", method="PUT", headers=admin_headers, data={
        "managerIds": [pm_id],
        "reason": "Assigned pm"
    })
    print("Hierarchy managers assigned.")
    
    # 6. Login as client1 (CLIENT)
    client1_token = login("client1", "demo123")
    client1_headers = {"Authorization": f"Bearer {client1_token}"}
    
    # 7. Create patch
    patch = make_request("http://localhost:8080/api/tasks", method="POST", headers=client1_headers, data={
        "title": "Fix depreciation calculations",
        "description": "Description Title: Fix deprec calculations\nDescription Type: bug fix\nComments: Ready for pm to progress",
        "moduleId": module_id,
        "clientId": client1_id,
        "managerIds": [pm_id],
        "developerIds": [dev_id],
        "verifierIds": [qa_id],
        "dateGiven": "2026-05-26T18:45:00.000Z",
        "lifecycleStatus": 0,
        "plannedStartDate": "2026-05-26T19:00:00.000Z",
        "plannedEndDate": "2026-05-30T19:00:00.000Z"
    })
    patch_id = patch["id"]
    print(f"Created Patch ID: {patch_id}, Initial Status: {patch['status']}")
    
    # 8. Login as manager1 (MANAGER)
    pm_token = login("manager1", "demo123")
    pm_headers = {"Authorization": f"Bearer {pm_token}"}
    
    # 9. PM moves to PENDING_APPROVAL
    p1 = make_request(f"http://localhost:8080/api/tasks/{patch_id}/status", method="PATCH", headers=pm_headers, data={
        "status": "PENDING_APPROVAL",
        "reason": "Resources assigned, submitting for approval"
    })
    print(f"PM moved patch to: {p1['status']}")
    
    # 10. PM moves to IN_DEVELOPMENT
    p2 = make_request(f"http://localhost:8080/api/tasks/{patch_id}/status", method="PATCH", headers=pm_headers, data={
        "status": "IN_DEVELOPMENT",
        "reason": "Approved, starting development"
    })
    print(f"PM moved patch to: {p2['status']}")
    
    # 11. Login as developer1 (DEVELOPER)
    dev_token = login("developer1", "demo123")
    dev_headers = {"Authorization": f"Bearer {dev_token}"}
    
    # 12. Dev moves to VERIFYING
    p3 = make_request(f"http://localhost:8080/api/tasks/{patch_id}/status", method="PATCH", headers=dev_headers, data={
        "status": "VERIFYING",
        "reason": "Development complete, ready for QA"
    })
    print(f"Dev moved patch to: {p3['status']}")
    
    # 13. Login as verifier1 (VERIFIER)
    qa_token = login("verifier1", "demo123")
    qa_headers = {"Authorization": f"Bearer {qa_token}"}
    
    # 14. QA moves to COMPLETED
    p4 = make_request(f"http://localhost:8080/api/tasks/{patch_id}/status", method="PATCH", headers=qa_headers, data={
        "status": "COMPLETED",
        "reason": "All UAT tests passed"
    })
    print(f"QA moved patch to: {p4['status']}")
    
    print("=== DYNAMIC CLIENT DEMO FLOW COMPLETED SUCCESSFULLY ===")

if __name__ == "__main__":
    main()
