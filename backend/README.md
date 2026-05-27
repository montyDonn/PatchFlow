# PatchFlow Spring Boot API

Spring Boot 3.3 + Java 21 replacement for the Node/Express backend. 
Connects to the **same existing PostgreSQL database** — no schema changes needed, Prisma migrations still apply.

## Stack
| Layer | Technology |
|---|---|
| Framework | Spring Boot 3.3.5 |
| Java | 21 (LTS) |
| ORM | Spring Data JPA / Hibernate |
| Database | PostgreSQL (Neon cloud) |
| Auth | Custom session-token filter (SHA-256, mirrors Node impl) |
| Password | BCrypt via Spring Security Crypto |
| Build | Maven 3.9+ |

## Project Structure
```
backend/
├── pom.xml
└── src/main/java/com/patchflow/
    ├── PatchFlowApplication.java          ← entry point
    ├── config/
    │   ├── Auth.java                      ← replaces auth.middleware.ts
    │   ├── SecurityConfig.java            ← BCrypt bean only
    │   └── WebConfig.java                 ← CORS + filter registration
    ├── entity/                            ← JPA entities (all 10 models)
    ├── repository/                        ← JPA repositories
    ├── service/
    │   ├── AuthService.java               ← replaces auth.service.ts
    │   ├── TaskService.java               ← replaces task.service.ts (~1000 lines)
    │   └── NotificationService.java
    ├── controller/                        ← REST controllers (6 controllers)
    └── filter/
        └── AuthTokenFilter.java           ← replaces auth.middleware.ts
```

## Running

```bash
cd backend

# Copy .env values and start the app (set DATABASE_URL as env var)
DATABASE_URL="jdbc:postgresql://host/db?sslmode=require&user=...&password=..." \
  mvn spring-boot:run
```

Or build a jar:
```bash
mvn package -DskipTests
DATABASE_URL="jdbc:postgresql://..." java -jar target/patchflow-api-1.0.0.jar
```

## API Routes (identical to Node backend)

| Method | Path | Auth |
|---|---|---|
| POST | `/api/auth/login` | Public |
| POST | `/api/auth/register` | SUPER_ADMIN, ADMIN |
| GET | `/api/auth/me` | Any |
| POST | `/api/auth/logout` | Any |
| GET | `/api/tasks` | Any |
| POST | `/api/tasks` | SUPER_ADMIN, ADMIN, CLIENT, MANAGER, DEVELOPER |
| GET | `/api/tasks/:id` | Any (RBAC) |
| PATCH | `/api/tasks/:id/status` | Any (RBAC) |
| POST | `/api/tasks/:id/comments` | Any |
| DELETE | `/api/tasks/:id` | Any |
| POST | `/api/tasks/:id/restore` | Any |
| POST | `/api/tasks/:id/assign` | MANAGER, ADMIN |
| PATCH | `/api/tasks/:id/details` | MANAGER, ADMIN, CLIENT |
| GET | `/api/modules` | Any |
| GET | `/api/modules/hierarchy` | ADMIN+ |
| POST | `/api/modules` | ADMIN+ |
| PATCH | `/api/modules/:id` | ADMIN+ |
| DELETE | `/api/modules/:id` | SUPER_ADMIN |
| GET | `/api/users` | Any |
| POST | `/api/users` | ADMIN+ |
| PATCH | `/api/users/:id` | ADMIN+ |
| DELETE | `/api/users/:id` | ADMIN+ |
| PATCH | `/api/users/:id/reactivate` | ADMIN+ |
| PUT | `/api/users/:id/modules` | ADMIN+ |
| PUT | `/api/users/:id/managers` | ADMIN+ |
| POST | `/api/users/:id/reset-password` | ADMIN+ |
| GET | `/api/notifications` | Any |
| PATCH | `/api/notifications/:id/read` | Any |
| GET | `/api/teams` | Any |
| GET | `/api/reports/history` | Any (RBAC) |
| GET | `/api/reports/data` | ADMIN, MANAGER, CLIENT |

## Frontend: No Changes Required
The frontend `api/client.ts` already points to `http://localhost:5001`. 
The Spring Boot server runs on the same port, with identical API contracts.
