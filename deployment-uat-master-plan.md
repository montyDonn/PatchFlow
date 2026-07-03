# PatchFlow Deployment Readiness & UAT Master Plan

## Executive Summary

The objective of this Master Plan is to validate the complete PatchFlow application lifecycle—from account onboarding through final patch deployment.

This User Acceptance Testing (UAT) phase ensures that the system is ready for production by simulating actual, real-world business usage. Rather than testing isolated API endpoints, this plan outlines comprehensive end-to-end business scenarios where actions performed by one role organically trigger required actions for another role.

**Primary roles involved in UAT:**
* **Admin:** System configuration, user administration, and access management.
* **Manager:** Resource assignment, oversight, approvals, and final deployment signaling.
* **Client:** Patch request creation, communication, and issue tracking.
* **Developer:** Task implementation, evidence upload, and status progression.
* **Verifier:** Quality assurance and verification of developer implementation.

---

## Scenario 1 – First-Time System Setup

**Objective:** Validate that the system can be bootstrapped from scratch by an Admin.
**Roles involved:** Admin
**Preconditions:** Fresh deployment with a single root Admin user.

**Step-by-step execution:**
1. Login as Admin.
2. Create Team (e.g., "Core Banking Team").
3. Create Project (e.g., "UPCL Modernization").
4. Create Modules (e.g., "NSC", "Billing").
5. Create Users (Managers, Clients, Developers, Verifiers).
6. Assign Manager relationships (Developer → Manager).
7. Assign Users to specific Modules.

**Controllers exercised:**
* `UserController`
* `ModuleController`
* `TeamController`

**Database tables exercised:**
* `change_req_User`
* `change_req_Project`
* `change_req_Module`
* `change_req_Team`
* `change_req_UserModules`
* `change_req_UserManager`

**Expected outcome:** All entities are created successfully. Users can log in. Hierarchy and module mappings are persisted.
**Pass/Fail:** [ ] Pass / [ ] Fail

---

## Scenario 2 – Account Request Lifecycle

**Objective:** Validate the self-service account onboarding workflow.
**Roles involved:** New Employee, Manager, Admin
**Preconditions:** Public registration portal is accessible.

**Step-by-step execution:**
1. New Employee submits an account request via the public portal.
2. Manager reviews the pending request.
3. Manager approves the request in the system.
4. Admin provisions the actual account with a role.
5. Admin assigns module access to the new account.
6. New Employee logs in with assigned credentials.
7. New Employee updates their user profile.

**Controllers exercised:**
* `AccountRequestController`
* `AuthController`
* `UserController`

**Database tables exercised:**
* `change_req_AccountRequest`
* `change_req_User`
* `change_req_Session`
* `change_req_AuditLog`
* `change_req_Notification`

**Expected outcome:** The unauthenticated request successfully converts into an authenticated, fully-permissioned User account.
**Pass/Fail:** [ ] Pass / [ ] Fail

---

## Scenario 3 – Happy Path Patch Lifecycle

**Objective:** Validate the core business pipeline from request to deployment. *(This is the most critical business scenario.)*
**Roles involved:** Client, Manager, Developer, Verifier
**Preconditions:** Setup from Scenario 1 is complete.

**Step-by-step execution:**
1. Client logs in.
2. Client creates a patch/change request.
3. Client uploads supporting attachment.
4. Client submits task.
5. Manager reviews task.
6. Manager adds a clarifying comment.
7. Manager assigns a Developer.
8. Manager assigns a Verifier.
9. Manager approves task for work.
10. Developer starts work.
11. Developer adds progress comments.
12. Developer uploads implementation evidence (e.g., screenshots, logs).
13. Developer moves status: `OPEN` → `IN_PROGRESS`.
14. Developer moves status: `IN_PROGRESS` → `DEV_COMPLETE`.
15. Verifier reviews the developer's work.
16. Verifier adds QA comments.
17. Verifier moves status: `DEV_COMPLETE` → `VERIFIED`.
18. Manager reviews verification artifacts.
19. Manager moves status: `VERIFIED` → `DEPLOYED`.

**Controllers exercised:**
* `TaskController`
* `NotificationController`
* `ReportController`

**Database tables exercised:**
* `change_req_Task`
* `change_req_TaskComment`
* `change_req_TaskAttachment`
* `change_req_TaskManagers`
* `change_req_TaskDevelopers`
* `change_req_TaskVerifiers`
* `change_req_StatusHistory`
* `change_req_Notification`
* `change_req_AuditLog`

**Expected outcome:** A task smoothly transitions through its entire lifecycle with all handoffs, attachments, and comments properly recorded and visible to the respective roles.
**Pass/Fail:** [ ] Pass / [ ] Fail

---

## Scenario 4 – Rejection Flow

**Objective:** Validate that bad requests can be stopped and corrected.
**Roles involved:** Client, Manager
**Preconditions:** None.

**Step-by-step execution:**
1. Client creates a patch request with missing details.
2. Manager reviews and rejects the patch, providing a rejection reason comment.
3. Client receives notification, updates the patch, and resubmits.
4. Manager reviews the updated patch and approves it.

**Validate:**
* Status transitions accurately reflect rejection and resubmission.
* Comments are preserved.
* Notifications fire correctly.
* Audit logs track the rejection.

**Expected outcome:** The workflow correctly handles blockages without losing data.
**Pass/Fail:** [ ] Pass / [ ] Fail

---

## Scenario 5 – Rework Flow

**Objective:** Validate the QA loop when verification fails.
**Roles involved:** Client, Manager, Developer, Verifier
**Preconditions:** None.

**Step-by-step execution:**
1. Client creates a patch. Manager approves. Developer completes it (`DEV_COMPLETE`).
2. Verifier reviews and finds a bug.
3. Verifier rejects the implementation (Status moves to `REWORK`).
4. Developer updates code and adds a comment explaining the fix.
5. Developer resubmits (`DEV_COMPLETE`).
6. Verifier approves (`VERIFIED`).
7. Manager deploys (`DEPLOYED`).

**Validate:**
* `REWORK` workflow transitions backwards securely.
* Multiple status transitions are accurately tracked in `StatusHistory`.
* Repeated notifications are sent without spamming.
* Audit entries capture the back-and-forth.

**Expected outcome:** The system properly facilitates iterative development cycles.
**Pass/Fail:** [ ] Pass / [ ] Fail

---

## Scenario 6 – Multi-Developer Assignment

**Objective:** Validate many-to-many relationship mappings.
**Roles involved:** Manager, Multiple Developers
**Preconditions:** Multiple Developer accounts exist.

**Step-by-step execution:**
1. Manager assigns Developer1, Developer2, and Developer3 to a single heavy task.
2. All three developers access the task simultaneously.
3. All three developers add distinct comments.
4. All three developers upload separate attachments.

**Validate:**
* `change_req_TaskDevelopers` tracks all three.
* `change_req_TaskComment` attributes comments to the correct author.
* `change_req_TaskAttachment` attributes files to the correct uploader.

**Expected outcome:** The task supports concurrent collaboration seamlessly.
**Pass/Fail:** [ ] Pass / [ ] Fail

---

## Scenario 7 – Manager Hierarchy

**Objective:** Validate reporting visibility across management tiers.
**Roles involved:** Admin, ManagerA, ManagerB, DeveloperA
**Preconditions:** None.

**Step-by-step execution:**
1. Admin creates ManagerA, ManagerB, and DeveloperA.
2. Admin assigns DeveloperA → ManagerA.
3. DeveloperA creates and completes tasks.
4. ManagerA pulls reports.
5. ManagerB pulls reports.

**Verify:**
* ManagerA sees DeveloperA's tasks in their dashboard/reports.
* ManagerB cannot see DeveloperA's tasks (unless globally permitted).
* `UserManager` mappings strictly enforce visibility.

**Expected outcome:** Data isolation between managerial silos is maintained.
**Pass/Fail:** [ ] Pass / [ ] Fail

---

## Scenario 8 – Module Authorization

**Objective:** Validate horizontal access restrictions.
**Roles involved:** Admin, Developer
**Preconditions:** Multiple modules exist (e.g., NSC, CSC, DND, Billing).

**Step-by-step execution:**
1. Admin assigns Developer strictly to the "NSC" module.
2. Developer attempts to view NSC tasks.
3. Developer attempts to view or edit tasks in CSC, DND, or Billing.
4. Admin attempts to view all modules.

**Verify:**
* Developer can successfully access NSC data.
* Developer receives `403 Forbidden` or filtered empty lists for CSC, DND, Billing.
* Admin successfully accesses all modules regardless of explicit mapping.

**Expected outcome:** `UserModules` mapping enforces strict data boundaries.
**Pass/Fail:** [ ] Pass / [ ] Fail

---

## Scenario 9 – Notification Validation

**Objective:** Validate system alerts and messaging.
**Roles involved:** All Roles
**Preconditions:** System is actively used.

**Step-by-step execution:**
Trigger the following events across different test accounts:
1. Task assignment.
2. Task approval.
3. Task rejection.
4. Task comment.
5. Task verification.
6. Task deployment.

**Verify:**
* A corresponding row is created in `change_req_Notification`.
* Notifications appear correctly in the target user's UI.
* `read`/`unread` status toggles correctly when dismissed.

**Expected outcome:** Users are reliably informed of events requiring their attention.
**Pass/Fail:** [ ] Pass / [ ] Fail

---

## Scenario 10 – Reporting Validation

**Objective:** Validate aggregated data accuracy.
**Roles involved:** Manager, Admin
**Preconditions:** All previous scenarios (1-9) have been executed, generating rich dummy data.

**Step-by-step execution:**
Pull reports using `ReportController` to validate:
1. Total Tasks by module.
2. Total Tasks by status.
3. Tasks assigned to specific developers.
4. Queue of tasks pending verification.
5. Queue of tasks pending deployment.
6. Total completed work.

**Verify:**
* Cross-check the API report totals directly against a raw SQL `COUNT(*)` in the database.

**Expected outcome:** Dashboard analytics perfectly mirror the underlying transactional database.
**Pass/Fail:** [ ] Pass / [ ] Fail

---

## Scenario 11 – Session Security

**Objective:** Validate authentication mechanisms and opaque token handling.
**Roles involved:** Any User
**Preconditions:** None.

**Step-by-step execution:**
1. User logs in.
2. User opens the application in multiple browser tabs.
3. User logs out from one tab.
4. User attempts an API request from the other tabs.
5. User logs back in.

**Verify:**
* Explicit logout instantly invalidates the session token in `change_req_Session`.
* Protected APIs immediately return `401 Unauthorized` on the stale tabs.
* Re-login generates a new session and restores access.

**Expected outcome:** The system strictly enforces token lifecycle and prevents unauthorized access via stale sessions.
**Pass/Fail:** [ ] Pass / [ ] Fail

---

## Scenario 12 – User Administration

**Objective:** Validate user lifecycle management.
**Roles involved:** Admin, Employee
**Preconditions:** None.

**Step-by-step execution:**
1. Admin creates a new user.
2. Admin edits user profile details.
3. Admin disables the user account.
4. Employee attempts to log in (should fail).
5. Admin enables the user account.
6. Admin updates Manager and Module assignments.

**Validate:**
* Authorization blocks disabled users from authenticating.
* `AuditLog` captures all administrative modifications.
* Changes reflect immediately.

**Expected outcome:** Administrators have absolute, audited control over user lifecycles.
**Pass/Fail:** [ ] Pass / [ ] Fail

---

## Scenario 13 – Persistence & Recovery

**Objective:** Validate database durability and stateless application recovery.
**Roles involved:** DevOps/Admin
**Preconditions:** Application contains data.

**Step-by-step execution:**
1. Ensure Projects, Modules, Tasks, Comments, and Attachments exist.
2. Gracefully kill the Spring Boot application.
3. Restart the Spring Boot application.
4. Attempt to log in with an existing active session token.
5. Navigate through tasks and reports.

**Verify:**
* All data persists intact in PostgreSQL.
* Because session state is stored in the DB (not in-memory), login sessions survive the restart.
* Application resumes normal functionality immediately.

**Expected outcome:** The system is resilient to restarts and downtime.
**Pass/Fail:** [ ] Pass / [ ] Fail

---

## Endpoint Coverage Matrix

| Controller | Endpoint | Method | Role | Scenario Covered In |
| ---------- | -------- | ------ | ---- | ------------------- |
| `AccountRequestController` | `/api/auth/request-access` | POST | Public | Scenario 2 |
| `AccountRequestController` | `/api/admin/account-requests` | GET | Admin | Scenario 2 |
| `AccountRequestController` | `/api/admin/account-requests/{id}/approve` | POST | Admin/Manager | Scenario 2 |
| `AccountRequestController` | `/api/admin/account-requests/{id}/reject` | POST | Admin/Manager | Scenario 2 |
| `AuthController` | `/api/auth/login` | POST | Public | Scenario 1, 11 |
| `AuthController` | `/api/auth/register` | POST | Admin | Scenario 1, 12 |
| `AuthController` | `/api/auth/me` | GET | All | Scenario 1 |
| `AuthController` | `/api/auth/logout` | POST | All | Scenario 11 |
| `HealthController` | `/health` | GET | Public | Scenario 13 |
| `ModuleController` | `/api/modules` | GET | All | Scenario 1, 8 |
| `ModuleController` | `/api/modules/hierarchy` | GET | Admin/Manager | Scenario 1, 8 |
| `ModuleController` | `/api/modules/{moduleId}` | GET | All | Scenario 8 |
| `ModuleController` | `/api/modules` | POST | Admin | Scenario 1 |
| `ModuleController` | `/api/modules/{moduleId}` | PATCH | Admin | Scenario 1 |
| `ModuleController` | `/api/modules/{moduleId}` | DELETE | Admin | Scenario 1 |
| `NotificationController` | `/api/notifications` | GET | All | Scenario 9 |
| `NotificationController` | `/api/notifications/{id}/read` | PATCH | All | Scenario 9 |
| `ReportController` | `/api/reports/history` | GET | Manager/Admin | Scenario 10 |
| `ReportController` | `/api/reports/data` | GET | Manager/Admin | Scenario 10 |
| `TaskController` | `/api/tasks` | POST | Client | Scenario 3 |
| `TaskController` | `/api/tasks` | GET | All | Scenario 3, 10 |
| `TaskController` | `/api/tasks/{id}` | GET | All | Scenario 3 |
| `TaskController` | `/api/tasks/{id}/status` | PATCH | Dev/Ver/Mgr | Scenario 3, 4, 5 |
| `TaskController` | `/api/tasks/{id}/comments` | POST | All | Scenario 3, 6 |
| `TaskController` | `/api/tasks/{id}/attachments`| POST | All | Scenario 3, 6 |
| `TaskController` | `/api/tasks/{id}` | DELETE | Admin | Scenario 4 |
| `TaskController` | `/api/tasks/{id}/restore` | POST | Admin | Scenario 4 |
| `TaskController` | `/api/tasks/{id}/assign` | POST | Manager | Scenario 3, 6 |
| `TaskController` | `/api/tasks/{id}/details` | PATCH | Dev/Mgr | Scenario 3 |
| `TeamController` | `/api/teams` | GET | All | Scenario 1 |
| `UserController` | `/api/users` | GET | Admin/Manager | Scenario 1, 12 |
| `UserController` | `/api/users` | POST | Admin | Scenario 1, 12 |
| `UserController` | `/api/users/{userId}/modules`| GET | Admin | Scenario 1, 8 |
| `UserController` | `/api/users/{userId}/modules`| PUT | Admin | Scenario 1, 8 |
| `UserController` | `/api/users/{userId}/managers`| PUT | Admin | Scenario 1, 7 |
| `UserController` | `/api/users/{userId}/reset-password`| POST | Admin | Scenario 12 |
| `UserController` | `/api/users/{userId}` | DELETE | Admin | Scenario 12 |
| `UserController` | `/api/users/{userId}/reactivate`| PATCH | Admin | Scenario 12 |
| `UserController` | `/api/users/me` | GET | All | Scenario 1 |
| `UserController` | `/api/users/me` | PUT | All | Scenario 2 |
| `UserController` | `/api/users/{userId}` | PATCH | Admin | Scenario 12 |

*Note: All endpoints are marked as **Covered** within the overarching scenario flow.*

---

## Database Coverage Matrix

| Table | Covered By Scenario |
| ----- | ------------------- |
| `change_req_User` | Scenario 1, 2, 12 |
| `change_req_AccountRequest` | Scenario 2 |
| `change_req_Session` | Scenario 1, 11, 13 |
| `change_req_UserManager` | Scenario 1, 7, 12 |
| `change_req_UserModules` | Scenario 1, 8, 12 |
| `change_req_Project` | Scenario 1, 13 |
| `change_req_Module` | Scenario 1, 8, 13 |
| `change_req_Task` | Scenario 3, 4, 5, 10, 13 |
| `change_req_TaskComment` | Scenario 3, 4, 6 |
| `change_req_TaskAttachment`| Scenario 3, 6 |
| `change_req_TaskManagers` | Scenario 3, 6 |
| `change_req_TaskDevelopers`| Scenario 3, 6 |
| `change_req_TaskVerifiers` | Scenario 3, 5 |
| `change_req_Team` | Scenario 1 |
| `change_req_AuditLog` | Scenario 2, 3, 4, 5, 12 |
| `change_req_StatusHistory` | Scenario 3, 4, 5 |
| `change_req_Notification` | Scenario 2, 3, 4, 5, 9 |
| `TEST` | N/A (Utility/Development only) |

*Note: Every business table is thoroughly exercised during the UAT process.*

---

## Final Release Sign-Off Checklist

Before granting final deployment approval, the QA/UAT team must validate and sign off on the following:

- [ ] **Authentication** (Opaque token handling, login/logout)
- [ ] **Authorization** (Role-based access enforcement)
- [ ] **Account onboarding** (Public request to approved user pipeline)
- [ ] **User administration** (Disabling, hierarchy, password resets)
- [ ] **Module security** (Horizontal data isolation)
- [ ] **Happy path workflow** (End-to-end task progression)
- [ ] **Rejection workflow** (Handling blockage and missing data)
- [ ] **Rework workflow** (Verifier rejection and developer iteration)
- [ ] **Multi-user workflow** (Concurrent assignments and comments)
- [ ] **Notifications** (Accurate alert generation and state)
- [ ] **Reports** (Accurate data aggregation matching DB raw state)
- [ ] **Audit logging** (Non-repudiable history of changes)
- [ ] **Session management** (Stale tab invalidation)
- [ ] **Persistence after restart** (Data durability)
- [ ] **Database integrity** (Foreign keys and constraints)
- [ ] **Endpoint coverage** (No API untested)

### Deployment Decision

**[ ] READY FOR DEPLOYMENT**  
**[ ] NOT READY FOR DEPLOYMENT**  

*Signatures / Approval:*  
___________________________ (QA Lead)  
___________________________ (Project Manager)  
___________________________ (Technical Lead)
