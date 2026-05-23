# PatchFlow — Technical Specification & Developer Guide

PatchFlow is a full-stack enterprise web application that manages the complete lifecycle of software patches — code changes, configuration updates, and infrastructure changes — from request creation through assignment, development, verification, and completion.

This version of PatchFlow is built using:

- **Backend:** Spring Boot 3 + Java 21
- **Frontend:** React + Vite + Tailwind CSS
- **Database:** PostgreSQL 15
- **Authentication:** Secure Session-Based Authentication
- **ORM:** Spring Data JPA + Hibernate

---

# Table of Contents

1. What Is PatchFlow?
2. Simple Workflow
3. Project Structure
4. Technology Stack
5. System Architecture
6. Database Schema
7. Workflow State Machine
8. Role-Based Access Control (RBAC)
9. API Endpoints
10. Security Architecture
11. Running the Project
12. Design Decisions
13. Scalability Roadmap
14. Demo Accounts

---

# 1. What Is PatchFlow?

PatchFlow is an enterprise-grade deployment governance platform designed to manage software patch workflows across teams.

It provides:

| Capability                 | Description                              |
| -------------------------- | ---------------------------------------- |
| Patch Lifecycle Management | Complete workflow from DRAFT → COMPLETED |
| Role-Based Access Control  | Strict permissions for each role         |
| Immutable Audit Logs       | Full history tracking of every action    |
| Kanban Workflow Board      | Visual patch management                  |
| Reports & Export           | Excel, CSV, PDF exports                  |
| Notifications              | Workflow event notifications             |
| Soft Delete                | No hard deletion of business data        |
| Multi-Role Assignments     | Multiple developers/verifiers/managers   |

---

# 2. Simple Workflow

```text
CLIENT creates patch
        ↓
ASSIGNED to MANAGER
        ↓
MANAGER assigns developers/verifiers
        ↓
PENDING_APPROVAL
        ↓
IN_DEVELOPMENT
        ↓
VERIFYING
        ↓
COMPLETED / REJECTED / RETURNED
```

Every action is tracked in audit history.

---

# 3. Project Structure

```text
/patchflow
├── backend/                         ← Spring Boot Backend
│
│   ├── src/main/java/com/patchflow
│   │
│   │   ├── config/                 ← Security, CORS, JWT/session configs
│   │   ├── controller/             ← REST Controllers
│   │   ├── service/                ← Business Logic Layer
│   │   ├── repository/             ← JPA Repositories
│   │   ├── entity/                 ← JPA Entities
│   │   ├── dto/                    ← Request/Response DTOs
│   │   ├── mapper/                 ← Entity-DTO mappers
│   │   ├── security/               ← Authentication & authorization
│   │   ├── exception/              ← Global exception handling
│   │   ├── util/                   ← Utility classes
│   │   └── PatchFlowApplication.java
│   │
│   ├── src/main/resources/
│   │   ├── application.yml
│   │   └── db/migration/           ← Flyway migrations
│   │
│   ├── pom.xml
│   └── Dockerfile
│
├── frontend/                       ← React Frontend
│
│   ├── src/
│   │
│   │   ├── api/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── pages/
│   │   ├── store/
│   │   ├── routes/
│   │   ├── layouts/
│   │   └── App.tsx
│   │
│   ├── package.json
│   └── vite.config.ts
│
├── docker-compose.yml
└── README.md
```

---

# 4. Technology Stack

## 4.1 Backend — Spring Boot + Java

| Technology      | Purpose                        |
| --------------- | ------------------------------ |
| Java 21         | Main programming language      |
| Spring Boot 3   | Backend framework              |
| Spring Web      | REST APIs                      |
| Spring Security | Authentication & authorization |
| Spring Data JPA | ORM abstraction                |
| Hibernate       | ORM engine                     |
| PostgreSQL      | Relational database            |
| Flyway          | Database migrations            |
| Lombok          | Boilerplate reduction          |
| Maven           | Dependency management          |
| MapStruct       | DTO mapping                    |
| Validation API  | Request validation             |

---

## Why Spring Boot?

Spring Boot provides:

- Enterprise-grade architecture
- Strong security ecosystem
- Dependency injection
- Transaction management
- Scalable layered architecture
- Production-ready observability
- Mature ecosystem for large systems

Compared to Node.js/Express:

- Better structured for large enterprise systems
- Stronger compile-time safety
- Easier transactional consistency
- Better multithreading model
- More common in enterprise/government organizations

---

## 4.2 Frontend — React + Vite + Tailwind

| Technology      | Purpose           |
| --------------- | ----------------- |
| React 19        | Frontend UI       |
| Vite            | Build tool        |
| Tailwind CSS    | Styling           |
| Zustand         | Global state      |
| Axios           | API communication |
| React Router    | Routing           |
| React Hook Form | Form handling     |
| Zod             | Validation        |

---

## 4.3 Database — PostgreSQL

PatchFlow uses PostgreSQL 15.

Why PostgreSQL:

- ACID compliance
- Strong relational support
- JSON support
- Advanced indexing
- Excellent transactional integrity

---

## 4.4 Authentication

PatchFlow uses secure session/token-based authentication with Spring Security.

Features:

- BCrypt password hashing
- Role-based authorization
- Session expiration
- Token revocation
- Protected APIs
- Request filtering

---

# 5. System Architecture

```text
React Frontend
      ↓
Axios HTTP Client
      ↓
Spring Boot REST API
      ↓
Service Layer
      ↓
JPA/Hibernate
      ↓
PostgreSQL
```

---

# Backend Layered Architecture

```text
Controller Layer
        ↓
Service Layer
        ↓
Repository Layer
        ↓
Database
```

### Controller Layer

- Handles HTTP requests/responses

### Service Layer

- Core business logic
- Workflow transitions
- Validation
- Auditing

### Repository Layer

- Database operations using JPA

### Entity Layer

- Database models

---

# 6. Database Schema

Core entities:

| Entity        | Purpose                  |
| ------------- | ------------------------ |
| User          | System users             |
| Role          | RBAC roles               |
| Task          | Patch/task entity        |
| Module        | System modules           |
| AuditLog      | Immutable audit tracking |
| StatusHistory | Workflow history         |
| Notification  | User notifications       |
| Comment       | Patch comments           |
| Attachment    | File metadata            |
| Session       | Authentication sessions  |

---

# Example Task Entity

```java
@Entity
@Table(name = "tasks")
public class Task {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    private String title;

    private String description;

    @Enumerated(EnumType.STRING)
    private TaskStatus status;

    private Integer lifecycleStatus = 0;

}
```

---

# 7. Workflow State Machine

## Statuses

```text
DRAFT
ASSIGNED
PENDING_APPROVAL
IN_DEVELOPMENT
VERIFYING
COMPLETED
RETURNED_TO_DEVELOPER
REJECTED
DELAYED
ON_HOLD
CANCELLED
```

---

## Allowed Workflow

```text
DRAFT → ASSIGNED
ASSIGNED → PENDING_APPROVAL
PENDING_APPROVAL → IN_DEVELOPMENT
IN_DEVELOPMENT → VERIFYING
VERIFYING → COMPLETED
VERIFYING → RETURNED_TO_DEVELOPER
VERIFYING → REJECTED
VERIFYING → DELAYED
VERIFYING → ON_HOLD
VERIFYING → CANCELLED
```

---

# 8. Role-Based Access Control (RBAC)

## Roles

| Role        | Responsibilities                |
| ----------- | ------------------------------- |
| SUPER_ADMIN | Full access                     |
| ADMIN       | Administrative control          |
| MANAGER     | Resource assignment & approvals |
| DEVELOPER   | Development work                |
| VERIFIER    | QA & verification               |
| CLIENT      | Patch request creation          |

---

# 9. API Endpoints

## Authentication APIs

| Method | Endpoint             |
| ------ | -------------------- |
| POST   | `/api/auth/login`    |
| POST   | `/api/auth/register` |
| POST   | `/api/auth/logout`   |
| GET    | `/api/auth/me`       |

---

## Task APIs

| Method | Endpoint                 |
| ------ | ------------------------ |
| GET    | `/api/tasks`             |
| GET    | `/api/tasks/{id}`        |
| POST   | `/api/tasks`             |
| PATCH  | `/api/tasks/{id}/status` |
| DELETE | `/api/tasks/{id}`        |

---

## User APIs

| Method | Endpoint          |
| ------ | ----------------- |
| GET    | `/api/users`      |
| POST   | `/api/users`      |
| PUT    | `/api/users/{id}` |
| DELETE | `/api/users/{id}` |

---

# 10. Security Architecture

| Feature                  | Implementation                  |
| ------------------------ | ------------------------------- |
| Password Hashing         | BCrypt                          |
| Authentication           | Spring Security                 |
| Authorization            | RBAC                            |
| Session Management       | Secure token/session            |
| SQL Injection Protection | Hibernate parameterized queries |
| Input Validation         | Bean Validation API             |
| Audit Logging            | Immutable logs                  |
| Soft Deletes             | lifecycleStatus                 |

---

# 11. Running the Project

## Prerequisites

- Java 21
- Maven
- Node.js 20+
- PostgreSQL 15
- Docker (optional)

---

## Backend Setup

```bash
cd backend

mvn clean install

mvn spring-boot:run
```

Backend runs on:

```text
http://localhost:8080
```

---

## Frontend Setup

```bash
cd frontend

npm install

npm run dev
```

Frontend runs on:

```text
http://localhost:5173
```

---

## Database Configuration

```yaml
spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/patchflow
    username: postgres
    password: password

  jpa:
    hibernate:
      ddl-auto: update

    show-sql: true
```

---

# 12. Design Decisions

## Why Spring Boot Instead of Node.js?

| Spring Boot                      | Node.js                  |
| -------------------------------- | ------------------------ |
| Better enterprise adoption       | Lightweight              |
| Strong type safety               | Flexible                 |
| Excellent transaction management | Faster development       |
| Better for large monoliths       | Better for microservices |
| Mature security ecosystem        | Simpler architecture     |

PatchFlow prioritizes:

- enterprise reliability
- maintainability
- scalability
- security
- strict workflow consistency

Therefore Spring Boot is a better fit.

---

# 13. Scalability Roadmap

| Phase       | Architecture                  |
| ----------- | ----------------------------- |
| MVP         | Single Spring Boot instance   |
| Growth      | Load-balanced instances       |
| Enterprise  | Microservices + Kafka + Redis |
| Large Scale | Kubernetes deployment         |

Future improvements:

- Redis caching
- Kafka event streaming
- WebSockets
- Elasticsearch
- CI/CD pipelines
- File storage service

---

# 14. Demo Accounts

Password for all demo accounts:

```text
Admin@123
```

| Username    | Role        |
| ----------- | ----------- |
| superadmin1 | SUPER_ADMIN |
| admin1      | ADMIN       |
| manager1    | MANAGER     |
| developer1  | DEVELOPER   |
| verifier1   | VERIFIER    |
| client1     | CLIENT      |

---

# Tech Stack Summary

```text
Frontend
- React
- Vite
- Tailwind CSS
- Zustand
- Axios

Backend
- Spring Boot 3
- Java 21
- Spring Security
- Spring Data JPA
- Hibernate

Database
- PostgreSQL 15

DevOps
- Docker
- Flyway
- Maven
```

---

────────────────────────────────────────────────────────

Built By

Shivansh Dharni

GitHub:
https://github.com/dhxrni

PatchFlow — Enterprise Patch Workflow Management Platform

────────────────────────────────────────────────────────
