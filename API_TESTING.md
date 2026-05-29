# PatchFlow API Manual Testing Guide (Postman)

Use this guide to manually test all backend endpoints. Replace `{{base_url}}` with your actual backend URL (e.g., `http://localhost:8080`) and `{{token}}` with the JWT token obtained from the login endpoint.

## 1. Authentication
### Login
- **Method:** `POST`
- **URL:** `{{base_url}}/api/auth/login`
- **Body (JSON):**
  ```json
  {
    "username": "admin",
    "password": "password"
  }
  ```

### Register (Admin only)
- **Method:** `POST`
- **URL:** `{{base_url}}/api/auth/register`
- **Headers:** `Authorization: Bearer {{token}}`
- **Body (JSON):**
  ```json
  {
    "username": "newuser",
    "password": "password123",
    "name": "New User",
    "role": "DEVELOPER"
  }
  ```

### Current User Details
- **Method:** `GET`
- **URL:** `{{base_url}}/api/auth/me`
- **Headers:** `Authorization: Bearer {{token}}`

### Logout
- **Method:** `POST`
- **URL:** `{{base_url}}/api/auth/logout`
- **Headers:** `Authorization: Bearer {{token}}`

---

## 2. Tasks (Patches)
### Create Task
- **Method:** `POST`
- **URL:** `{{base_url}}/api/tasks`
- **Headers:** `Authorization: Bearer {{token}}`
- **Body (JSON):**
  ```json
  {
    "title": "Bug Fix #123",
    "description": "Fixing the login issue",
    "moduleId": "module-id-here",
    "developerIds": ["dev-user-id"],
    "isInternal": false
  }
  ```

### List Tasks
- **Method:** `GET`
- **URL:** `{{base_url}}/api/tasks?status=OPEN&includeDeleted=false`
- **Headers:** `Authorization: Bearer {{token}}`

### Get Task Details
- **Method:** `GET`
- **URL:** `{{base_url}}/api/tasks/{id}`
- **Headers:** `Authorization: Bearer {{token}}`

### Update Task Status
- **Method:** `PATCH`
- **URL:** `{{base_url}}/api/tasks/{id}/status`
- **Headers:** `Authorization: Bearer {{token}}`
- **Body (JSON):**
  ```json
  {
    "status": "IN_PROGRESS",
    "reason": "Started working on this"
  }
  ```

### Add Comment to Task
- **Method:** `POST`
- **URL:** `{{base_url}}/api/tasks/{id}/comments`
- **Headers:** `Authorization: Bearer {{token}}`
- **Body (JSON):**
  ```json
  {
    "content": "I have completed the investigation."
  }
  ```

### Update Task Details
- **Method:** `PATCH`
- **URL:** `{{base_url}}/api/tasks/{id}/details`
- **Headers:** `Authorization: Bearer {{token}}`
- **Body (JSON):**
  ```json
  {
    "title": "Updated Title",
    "description": "Updated Description"
  }
  ```

---

## 3. Users
### List Users
- **Method:** `GET`
- **URL:** `{{base_url}}/api/users?role=DEVELOPER&includeModules=true`
- **Headers:** `Authorization: Bearer {{token}}`

### Create User (Admin only)
- **Method:** `POST`
- **URL:** `{{base_url}}/api/users`
- **Headers:** `Authorization: Bearer {{token}}`
- **Body (JSON):**
  ```json
  {
    "username": "jdoe",
    "password": "securepassword",
    "name": "John Doe",
    "role": "DEVELOPER",
    "designation": "Software Engineer"
  }
  ```

### Update User
- **Method:** `PATCH`
- **URL:** `{{base_url}}/api/users/{userId}`
- **Headers:** `Authorization: Bearer {{token}}`
- **Body (JSON):**
  ```json
  {
    "name": "John Updated",
    "role": "MANAGER"
  }
  ```

---

## 4. Modules
### List Modules
- **Method:** `GET`
- **URL:** `{{base_url}}/api/modules`
- **Headers:** `Authorization: Bearer {{token}}`

### Create Module (Admin only)
- **Method:** `POST`
- **URL:** `{{base_url}}/api/modules`
- **Headers:** `Authorization: Bearer {{token}}`
- **Body (JSON):**
  ```json
  {
    "name": "Authentication Module",
    "description": "Handles login and registration"
  }
  ```

---

## 5. Reports & History
### Get History (Audit Logs & Status History)
- **Method:** `GET`
- **URL:** `{{base_url}}/api/reports/history`
- **Headers:** `Authorization: Bearer {{token}}`

### Get Report Data
- **Method:** `GET`
- **URL:** `{{base_url}}/api/reports/data?view=monthly&status=COMPLETED`
- **Headers:** `Authorization: Bearer {{token}}`

---

## 6. Notifications
### List My Notifications
- **Method:** `GET`
- **URL:** `{{base_url}}/api/notifications`
- **Headers:** `Authorization: Bearer {{token}}`

### Mark Notification as Read
- **Method:** `PATCH`
- **URL:** `{{base_url}}/api/notifications/{id}/read`
- **Headers:** `Authorization: Bearer {{token}}`

---

## 7. System
### Health Check
- **Method:** `GET`
- **URL:** `{{base_url}}/health`
