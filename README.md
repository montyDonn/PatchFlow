# PatchFlow

## Overview
PatchFlow is an enterprise‑grade, collaborative patch management and workflow tracking platform designed to coordinate and manage software patches, bug fixes, and feature requests. 

### The Problem It Solves
Traditional software deployment environments face visibility gaps, uneditable deadlines, and fragmented workflows where assigning resources requires multiple separate steps. This leads to configuration errors, delayed releases, and coordination bottlenecks.

### Main Features
* **Interactive Kanban-Style Board**: Provides a unified interface for tracking task stages from draft status to deployment.
* **Role-Based Access Control (RBAC)**: Supports roles including `SUPER_ADMIN`, `ADMIN`, `MANAGER`, `DEVELOPER`, `VERIFIER`, and `CLIENT`.
* **Approve & Assign Workflow**: Consolidates resource allocation (assigning developers and verifiers) and deadline scheduling into a single-step action.
* **Inline Deadline Management**: Allows administrators and managers to modify target completion dates directly from task details modals.
* **Intelligent Outbound Notifications**: Features an asynchronous, robust notification bridge supporting email, SMS, and WhatsApp alerts based on user communication preferences.
* **Audit Logging & Analytics**: Automatically tracks transition histories and generates performance metrics/velocity reports.

---

## Architecture

PatchFlow is structured as a client-server web application. Below is a high-level representation of its architecture and system components:

```text
┌────────────────────────────────────────────────────────┐
│                        Frontend                        │
│                (React + TS + Tailwind)                 │
└───────────────────────────┬────────────────────────────┘
                            │ (REST HTTP & Session Token)
                            ▼
┌────────────────────────────────────────────────────────┐
│                        Backend                         │
│             (Spring Boot 3.3.5 on Java 17)             │
│  ┌────────────────────────┬─────────────────────────┐  │
│  │   Auth & Security      │   Workflow Services     │  │
│  │  (AuthTokenFilter /    │   (Tasks, Modules,      │  │
│  │   Opaque Session Token)│    Teams, Reports)      │  │
│  └────────────────────────┴─────────────────────────┘  │
└───────────────────────────┬────────────────────────────┘
                            │ (JPA/Hibernate)
                            ▼
┌────────────────────────────────────────────────────────┐
│                        Database                        │
│                        (MySQL)                         │
└───────────────────────────┬────────────────────────────┘
                            │ (Triggers & Queue Stack)
                            ▼
┌────────────────────────────────────────────────────────┐
│                  Notification System                   │
│         (background queue processor, 10s delay)        │
│    ┌───────────────┼─────────────────┼──────────────┐  │
│    │               │                 │              │  │
│    ▼               ▼                 ▼              ▼  │
│ [ Email ]       [ SMS ]        [ WhatsApp ]   [ Local ]│
│ (SMTP)       (Phoenix SOAP)   (SMSGupshup)   (System)  │
└────────────────────────────────────────────────────────┘
```

---

## Technology Stack

### Backend
* **Java Version**: `17` (configured in Maven compiler options).
* **Spring Boot Version**: `3.3.5`.
* **Spring Security**: Formulates stateless API protection using custom filters and authentication managers.
* **Spring Data JPA**: For abstracting relational operations and queries.
* **Hibernate**: Handles object-relational mapping (ORM) to map Java classes to database tables.
* **JSON Web Tokens (JWT)**: `io.jsonwebtoken` (v0.12.5) is defined in `pom.xml`, but the application currently relies on secure random **opaque session tokens** stored and hashed in the database for runtime sessions.
* **Maven**: Manages backend build cycles and libraries.
* **Lombok**: Generates boilerplate code (such as getters, setters, builders, and constructors).
* **MySQL Connector/J**: Driver enabling communication with the database.
* **Mail Support**: Uses `spring-boot-starter-mail` (JavaMailSender) for sending email notifications.
* **Commons IO**: Library utilized for handling files.
* **Jackson Databind**: Serializes and deserializes Java objects to and from JSON.

### Frontend
* **React Version**: `^19.2.6` (leverages the React 19 framework).
* **TypeScript**: Enforces strict static typing across the UI codebase.
* **Vite**: Acts as the build system and high-speed local development server.
* **Axios**: Executes HTTP calls to the backend REST endpoints.
* **Routing**: Managed by React Router DOM (v7.15.0).
* **State Management**: Built on Zustand (v5.0.13) with persistence middleware (`persist`) to store user sessions inside the browser's local storage.
* **UI Libraries**: Styled with Tailwind CSS v4.3.0 and custom vanilla CSS modules featuring gradients, animations, and glassmorphism.
* **Icons**: Powered by Lucide React (v1.14.0).
* **Forms**: Handled via React Hook Form (v7.75.0) paired with Zod (v4.4.3) for runtime schema validation.

---

## Project Structure

The project is structured into two main directories: `backend/` and `frontend/`.

```text
PatchFlow/
├── backend/
│   ├── src/main/java/com/patchflow/
│   │   ├── config/          # Spring beans, SecurityConfig, WebConfig, and DataSeeder
│   │   ├── controller/      # REST API endpoints (TaskController, AuthController, etc.)
│   │   ├── entity/          # JPA Hibernate database model definitions
│   │   ├── filter/          # AuthTokenFilter intercepts requests & checks session hashes
│   │   ├── repository/      # JPA database interface repositories
│   │   └── service/         # Core logic (AuthService, TaskService, UPCLNotificationService)
│   ├── src/main/webapp/     # Container settings (jboss-deployment-structure.xml)
│   ├── src/main/resources/  # application.yml configuration profiles
│   └── pom.xml              # Maven dependencies and package settings
│
├── frontend/
│   ├── src/
│   │   ├── api/             # Axios REST clients (tasks.ts, client.ts, users.ts, etc.)
│   │   ├── components/      # UI components (Kanban cards, modals, tables, structures)
│   │   ├── hooks/           # Custom React hooks
│   │   ├── pages/           # High-level route views (Dashboard, Login, Admin settings)
│   │   ├── store/           # Zustand global state (authStore.ts)
│   │   └── __tests__/       # Frontend test suite (Vitest + React Testing Library)
│   ├── package.json         # Frontend package details and build scripts
│   └── vite.config.ts       # Vite config and environment build checks
```

---

## Database

### Database History & Migration
PatchFlow was originally baseline-tested using a PostgreSQL database (retained on the `main` branch). It has since been migrated to MySQL (configured on the active branches) to align with enterprise infrastructure guidelines. The connection settings have been fully externalized.

### Entity & Table Overview
The database uses table prefixes to avoid system naming clashes. Here are the core tables and relationships:

| Table Name | Entity Class | Category | Purpose |
|---|---|---|---|
| `change_req_User` | `User` | Core | System users, passwords, roles, contact info, and channel notification preferences. |
| `change_req_Session` | `Session` | Auth | Hashed opaque tokens representing active sessions for logged-in users. |
| `change_req_Project` | `Project` | Core | Top-level containers for organization. |
| `change_req_Module` | `AppModule` | Core | Sub-divisions of projects (e.g. billing, network modules). |
| `change_req_Task` | `Task` | Core | The central entity tracking patch workflow state, deadlines, modules, and teams. |
| `change_req_TaskComment` | `TaskComment` | Business | Threaded user discussions attached to tasks. |
| `change_req_TaskAttachment`| `TaskAttachment`| Business | Metadata pointing to uploaded files on disk. |
| `change_req_StatusHistory` | `StatusHistory` | Workflow | Event logs tracking every task state transition. Used for metrics. |
| `change_req_Notification` | `Notification` | Workflow | User-specific inbox alerts shown in the web panel. |
| `change_req_NotificationStack`| `NotificationStack`| Notification | Outbound queue processing SMS, WhatsApp, and Email alerts. |
| `change_req_AuditLog` | `AuditLog` | Audit | Immutable security logs mapping administrative changes. |
| `change_req_Team` | `Team` | Business | User groups assigned to specific modules and tasks. |

### Relationships
* **Project & Module**: One-to-Many (`Project` has multiple `Modules`).
* **Module & Task**: One-to-Many (`Module` has multiple `Tasks`).
* **User & Module**: Many-to-Many through join table `change_req_UserModules` (restricts developers to specific modules).
* **Task Collaborators**: Many-to-Many associations mapping `Task` to multiple Managers, Developers, and Verifiers via join tables (`change_req_TaskManagers`, `change_req_TaskDevelopers`, `change_req_TaskVerifiers`).
* **Task Events**: One-to-Many relations link a `Task` to its `TaskComment` listings, `TaskAttachment` documents, and transition `StatusHistory`.

---

## Authentication & Authorization

### Authentication Flow
1. **User Sign In**: The user POSTs credentials (`username` and `password`) to the `/api/auth/login` endpoint.
2. **Credential Checking**: `AuthService` retrieves the user record and verifies the password hash via `BCryptPasswordEncoder`.
3. **Session Generation**: The backend generates a secure random 32-byte opaque token and encodes it to Base64-URL format.
4. **Token Storage**: The token is hashed via SHA-256 and saved inside the `change_req_Session` database table along with an expiration timestamp (default: 7 days).
5. **Token Delivery**: The unhashed, plain token is sent back to the frontend and stored locally in Zustand state (`authStore.ts`).

```text
[ Client ] ──(Credentials)──► [ AuthController ] ──(BCrypt match)──► [ DB User ]
    ▲                                                                     │
    │                                                               (Success)
    │                                                                     ▼
[ Token ] ◄──(Return Plain Token)── [ Session Created ] ◄──(Save Hash)── [ Generator ]
```

### Opaque Session Tokens
Instead of encoding state inside a JWT client-side, PatchFlow uses database-backed sessions. This allows instant session revocation (e.g. during logout, password resets, or deactivations) simply by deleting the token hash row from the database.

### Security Filters
The custom `AuthTokenFilter` intercepts all API requests:
* It reads the token from the `Authorization: Bearer <token>` header.
* It computes the SHA-256 hash of the token and checks for a matching active session in the database.
* If a session is valid, it retrieves the user information, builds user authorization authorities (`ROLE_<role>`), and populates Spring Security's `SecurityContextHolder`.

---

## Notification System

PatchFlow incorporates an asynchronous notification architecture consisting of a local database-driven registry, a queue stack, and a background worker.

```text
  [ User Action ] 
         │
         ▼
[ Notification Service ] ──► Writes to change_req_Notification (Local UI Inbox)
         │
         ▼
[ UPCL Notification Service ] ──► Checks User settings: notifyEmail, notifySms, notifyWhatsapp
         │
         ▼
[ Notification Stack Table ] ◄── Queues raw message into PENDING queue stack
         │
         ▼ (Background scheduler runs every 10 seconds)
[ Notification Queue Scheduler ] 
         │
         ├──► Channel: EMAIL ────► [ EmailSenderService ] ──► SMTP Mail Relay
         ├──► Channel: SMS ──────► [ SmsSenderService ] ──► SOAP phoenix service
         └──► Channel: WHATSAPP ──► [ WhatsAppSenderService ] ──► SMSGupshup Gateway
```

### Email Channel
* **Implementation**: Relies on Spring's `JavaMailSender` interface.
* **SMTP Host**: Sends emails from `info@upcl.org` via SMTP relay host `10.1.2.50` on port `25`.

### SMS Channel (UPCL SOAP Integration)
* **Implementation**: Submits SOAP XML payloads to a Phoenix billing SOAP endpoint at `http://10.1.2.60:8080/metering/SmsStack`.
* **Feature Flag**: Can be completely enabled or bypassed in non-production environments using the property `app.sms.enabled`.

### WhatsApp Channel
* **Implementation**: Communicates with the SMSGupshup Gateway using an HTTP GET REST request containing API query parameters (`method=SendMessage&msg_type=TEXT`).

---

## REST API

The backend exposes stateless endpoints. Major controllers are organized as follows:

| Context Group | Core Controller | Endpoint Prefix | Purpose |
|---|---|---|---|
| **Access Control** | `AuthController` | `/api/auth/` | Handles sign-in, signup, session context, and logout. |
| **Onboarding** | `AccountRequestController` | `/api/admin/` | Approves or rejects registration applications. |
| **Workflow** | `TaskController` | `/api/tasks/` | Creates, updates, assigns, restores, or attaches documents to tasks. |
| **Modules** | `ModuleController` | `/api/modules/` | Configures application modules and hierarchies. |
| **Administration** | `UserController` | `/api/users/` | Manages user directory status and module access mappings. |
| **Team Management**| `TeamController` | `/api/teams/` | Lists execution team metadata. |
| **Monitoring** | `HealthController` | `/health` | Returns plain `OK` for load balancers. |
| **Reports** | `ReportController` | `/api/reports/` | Pulls historical task transition statistics and metrics. |

---

## Build Instructions

### Backend
#### Prerequisites
* **Java**: JDK 17 must be installed and configured in your path environment.
* **Maven**: Version 3.8+ is required.

#### Building the WAR Package
To clean build and generate the deployment WAR archive:
```bash
cd backend
mvn clean package -DskipTests
```
This builds the package and generates `patchflow-api-1.0.0.war` inside the `backend/target/` directory.

---

### Frontend
#### Prerequisites
* **Node.js**: Version 20.x or newer.
* **npm**: Version 10.x or newer.

#### Running Locally
1. Install dependencies:
   ```bash
   cd frontend
   npm install
   ```
2. Run the development server (configured to target the local mock/live dev port):
   ```bash
   npm run dev
   ```

#### Building the Assets
To compile static production assets:
```bash
# Windows (PowerShell)
$env:VITE_API_URL="http://localhost:5001/api"; npm run build

# Unix / macOS (Bash)
VITE_API_URL=http://localhost:5001/api npm run build
```
This compiles the application assets into the `frontend/dist/` directory.

---

## Environment Variables

### Backend Environment Variables
These parameters configure the Spring Boot container dynamically:

* `SPRING_DATASOURCE_URL`: The JDBC URL configuration for the target MySQL server (e.g. `jdbc:mysql://localhost:3306/PMS?useSSL=false`).
* `SPRING_DATASOURCE_USERNAME`: Database username credential.
* `SPRING_DATASOURCE_PASSWORD`: Database password credential.
* `SPRING_JPA_HIBERNATE_DDL_AUTO`: Hibernate mapping behavior (`none`, `validate`, `update`). Set to `validate` in production environments.
* `PORT`: The web server port (defaults to `5001`).
* `CORS_ORIGINS`: Comma-separated list of origins allowed to execute frontend API calls (defaults to `http://localhost:5173`).
* `SPRING_MAIL_HOST`: Outbound SMTP server hostname.
* `SPRING_MAIL_PORT`: Outbound SMTP server port (defaults to `25`).
* `app.sms.enabled`: Sets whether SMS SOAP integration calls are dispatched (`true` or `false`).

### Frontend Environment Variables
These configurations are required during compilation:

* `VITE_API_URL`: The absolute API URL targeting the active backend application servlet container (e.g. `https://yourdomain.com/patchflow-api-1.0.0/api`).

---

## Deployment

### Backend WAR Deployment
1. Generate the WAR archive using `mvn clean package`.
2. Copy `patchflow-api-1.0.0.war` to the deployments directory of your JBoss WildFly application server (e.g. `standalone/deployments/`).
3. Ensure the server contains database module configurations matching the target datasource.
4. *JBoss Isolation*: The file `jboss-deployment-structure.xml` is pre-configured to disable the container's default JPA subsystems, forcing WildFly to use the packaged Hibernate library inside the WAR.

### Frontend Static Deployment
1. Compile the frontend files using `npm run build` (ensure `VITE_API_URL` is set to point to the servlet's `/api` path on the server).
2. Deploy the generated contents of `frontend/dist/` to a web server (e.g. Nginx, Apache, or JBoss web context).
3. If deployed on the same server, set up routing patterns so that calls to `/patchflow-api-1.0.0/api/` map back to the backend context route.

---

## MySQL Migration

The backend was migrated from PostgreSQL to MySQL to align with corporate architecture standards. The following modifications were made:

### 1. Externalized Datasource Properties
Configurations inside `application.yml` were migrated from hardcoded parameters to environment variables. This allows secure connection parameters to be defined inside system configurations rather than inside VCS repositories.

### 2. Hibernate Compatibility Fixes
* **Boolean Values**: MySQL lacks a native `boolean` type, translating values to `TINYINT(1)`. To fix mapping issues, `@JdbcTypeCode(SqlTypes.TINYINT)` was added to Java boolean attributes across database entities (e.g., `isActive` in `User`, `read` in `Notification`).
* **JSON Mapping Compatibility**: The `files` list in `TaskComment.java` was changed from `@JdbcTypeCode(SqlTypes.JSON)` to `@JdbcTypeCode(SqlTypes.LONGVARCHAR)` to ensure compatibility with MySQL's JSON mapping conventions under Hibernate 6.
* **Join Restrictions**: `@SQLJoinTableRestriction("is_active = 1")` was added to `Task.java` relationship collections to filter inactive records at the SQL level.

### 3. Schema Validation
The deployment environment requires `spring.jpa.hibernate.ddl-auto` to be set to `validate` to ensure entity mappings match database structures exactly without modifying them.

---

## Git Branch Strategy

* `main`: Retains the initial production baseline using PostgreSQL. Used as a reference point for original system behaviors.
* `mysql-migration`: Branch containing database configuration updates and driver integrations to shift the repository database engine from PostgreSQL to MySQL.
* `feature-upcl-notifications`: Extends `mysql-migration` by adding scheduled notification services, SOAP adapters for SMS, and Gupshup WhatsApp APIs.

---

## Troubleshooting

### `JAVA_HOME` Mismatches
* **Issue**: Maven compilation fails with class version errors.
* **Fix**: Ensure your `JAVA_HOME` environment variable points to a Java 17 installation.

### Missing `VITE_API_URL` during Vite Compilation
* **Issue**: The frontend build script fails with `FATAL BUILD ERROR: VITE_API_URL is missing!`.
* **Fix**: Define `VITE_API_URL` in the environment before running `npm run build` or create a `.env.production` file inside the `frontend/` folder.

### Hibernate Schema Validation Failures
* **Issue**: Spring Boot fails to start with database schema mismatch messages.
* **Fix**: Ensure that the database structures exactly match the column definitions defined in `DB_SCHEMA_DDL.sql`. For sandbox setups, you can change `SPRING_JPA_HIBERNATE_DDL_AUTO` to `update` inside your `.env` file to synchronize columns automatically.

### MySQL Boolean Mapping Issues
* **Issue**: Entity operations fail with SQL errors regarding bit or boolean conversion.
* **Fix**: Ensure the JDBC connection URL includes `tinyInt1isBit=false` if your local environment fails to coerce MySQL `TINYINT(1)` values back to Java `Boolean` objects.

---

## Future Improvements
* **Advanced Logging**: Introduce structural trace diagnostics across services.
* **Security Extensions**: Implement OpenID Connect/OAuth2 logins.
* **Dynamic Sockets**: Integrate WebSockets for real-time Kanban board updates.
* **Reporting Optimization**: Move complex turnaround queries to SQL database views to optimize loading performance.

---

## License
Internal Project

---

## Authors
Maintained by: **Shivansh Dharni**
