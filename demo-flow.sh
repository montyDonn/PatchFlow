#!/bin/bash
set -e

echo "=== STARTING CLIENT DEMO FLOW ==="

# 1. Login as admin
echo "Logging in as admin..."
ADMIN_LOGIN_RES=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}')
ADMIN_TOKEN=$(echo "$ADMIN_LOGIN_RES" | grep -o '"token":"[^"]*' | grep -o '[^"]*$')
echo "Admin token: $ADMIN_TOKEN"

# 2. Create Billing Module
echo "Creating Billing Module..."
MODULE_RES=$(curl -s -X POST http://localhost:8080/api/modules \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Billing Module","description":"Billing module for patch management"}')
MODULE_ID=$(echo "$MODULE_RES" | grep -o '"id":"[^"]*' | grep -o '[^"]*$')
echo "Module ID: $MODULE_ID"

# 3. Assign users to module
echo "Assigning users to Billing Module..."
for USER_ID in "0786dfee-5713-4c92-9063-605644924335" "f257a0ff-754b-4cd2-b34f-3124f2a71eaf" "0f2d133c-c8a9-43d2-ac14-360ff79941cf" "d4191d4a-ec12-4902-8848-929b7e5ee101"; do
  curl -s -X PUT "http://localhost:8080/api/users/$USER_ID/modules" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"moduleIds\":[\"$MODULE_ID\"],\"reason\":\"Assigned to Billing Module\"}" > /dev/null
done
echo "Users assigned to module."

# 4. Assign managers
echo "Assigning manager1 as manager for developer1 and verifier1..."
curl -s -X PUT "http://localhost:8080/api/users/0f2d133c-c8a9-43d2-ac14-360ff79941cf/managers" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"managerIds":["f257a0ff-754b-4cd2-b34f-3124f2a71eaf"],"reason":"Assigned line manager"}' > /dev/null

curl -s -X PUT "http://localhost:8080/api/users/d4191d4a-ec12-4902-8848-929b7e5ee101/managers" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"managerIds":["f257a0ff-754b-4cd2-b34f-3124f2a71eaf"],"reason":"Assigned line manager"}' > /dev/null

# 5. Login as client1 (CLIENT)
echo "Logging in as client1 (CLIENT)..."
KOMAL_LOGIN_RES=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"client1","password":"demo123"}')
KOMAL_TOKEN=$(echo "$KOMAL_LOGIN_RES" | grep -o '"token":"[^"]*' | grep -o '[^"]*$')
echo "client1 token: $KOMAL_TOKEN"

# 6. Create Patch (Client starts patch)
echo "client1 creating a demo patch..."
PATCH_RES=$(curl -s -X POST http://localhost:8080/api/tasks \
  -H "Authorization: Bearer $KOMAL_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Fix depreciation calculations\",
    \"description\": \"Description Title: Fix deprec calculations\nDescription Type: bug fix\nComments: Ready for pm to progress\",
    \"moduleId\": \"$MODULE_ID\",
    \"clientId\": \"0786dfee-5713-4c92-9063-605644924335\",
    \"managerIds\": [\"f257a0ff-754b-4cd2-b34f-3124f2a71eaf\"],
    \"developerIds\": [\"0f2d133c-c8a9-43d2-ac14-360ff79941cf\"],
    \"verifierIds\": [\"d4191d4a-ec12-4902-8848-929b7e5ee101\"],
    \"dateGiven\": \"2026-05-26T18:45:00.000Z\",
    \"lifecycleStatus\": 0,
    \"plannedStartDate\": \"2026-05-26T19:00:00.000Z\",
    \"plannedEndDate\": \"2026-05-30T19:00:00.000Z\"
  }")

PATCH_ID=$(echo "$PATCH_RES" | grep -o '"id":"[^"]*' | grep -o '[^"]*$')
INITIAL_STATUS=$(echo "$PATCH_RES" | grep -o '"status":"[^"]*' | grep -o '[^"]*$')
echo "Created Patch ID: $PATCH_ID"
echo "Initial Status: $INITIAL_STATUS"

# 7. Login as manager1 (MANAGER)
echo "Logging in as manager1 (MANAGER)..."
PM_LOGIN_RES=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"manager1","password":"demo123"}')
PM_TOKEN=$(echo "$PM_LOGIN_RES" | grep -o '"token":"[^"]*' | grep -o '[^"]*$')
echo "Manager token: $PM_TOKEN"

# 8. PM moves ASSIGNED -> PENDING_APPROVAL
echo "manager1 moving patch to PENDING_APPROVAL..."
STATUS1_RES=$(curl -s -X PATCH "http://localhost:8080/api/tasks/$PATCH_ID/status" \
  -H "Authorization: Bearer $PM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"PENDING_APPROVAL","reason":"Resources assigned, submitting for approval"}')
STATUS1=$(echo "$STATUS1_RES" | grep -o '"status":"[^"]*' | grep -o '[^"]*$')
echo "New Status: $STATUS1"

# 9. PM moves PENDING_APPROVAL -> IN_DEVELOPMENT
echo "manager1 moving patch to IN_DEVELOPMENT..."
STATUS2_RES=$(curl -s -X PATCH "http://localhost:8080/api/tasks/$PATCH_ID/status" \
  -H "Authorization: Bearer $PM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"IN_DEVELOPMENT","reason":"Approved, starting development"}')
STATUS2=$(echo "$STATUS2_RES" | grep -o '"status":"[^"]*' | grep -o '[^"]*$')
echo "New Status: $STATUS2"

# 10. Login as developer1 (DEVELOPER)
echo "Logging in as developer1 (DEVELOPER)..."
DEV_LOGIN_RES=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"developer1","password":"demo123"}')
DEV_TOKEN=$(echo "$DEV_LOGIN_RES" | grep -o '"token":"[^"]*' | grep -o '[^"]*$')
echo "Developer token: $DEV_TOKEN"

# 11. Developer moves IN_DEVELOPMENT -> VERIFYING
echo "developer1 moving patch to VERIFYING..."
STATUS3_RES=$(curl -s -X PATCH "http://localhost:8080/api/tasks/$PATCH_ID/status" \
  -H "Authorization: Bearer $DEV_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"VERIFYING","reason":"Development complete, ready for QA"}')
STATUS3=$(echo "$STATUS3_RES" | grep -o '"status":"[^"]*' | grep -o '[^"]*$')
echo "New Status: $STATUS3"

# 12. Login as verifier1 (VERIFIER)
echo "Logging in as verifier1 (VERIFIER)..."
QA_LOGIN_RES=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"verifier1","password":"demo123"}')
QA_TOKEN=$(echo "$QA_LOGIN_RES" | grep -o '"token":"[^"]*' | grep -o '[^"]*$')
echo "Verifier token: $QA_TOKEN"

# 13. Verifier moves VERIFYING -> COMPLETED
echo "verifier1 moving patch to COMPLETED..."
STATUS4_RES=$(curl -s -X PATCH "http://localhost:8080/api/tasks/$PATCH_ID/status" \
  -H "Authorization: Bearer $QA_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"COMPLETED","reason":"All UAT tests passed"}')
STATUS4=$(echo "$STATUS4_RES" | grep -o '"status":"[^"]*' | grep -o '[^"]*$')
echo "New Status: $STATUS4"

echo "=== CLIENT DEMO FLOW COMPLETED SUCCESSFULLY ==="
