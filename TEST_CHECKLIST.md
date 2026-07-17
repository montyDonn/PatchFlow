# PatchFlow Functional Testing Checklist

This document contains the complete manual functional testing checklist for the **PatchFlow** platform (React Frontend + Spring Boot Backend + MySQL Database).

---

## 1. Authentication & Session Management

### Feature: User Login (Successful)
* **Navigation Path**: `/login`
* **Preconditions**: 
  * A user exists in `change_req_User` with `isActive = true`.
  * The MySQL database is running and accessible.
* **Test Steps**:
  1. Navigate to `/login`.
  2. Input a valid username in the username field.
  3. Input the correct password in the password field.
  4. Click the **Sign in** button.
* **Expected Result**: 
  * User is successfully logged in.
  * Opaque session token is created and stored in local storage (`auth-storage`).
  * User is redirected to `/` (Dashboard).
* **Database Impact**: Inserts a new session record into `change_req_Session` storing the SHA-256 hash of the generated 32-byte opaque token.
* **API Endpoint Involved**: `POST /api/auth/login`
* **Edge Cases**:
  * Inputting username with leading or trailing whitespaces (username lookup should handle whitespace trimming).
  * Very long passwords.
* **Failure Cases**:
  * Entering incorrect password: Shows error "Invalid credentials. Please try again." (HTTP 401).
  * Logging in with a deactivated user (`isActive = false`): Shows error "Invalid credentials. Please try again." (HTTP 401).

---

### Feature: Public Account Request (Self-Registration)
* **Navigation Path**: `/login` -> Click **Request Account Access** button.
* **Preconditions**: None.
* **Test Steps**:
  1. On `/login`, click the **Request Account Access** button.
  2. Select the access type: **Client Access** (`CLIENT`) or **Viewer Access** (`VIEWER`).
  3. Fill in the form: Full Name, Unique Username, Phone Number, Password, Confirm Password.
  4. Click **Submit Request**.
* **Expected Result**: 
  * Access request is registered.
  * Displays success panel with the submitted username and role.
* **Database Impact**: Inserts a record in `change_req_AccountRequest` with `status = 'PENDING'`.
* **API Endpoint Involved**: `POST /api/auth/request-access`
* **Edge Cases**:
  * Registering with a username that is already taken: Shows conflict error.
  * Passwords mismatch: Handled client-side and returns error if submitted.
* **Failure Cases**:
  * Password under 6 characters: Client-side validation stops submission.
  * Backend database down: Displays generic server error.

---

### Feature: User Logout
* **Navigation Path**: Click user dropdown in navigation bar -> Click **Logout** / **Sign out**.
* **Preconditions**: User is logged in.
* **Test Steps**:
  1. Click the profile icon in the sidebar or top header.
  2. Click **Logout**.
  3. Attempt to press the browser "Back" button.
* **Expected Result**: 
  * The local storage session (`auth-storage`) is completely cleared.
  * User is redirected back to `/login`.
  * Pressing the back button does not display authenticated pages.
* **Database Impact**: Deletes the matching session row from `change_req_Session` using the current token hash.
* **API Endpoint Involved**: `POST /api/auth/logout`
* **Edge Cases**:
  * Triggering logout when the network connection is lost: Local state must still be cleared.
* **Failure Cases**:
  * Server fails to respond: Client must force clear storage and redirect anyway.

---

### Feature: Session Validation & Access Control (Opaque Tokens)
* **Navigation Path**: Direct URL navigation to `/patches` or `/admin` when unauthenticated.
* **Preconditions**: Browser cache / local storage is cleared, or user has an invalid/expired token.
* **Test Steps**:
  1. Clear browser local storage.
  2. Type the URL `http://localhost:5173/patches` directly in the browser address bar.
  3. Press Enter.
* **Expected Result**: 
  * The application routes intercept the access.
  * User is immediately redirected back to `/login`.
* **Database Impact**: None.
* **API Endpoint Involved**: Any protected GET/POST/PATCH endpoint (returns HTTP 401 Unauthorized).
* **Edge Cases**:
  * Accessing with a token that exists in local storage but has expired in `change_req_Session` (over 7 days old): Spring Security `AuthTokenFilter` denies access, backend cleans up expired sessions, and frontend redirects to login.
* **Failure Cases**:
  * Token hash modification: Modifying local token results in database mismatch, denying access.

---

## 2. Dashboard

### Feature: Dashboard Stage Count Overview & Filter
* **Navigation Path**: `/` (Dashboard)
* **Preconditions**: User is logged in.
* **Test Steps**:
  1. View the main dashboard page.
  2. Observe the stage summary metrics cards (Draft, Pending Approval, Assigned, In Development, Verifying, Completed, Returned, Rejected, Delayed, On Hold, Cancelled).
  3. Click on the **Pending Approval** stage card.
* **Expected Result**: 
  * The donut chart displays the proportions of total tasks per stage.
  * Clicking a stage card acts as a filter, listing only patches belonging to that stage below.
  * The donut chart center counts update to reflect the count of that filtered stage.
* **Database Impact**: None.
* **API Endpoint Involved**: `GET /api/tasks`, `GET /api/tasks?status=PENDING_APPROVAL`
* **Edge Cases**:
  * Stage containing 0 tasks: Chart portion is absent, and listing shows "No patches in [Stage Name]".
* **Failure Cases**:
  * Backend API fails to return task array: Spinner loops indefinitely or displays error message.

---

### Feature: Dashboard Search
* **Navigation Path**: `/` (Dashboard search bar in header)
* **Preconditions**: User is logged in.
* **Test Steps**:
  1. Locate the **Search for a patch...** search bar on the top right.
  2. Type a task title, task ID, assignee name, or module name (e.g. "NSC").
  3. Observe the displayed content.
* **Expected Result**: 
  * The main page swaps to a **Search Results** panel showing matching tasks.
  * The counts of matches are highlighted.
  * Typing text matches regardless of case (case-insensitive).
* **Database Impact**: None (in-memory frontend filter).
* **API Endpoint Involved**: None.
* **Edge Cases**:
  * Special regex characters in search field.
* **Failure Cases**:
  * No matches: Displays "No patches found matching..." illustration.

---

### Feature: Recent Activity & Deadline Alerts
* **Navigation Path**: `/` (Dashboard - bottom panels)
* **Preconditions**: User is logged in. Tasks exist in the system.
* **Test Steps**:
  1. Observe the **Recent Activity** panel.
  2. Observe the **Deadline Alerts** panel on the right.
* **Expected Result**: 
  * Recent Activity shows up to 8 of the latest tasks sorted by creation date descending.
  * Deadline Alerts list up to 6 active tasks (excluding COMPLETED, REJECTED, CANCELLED) with a defined `plannedEndDate`, sorted by closest deadline first.
  * Click on a task card in either panel.
  * The **PatchDetailsModal** opens.
* **Database Impact**: None.
* **API Endpoint Involved**: `GET /api/tasks` (for listing), `GET /api/tasks/{id}` (upon clicking task).
* **Edge Cases**:
  * No tasks with deadlines: Alerts panel displays blank or fallback text.
* **Failure Cases**:
  * Failure to fetch: Displays loading skeleton or error.

---

## 3. Project Management (System Baseline Container)

### Feature: Automatic Default Project Initialization
* **Navigation Path**: `/modules` -> Add new module.
* **Preconditions**: Logged in as `SUPER_ADMIN`. First-time setup (no projects exist in DB).
* **Test Steps**:
  1. Navigate to `/modules`.
  2. Click **Create Module**.
  3. Enter a unique module name, click Save.
* **Expected Result**: 
  * The backend checks if a project exists.
  * If absent, it automatically initializes **"PatchFlow Default Project"** in the background.
  * The module is successfully created and mapped to this default project ID.
* **Database Impact**: 
  * Inserts a row in `change_req_Project` with project name "PatchFlow Default Project".
  * Inserts a row in `change_req_Module` linked to the project.
* **API Endpoint Involved**: `POST /api/modules`
* **Edge Cases**:
  * Multiple rapid module creations by different admins simultaneously: Database transaction isolation prevents duplicate project rows.
* **Failure Cases**:
  * Database transaction rollbacks.

---

## 4. Module Management

### Feature: Module Creation
* **Navigation Path**: `/modules` -> Click **Create Module** button.
* **Preconditions**: Logged in as `SUPER_ADMIN`.
* **Test Steps**:
  1. Open `/modules` page.
  2. Click **Create Module** to open the dialog.
  3. Input a module name (e.g., "NSC Billing") and description.
  4. Click **Create Module** submit button.
* **Expected Result**: 
  * Dialog closes.
  * Module is added to the table.
* **Database Impact**: Inserts a new row in `change_req_Module`.
* **API Endpoint Involved**: `POST /api/modules`
* **Edge Cases**:
  * Creating a module name that is duplicate of an existing active or inactive module.
* **Failure Cases**:
  * Blank module name: Returns error "Module name is required" (HTTP 400).
  * Duplicate module name: Returns error "Module name must be unique" (HTTP 409).

---

### Feature: Module Editing
* **Navigation Path**: `/modules` -> Locate module row -> Click **Edit** (pencil icon).
* **Preconditions**: Logged in as `SUPER_ADMIN`.
* **Test Steps**:
  1. Click **Edit** on a module row.
  2. Change the name or description in the inline form or modal.
  3. Toggle the **Active** switch off.
  4. Click **Save** / **Update**.
* **Expected Result**: 
  * Details are modified.
  * Deactivated modules display as `Inactive`.
* **Database Impact**: Updates row in `change_req_Module` (`moduleName`, `description`, `isActive`).
* **API Endpoint Involved**: `PATCH /api/modules/{moduleId}`
* **Edge Cases**:
  * Deactivating a module which has pending/draft tasks: Warn or verify impact on task visibility.
* **Failure Cases**:
  * Emptying name: Returns validation error.

---

### Feature: Module Deactivation / Deletion
* **Navigation Path**: `/modules` -> Locate module row -> Click **Delete** (trash icon).
* **Preconditions**: Logged in as `SUPER_ADMIN`.
* **Test Steps**:
  1. Click **Delete** on a module.
  2. Confirm the action.
* **Expected Result**: 
  * If the module has active patches (tasks with status < 100), the deletion is blocked with a warning.
  * Otherwise, the module is marked inactive.
* **Database Impact**: Updates `isActive = false` in `change_req_Module`.
* **API Endpoint Involved**: `DELETE /api/modules/{moduleId}`
* **Edge Cases**:
  * Deleting a module that contains only completed tasks (status `COMPLETED` has lifecycle status >= 100, which allows deactivation).
* **Failure Cases**:
  * Module has active, incomplete tasks: Returns error "Cannot delete module: X active patch(es) are linked to it." (HTTP 409).

---

### Feature: User Module Assignments
* **Navigation Path**: `/assignments`
* **Preconditions**: Logged in as `SUPER_ADMIN` or `MANAGER`. Users and Modules exist.
* **Test Steps**:
  1. Select a user from the dropdown list.
  2. Check the checkboxes for the modules to assign (e.g. NSC, CSC).
  3. Click **Save Assignments**.
* **Expected Result**: 
  * User assignments are updated.
  * Audit logs record the change.
* **Database Impact**: 
  * Inserts/deletes records in join table `change_req_UserModules`.
  * Adds an entry to `change_req_AuditLog`.
* **API Endpoint Involved**: `PUT /api/users/{userId}/modules`
* **Edge Cases**:
  * Assigning more than 5 modules.
* **Failure Cases**:
  * Selecting > 5 modules: Returns bad request error "A user can be assigned to a maximum of 5 modules." (HTTP 400).

---

## 5. Tasks & Patch Board

### Feature: Task Creation (Create Patch)
* **Navigation Path**: `/patches` -> Click **Create Change** button.
* **Preconditions**: Logged in as `SUPER_ADMIN`, `MANAGER`, `CLIENT`, or `DEVELOPER`.
* **Test Steps**:
  1. Click **Create Change** to open modal.
  2. Input: Title, Description.
  3. Select: Module, Team.
  4. Select: Target Managers, Developers, Verifiers.
  5. Select: Planned Start Date, Planned End Date.
  6. Toggle **Is Internal** if needed.
  7. Click **Create**.
* **Expected Result**: 
  * Task is created.
  * Card appears in the **Draft** board column.
* **Database Impact**: 
  * Inserts row in `change_req_Task` with status `DRAFT` and lifecycle status `0`.
  * Inserts assignment links in `change_req_TaskManagers`, `change_req_TaskDevelopers`, `change_req_TaskVerifiers`.
  * Inserts row in `change_req_StatusHistory`.
  * Inserts row in `change_req_AuditLog`.
* **API Endpoint Involved**: `POST /api/tasks`
* **Edge Cases**:
  * Planned end date set before planned start date: Validation should catch this.
* **Failure Cases**:
  * Missing title or module: Fails validation.

---

### Feature: Approve & Assign Workflow (Single Action)
* **Navigation Path**: `/patches` -> Click card in **Pending Approval** column.
* **Preconditions**: User is logged in as `MANAGER` or `SUPER_ADMIN`. Task is in `PENDING_APPROVAL` status.
* **Test Steps**:
  1. Open task details modal.
  2. In the **Approve & Assign** section, select one or more developers, verifiers, and set a planned end date.
  3. Click the **Approve & Assign** action button.
* **Expected Result**: 
  * Task is approved and resources are assigned.
  * Modal updates or closes.
  * Task card moves directly to the **Assigned / In Progress** column.
* **Database Impact**:
  * Updates `status = 'ASSIGNED'` in `change_req_Task`.
  * Updates planned end date and resource join tables.
  * Creates `change_req_StatusHistory` and `change_req_AuditLog` entries.
  * Queues outbound emails/messages to developers/verifiers in `change_req_NotificationStack`.
* **API Endpoint Involved**: `PATCH /api/tasks/{id}/details` (or `POST /api/tasks/{id}/assign`)
* **Edge Cases**:
  * Deactivated resources are selected: Fails validation.
* **Failure Cases**:
  * Missing planned end date or assigned developer.

---

### Feature: Task Status Transitions
* **Navigation Path**: `/patches` -> Click Task card -> Open details modal -> Update Status dropdown.
* **Preconditions**: Task exists. User has role permission to execute target transition.
* **Test Steps**:
  1. Click a task card (e.g. status `ASSIGNED`).
  2. Select new status (e.g., `IN_DEVELOPMENT` or `VERIFYING`).
  3. Provide a change reason comment in the transition comment box.
  4. Click **Confirm Status Change**.
* **Expected Result**: 
  * Status updates.
  * Card moves to correct board column.
  * Transition is logged in history.
* **Database Impact**: 
  * Updates `status` in `change_req_Task`.
  * Inserts row in `change_req_StatusHistory`.
  * Inserts internal notification in `change_req_Notification` for related users.
* **API Endpoint Involved**: `PATCH /api/tasks/{id}/status`
* **Edge Cases**:
  * Rejecting a task: Moving status to `REJECTED` prompts for audit reason.
  * Returning task to developer: Status goes back to `RETURNED_TO_DEVELOPER` / `IN_DEVELOPMENT`.
* **Failure Cases**:
  * Attempting restricted transition (e.g., Client changing status directly to COMPLETED): Blocked with HTTP 403 Forbidden.

---

### Feature: Soft Delete & Restore Task
* **Navigation Path**: `/patches` -> Click Task -> Details Modal -> Click **Delete Change** / **Restore Change**.
* **Preconditions**: Logged in as `SUPER_ADMIN` (for restore), or authorized owner (for delete).
* **Test Steps**:
  1. Click **Delete Change** in details modal, confirm warning.
  2. Task should vanish from default Kanban columns.
  3. Check **Show deleted** checkbox (Super Admin only).
  4. Locate card in **Deleted** column, click it.
  5. Click **Restore Change**.
* **Expected Result**:
  * Deletion sets lifecycleStatus to 100.
  * Restore sets lifecycleStatus to 0, returning card to its previous active status column.
* **Database Impact**: 
  * Updates `lifecycleStatus = 100` (deleted) or `0` (active) in `change_req_Task`.
  * Adds row in `change_req_AuditLog`.
* **API Endpoint Involved**: `DELETE /api/tasks/{id}`, `POST /api/tasks/{id}/restore`
* **Edge Cases**:
  * Searching for soft-deleted tasks without "Show deleted" checked: Must not appear.
* **Failure Cases**:
  * Client tries to delete a task: Blocked.

---

## 6. Discussions & Comments

### Feature: Post Task Comments
* **Navigation Path**: `/patches` -> Open Task Modal -> Comments tab/section.
* **Preconditions**: User has read access to the task.
* **Test Steps**:
  1. Open task modal, scroll to comments.
  2. Type a text message in the comment box.
  3. Click **Post Comment**.
* **Expected Result**: 
  * Comment appears in the discussion timeline.
  * Author name and role (e.g. `[MANAGER]`) are displayed correctly.
* **Database Impact**: Inserts a new row in `change_req_TaskComment`.
* **API Endpoint Involved**: `POST /api/tasks/{id}/comments`
* **Edge Cases**:
  * Special HTML characters or scripts (SQL injection or XSS payload) in comment text: Should be HTML-escaped/sanitized.
* **Failure Cases**:
  * Submitting empty text: Blocked by validation.

---

## 7. File Attachments

### Feature: Upload Task Attachments
* **Navigation Path**: `/patches` -> Open Task Modal -> Attachments tab/section.
* **Preconditions**: User is logged in. Task details modal is open.
* **Test Steps**:
  1. Locate the file upload input.
  2. Click browse and choose a file (e.g. `error_log.txt`, size 5MB).
  3. Click **Upload**.
* **Expected Result**: 
  * Progress indicator completes.
  * File appears in attachments list.
  * Clicking file name downloads it.
* **Database Impact**: Inserts a record in `change_req_TaskAttachment`.
* **API Endpoint Involved**: `POST /api/tasks/{id}/attachments`
* **Edge Cases**:
  * Uploading files with duplicate names: Server renames/hashes filename to avoid collisions.
  * Uploading files larger than 20MB: Blocked by Spring Boot multipart size limits.
* **Failure Cases**:
  * Uploading empty files or disconnected network midway: File is not saved, error displayed.

---

## 8. Notification System & Queue Bridge

### Feature: Notification Center (UI)
* **Navigation Path**: Header bell icon.
* **Preconditions**: User has pending unread notifications in database.
* **Test Steps**:
  1. Log in.
  2. Click the bell icon in the header.
  3. Observe list of notifications.
  4. Click on an unread notification (or **Mark all as read**).
* **Expected Result**: 
  * Displays unread notifications.
  * Notification updates to read state (indicator dot disappears).
* **Database Impact**: Updates `read = true` in `change_req_Notification`.
* **API Endpoint Involved**: `GET /api/notifications`, `PATCH /api/notifications/{id}/read`
* **Edge Cases**:
  * Rapidly clicking read on multiple notifications.
* **Failure Cases**:
  * Failed to load: Dropdown remains blank.

---

### Feature: Outbound Notification Queue & Bridge Scheduler
* **Navigation Path**: Automatic background feature.
* **Preconditions**: 
  * User profile preference settings: `notifyEmail = true`, `notifySms = true`, or `notifyWhatsapp = true`.
  * Background Spring Boot worker scheduler is active.
* **Test Steps**:
  1. As Admin/Manager, assign a developer to a task.
  2. Check database `change_req_NotificationStack` table.
  3. Monitor scheduler logs or external email/SMS/WhatsApp deliveries.
* **Expected Result**:
  * Tasks actions queue notifications in `change_req_NotificationStack`.
  * The `NotificationQueueScheduler` executes every 10 seconds.
  * Sends Email via SMTP (Port 25, mail server `10.1.2.50`).
  * Sends SMS via Phoenix Billing SOAP Service (`http://10.1.2.60:8080/metering/SmsStack`).
  * Sends WhatsApp via SMSGupshup REST GET (`https://mediaapi.smsgupshup.com/GatewayAPI/rest?`).
  * Status updates from `PENDING` to `SENT`.
* **Database Impact**: Updates status, `processedAt`, `retryCount`, and `errorMessage` on failure in `change_req_NotificationStack`.
* **API Endpoint Involved**: Internally triggered. Calls external SMTP, SOAP, and REST APIs.
* **Edge Cases**:
  * Outbound channels offline: Scheduler retries up to 3 times before setting status to `FAILED`.
  * XML character escaping inside SOAP body: SMS XML tags must remain valid when message text contains special symbols (`<`, `>`, `&`).
* **Failure Cases**:
  * Outbound API credentials invalid: Error captured, logged in db error column, marked `FAILED` after 3 retries.

---

## 9. Users Directory (Admin Panel)

### Feature: User Creation
* **Navigation Path**: `/admin` (User directory page) -> Click **Add User** / **Create User**.
* **Preconditions**: Logged in as `SUPER_ADMIN`.
* **Test Steps**:
  1. Click **Create User**.
  2. Input: Username, Name, Password, Designation, Role, Phone, Email.
  3. Click **Save**.
* **Expected Result**:
  * Dialog closes.
  * New user appears in active directory list.
* **Database Impact**: Inserts row in `change_req_User`, logs to `change_req_AuditLog`.
* **API Endpoint Involved**: `POST /api/users`
* **Edge Cases**:
  * Password under 8 characters: Blocked by backend validation (HTTP 400).
  * Duplicate username: Blocked by backend constraint (HTTP 409 Conflict).
* **Failure Cases**:
  * Leaving mandatory fields (username/name/password) blank.

---

### Feature: Edit User & Resource Hierarchy Mapping
* **Navigation Path**: `/admin` -> Click **Edit** on user -> Select Manager assignments.
* **Preconditions**: Logged in as `SUPER_ADMIN`.
* **Test Steps**:
  1. Click edit on a Developer.
  2. Modify role or contact details.
  3. Map subordinate to Managers (select up to 3 managers).
  4. Click **Save**.
* **Expected Result**: 
  * Details and hierarchy saved.
  * Audit logs created.
* **Database Impact**:
  * Updates `change_req_User`.
  * Clears and updates links in `change_req_UserManager`.
  * Logs to `change_req_AuditLog`.
* **API Endpoint Involved**: `PATCH /api/users/{userId}`, `PUT /api/users/{userId}/managers`
* **Edge Cases**:
  * Attempting to assign more than 3 managers to one employee.
* **Failure Cases**:
  * Assigning > 3 managers: Returns error "A user can be assigned to a maximum of 3 managers." (HTTP 400).

---

### Feature: Password Reset & Deactivation
* **Navigation Path**: `/admin` -> User row -> Click **Reset Password** / **Deactivate**.
* **Preconditions**: Logged in as `SUPER_ADMIN`.
* **Test Steps**:
  1. Click **Reset Password** on a user.
  2. Observe output dialog.
  3. Click **Deactivate** on another user.
  4. Attempt to log in with that deactivated user.
* **Expected Result**:
  * Reset Password generates a 16-character temporary hex password, invalidates active sessions, and hashes it.
  * Deactivation flags user inactive and terminates current session. Inactive user fails to login.
* **Database Impact**:
  * Updates `passwordHash` or `isActive` in `change_req_User`.
  * Deletes rows in `change_req_Session`.
  * Logs to `change_req_AuditLog`.
* **API Endpoint Involved**: `POST /api/users/{userId}/reset-password`, `DELETE /api/users/{userId}`
* **Edge Cases**:
  * Admin deactivating their own active profile.
* **Failure Cases**:
  * Unauthorized user calls endpoints: Returns HTTP 403.

---

## 10. Role-Based Access Control (RBAC)

### Feature: Route & Endpoint Protection
* **Navigation Path**: Direct URL access or UI button visibility.
* **Preconditions**: Accounts with different roles exist (`SUPER_ADMIN`, `MANAGER`, `DEVELOPER`, `CLIENT`).
* **Test Steps**:
  1. Log in as `DEVELOPER` -> Attempt to navigate to `/admin` or execute `POST /api/users`.
  2. Log in as `CLIENT` -> Attempt to view `/reports` or call `GET /api/reports/data`.
  3. Log in as `MANAGER` -> Attempt to reset a user's password.
* **Expected Result**:
  * Unprivileged UI elements (like Admin Panel sidebar links) are hidden.
  * Manual URL paths redirect to `/` or show error layouts.
  * Direct backend API calls return HTTP 403 Forbidden.
* **Database Impact**: None.
* **API Endpoint Involved**: Protected endpoints under `/api/admin/**`, `/api/users/**`, `/api/reports/**`.
* **Edge Cases**:
  * Multi-role accounts (if any).
* **Failure Cases**:
  * Unauthenticated session accessing private routes.

---

## 11. Reports & Auditing

### Feature: Audit Logs & Transition Reports
* **Navigation Path**: `/reports`
* **Preconditions**: Logged in as `SUPER_ADMIN` or `MANAGER`. Active records exist in logs.
* **Test Steps**:
  1. Navigate to `/reports`.
  2. View **Audit Logs** and **Status History**.
  3. Use filters: Module, Date Range, Developer, Manager, Status.
  4. Click **Export to Excel** (Excel download).
* **Expected Result**:
  * Report lists matching transition metrics.
  * Export yields a populated `.xlsx` document containing filtered data.
  * Row visibility restrictions apply (Managers see their subordinate's details, Admins see all).
* **Database Impact**: None.
* **API Endpoint Involved**: `GET /api/reports/history`, `GET /api/reports/data`
* **Edge Cases**:
  * Exporting with thousands of historical records: Must complete without timeout.
* **Failure Cases**:
  * Accessing reports as Developer or Verifier: Returns HTTP 403 Forbidden.

---

## 12. Settings & Profile Settings

### Feature: Personal Settings Update
* **Navigation Path**: `/settings`
* **Preconditions**: User is logged in.
* **Test Steps**:
  1. Modify Full Name, Email, Phone Number, or Designation.
  2. Click **Save Settings**.
* **Expected Result**:
  * Details are saved.
  * Left-side profile summary updates instantly.
* **Database Impact**: Updates columns in `change_req_User` for the current `userId`.
* **API Endpoint Involved**: `PUT /api/users/me`, `GET /api/users/me`
* **Edge Cases**:
  * Entering empty phone or email (allowed, maps to SQL NULL).
* **Failure Cases**:
  * Connection lost.

---

### Feature: Change Password
* **Navigation Path**: `/settings` -> Change Password section.
* **Preconditions**: User is logged in.
* **Test Steps**:
  1. Input current password.
  2. Input new password (>= 8 characters).
  3. Input matching confirm password.
  4. Click **Update Password**.
* **Expected Result**:
  * Success message displays.
  * Active sessions are deleted.
  * Automatically logs out user and redirects to `/login` after a 2-second delay.
* **Database Impact**: Updates `passwordHash` in `change_req_User`, deletes all session tokens in `change_req_Session`.
* **API Endpoint Involved**: `POST /api/users/me/change-password`
* **Edge Cases**:
  * Setting new password same as current password: Returns bad request error (HTTP 400).
* **Failure Cases**:
  * Passwords mismatch: Blocked.
  * Current password incorrect: Returns error "Invalid current password" (HTTP 400).
  * Password under 8 characters: Returns bad request error.

---

## 13. Search, Filters, Sorting & Pagination

### Feature: Board & Table Filters
* **Navigation Path**: `/patches` (Change Board)
* **Preconditions**: User is logged in.
* **Test Steps**:
  1. Select a module from the **All Modules** dropdown.
  2. Select an assignee from the **All Assignees** dropdown.
  3. Input search keyword in search bar.
  4. Toggle **Show deleted** checkbox.
* **Expected Result**:
  * The tasks array matches all applied query parameters simultaneously.
  * If a filter changes, columns render state automatically.
* **Database Impact**: None.
* **API Endpoint Involved**: `GET /api/tasks` (with optional `includeDeleted=true`).
* **Edge Cases**:
  * Conflicting filters (e.g. Module NSC and Assignee Developer who doesn't work on NSC): Shows blank board columns.
* **Failure Cases**:
  * Backend returns empty task array: Columns render empty.

---

## 14. Pre-Deployment Smoke Test Checklist

Execute these checks on the staging/production build target before completing release approvals.

### Phase 1: Environment & Health Validation
- [ ] **Health Endpoint Verification**: Hit `https://<domain>/health` and ensure it returns HTTP 200 with content `OK`.
- [ ] **Database Connection Health**: Verify logs for successful pool allocation (e.g., `HikariPool-1 - Start completed`).
- [ ] **Static Assets Integrity**: Load the root login page, verify assets (`logo.png`, styles) compile and load without 404s.

### Phase 2: Core Authentication Checks
- [ ] **Admin Default Seeding**: Attempt sign-in with default seeded admin credentials.
- [ ] **Account Self-Registration**: Submit a public access request. Log in as Super Admin and verify the request appears in the administration log, approve it, and test login with the newly created account.
- [ ] **Deactivation Validation**: Deactivate the created account. Verify the session is instantly revoked and login is denied.

### Phase 3: Patch Workflow Verification
- [ ] **Task Creation**: Create a task card in the board. Confirm it enters `DRAFT` status.
- [ ] **Resource Allocation & Approve**: Move task to `PENDING_APPROVAL`, trigger the **Approve & Assign** action, set a deadline and assign resources. Verify it moves directly to the `ASSIGNED` column.
- [ ] **Status History Integrity**: Check that the status history tab lists correct actor details, timestamps, and stage changes.
- [ ] **Soft Delete and Restore**: Delete the patch, check "Show deleted", and restore it. Verify it returns to the active flow.

### Phase 4: Integrations & Notifications
- [ ] **Local Inbox Verification**: Trigger task assignments and confirm notifications show in the bell menu.
- [ ] **Outbound Notification Dispatch**: Verify background scheduler log entries (`Found X pending external notifications to process`). Check test emails/messages are delivered via SMTP, SMS SOAP, and WhatsApp Gupshup.
- [ ] **File Attachments**: Upload a test PDF file (~2MB). Verify it saves to the `./uploads` directory and is downloadable from the modal.

### Phase 5: Reporting & Security Boundaries
- [ ] **Analytical Exports**: Generate a custom date range report. Download the Excel export and verify formatting.
- [ ] **Forbidden Route Blocks**: Sign in as Developer. Manually type `/admin` in the browser address bar. Verify access is blocked and redirects to dashboard.
- [ ] **Token Expungement**: Change your profile password. Verify you are automatically logged out, redirected to the login panel, and old active sessions are revoked.
