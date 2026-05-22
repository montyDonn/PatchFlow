# PatchFlow — Technical Specification & Developer Guide

> **Internal Engineering Patch Deployment Workflow Management System**

PatchFlow is a full-stack enterprise web application that manages the complete lifecycle of software "patches" — code changes, configuration updates, and infrastructure changes — from initial request through assignment, development, verification, and completion. It enforces strict role-based access, maintains immutable audit trails, and visualizes work via a Kanban-style board.

---

## Table of Contents

1. [What Is PatchFlow?](#1-what-is-patchflow)
2. [Simple Workflow (How It Works)](#2-simple-workflow-how-it-works)
3. [Project Structure](#3-project-structure)
4. [Technology Stack — Full Depth](#4-technology-stack--full-depth)
   - [4.1 Backend: Node.js + Express + TypeScript + Prisma](#41-backend-nodejs--express--typescript--prisma)
   - [4.2 Frontend: React + Vite + Tailwind CSS](#42-frontend-react--vite--tailwind-css)
   - [4.3 Database: PostgreSQL 15](#43-database-postgresql-15)
   - [4.4 Authentication: Custom Session Tokens (Not JWT)](#44-authentication-custom-session-tokens-not-jwt)
5. [System Architecture](#5-system-architecture)
6. [Database Schema](#6-database-schema)
7. [The Workflow State Machine](#7-the-workflow-state-machine)
8. [Role-Based Access Control (RBAC)](#8-role-based-access-control-rbac)
9. [API Endpoints Reference](#9-api-endpoints-reference)
10. [Security Architecture](#10-security-architecture)
11. [Running the Project Locally](#11-running-the-project-locally)
12. [Design Decisions & Why This Stack](#12-design-decisions--why-this-stack)
13. [Scalability Roadmap](#13-scalability-roadmap)
14. [Demo Accounts](#14-demo-accounts)

---

## 1. What Is PatchFlow?

PatchFlow is an **engineering deployment governance platform** — not a generic task manager. It solves a specific problem:

> *How does an engineering organization track, approve, and audit every software change (patch) from request to production in a controlled, compliant, and transparent way?*

### Key Capabilities
| Capability | Description |
|---|---|
| **Patch Lifecycle Management** | Full workflow from DRAFT → ASSIGNED → IN_DEVELOPMENT → VERIFYING → COMPLETED |
| **6-Role RBAC** | Super Admin, Admin, Manager, Developer, Verifier, Client — each with precise permissions |
| **Immutable Audit Trail** | Every action, field change, and status transition logged with actor, timestamp, old/new values |
| **Kanban Board** | Visual 5-column patch board with real-time status grouping |
| **Reporting & Export** | Filterable reports with CSV, Excel, and PDF export |
| **In-App Notifications** | Targeted notifications per role on every workflow event |
| **Module Management** | Patches are tied to system modules (e.g., BILLING, NSC, AUTH) |
| **Soft Delete & Restore** | Patches are never hard-deleted — preserves audit integrity |

---

## 2. Simple Workflow (How It Works)

Think of a "patch" as a formal request to make a change to software. Here is the end-to-end journey:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     PATCHFLOW LIFECYCLE                                  │
│                                                                         │
│  1. CLIENT creates a patch request                                      │
│     → Fills in: title, description, module, manager                    │
│     → Status: DRAFT                                                     │
│                                                                         │
│  2. CLIENT submits it to a Manager                                      │
│     → Status: ASSIGNED                                                  │
│     → Manager gets notified: "A patch has been assigned to you"        │
│                                                                         │
│  3. MANAGER assigns developers and verifiers                            │
│     → Reviews the request, adds team members                           │
│     → Status: PENDING_APPROVAL                                          │
│                                                                         │
│  4. MANAGER approves and starts development                             │
│     → Status: IN_DEVELOPMENT                                            │
│     → Developers get notified: "Work has started on your task"         │
│                                                                         │
│  5. DEVELOPER completes the work                                        │
│     → Adds comments, attaches files                                     │
│     → Status: VERIFYING                                                 │
│     → Verifiers get notified: "Task is ready for verification"         │
│                                                                         │
│  6. VERIFIER reviews the patch                                          │
│     → Can: COMPLETE it, REJECT it, RETURN it for rework,              │
│            put it ON_HOLD, or mark DELAYED                              │
│     → If returned: Developer reworks, re-submits to VERIFYING          │
│     → If completed: Client notified. Patch is DONE.                    │
│                                                                         │
│  Every step above is logged in the audit trail — who did what, when,   │
│  and why. No action can be undone or hidden.                            │
└─────────────────────────────────────────────────────────────────────────┘
```

### Status Flow Diagram

```
                    ┌──────────┐
                    │  DRAFT   │  ← Created by Client/Developer/Manager
                    └────┬─────┘
                         │ (Client or Author submits)
                    ┌────▼─────┐
                    │ ASSIGNED │  ← Resources being assigned
                    └────┬─────┘
                         │ (Manager submits for approval)
               ┌─────────▼──────────┐
               │  PENDING_APPROVAL  │  ← Waiting for Manager sign-off
               └─────────┬──────────┘
                         │ (Manager approves)
               ┌─────────▼──────────┐
               │   IN_DEVELOPMENT   │  ← Developers actively working
               └─────────┬──────────┘
                         │ (Developer submits)
               ┌─────────▼──────────┐
               │     VERIFYING      │  ← QA/Verifiers reviewing
               └──┬──────┬──────┬───┘
                  │      │      │
         ┌────────▼┐  ┌──▼───┐  └──────────────────────┐
         │COMPLETED│  │REJECT│   RETURNED / DELAYED /   │
         │(terminal)│  │ED    │   ON_HOLD / CANCELLED   │
         └─────────┘  │(term)│      └──────┬───────────┘
                      └──────┘             │ (resumes)
                                    ┌──────▼──────┐
                                    │IN_DEVELOPMENT│ ← Rework loop
                                    └─────────────┘
```

---

## 3. Project Structure

```
/office                                   ← Root repository
├── backend/                              ← Node.js + Express API server
│   ├── prisma/
│   │   ├── schema.prisma                 ← Database schema (10 models)
│   │   ├── seed.ts                       ← Seeds 50+ users, modules, demo tasks
│   │   ├── demo-setup.ts                 ← Quick demo environment setup
│   │   └── migrations/                   ← Prisma migration history (auto-generated)
│   └── src/
│       ├── app.ts                        ← Express app: middleware + route mounting
│       ├── server.ts                     ← HTTP server entry point (port 5001)
│       ├── config/                       ← Environment configuration (future)
│       ├── controllers/
│       │   ├── auth.controller.ts        ← Login, register, logout, /me
│       │   ├── task.controller.ts        ← Patch CRUD, status, comments
│       │   ├── notification.controller.ts
│       │   └── report.controller.ts
│       ├── middlewares/
│       │   └── auth.middleware.ts        ← authenticate() + authorize(roles[])
│       ├── routes/
│       │   ├── auth.routes.ts
│       │   ├── task.routes.ts
│       │   ├── user.routes.ts
│       │   ├── module.routes.ts
│       │   ├── team.routes.ts
│       │   ├── notification.routes.ts
│       │   └── report.routes.ts
│       ├── services/
│       │   ├── auth.service.ts           ← Registration, login, session management
│       │   ├── task.service.ts           ← Core: ~1,000 lines, state machine, auditing
│       │   └── notification.service.ts
│       └── utils/
│           ├── prisma.ts                 ← Singleton Prisma client
│           └── constants.ts             ← Role + TaskStatus enums
│
├── frontend/                             ← React + Vite SPA
│   └── src/
│       ├── api/
│       │   ├── client.ts                 ← Axios instance (auto-inject Bearer token)
│       │   ├── tasks.ts                  ← Typed API functions for patches
│       │   ├── users.ts                  ← User/module API functions
│       │   └── modules.ts               ← Module CRUD
│       ├── components/
│       │   ├── Layout.tsx                ← Sidebar + Topbar (notification bell)
│       │   ├── ErrorBoundary.tsx         ← React error boundary
│       │   ├── CreatePatchModal.tsx      ← Full patch creation form
│       │   └── patches/
│       │       ├── PatchCard.tsx         ← Kanban card component
│       │       ├── PatchColumn.tsx       ← Kanban column container
│       │       └── PatchDetailsModal.tsx ← Full patch detail + workflow controls
│       ├── hooks/
│       │   └── useTasks.ts              ← Data fetching + filtering hook
│       ├── pages/
│       │   ├── LoginPage.tsx
│       │   ├── DashboardPage.tsx         ← Stats + pipeline summary
│       │   ├── PatchBoardPage.tsx        ← 5-column Kanban board
│       │   ├── ReportsPage.tsx           ← Filterable table + CSV/PDF export
│       │   ├── ModulesPage.tsx           ← Module CRUD (admin)
│       │   ├── ModuleAssignmentsPage.tsx ← Assign users to modules (admin)
│       │   ├── ResourceHierarchyPage.tsx ← Per-module user matrix (admin)
│       │   └── SettingsPage.tsx          ← User management
│       ├── store/
│       │   └── authStore.ts             ← Zustand store (auth + localStorage)
│       └── App.tsx                       ← Routes + ProtectedRoute wrapper
│
└── docker-compose.local-postgres.yml    ← Local PostgreSQL via Docker
```

---

## 4. Technology Stack — Full Depth

### 4.1 Backend: Node.js + Express + TypeScript + Prisma

The backend is a **RESTful API server** built in a strict 4-layer architecture. Here is every library used and *why it was chosen over alternatives*:

#### Runtime & Framework

| Library | Version | Role |
|---|---|---|
| **Node.js** | 18+ LTS | JavaScript runtime — executes server-side code |
| **Express** | 5.x | HTTP web framework — handles routes, middleware, requests |
| **TypeScript** | 6.x | Adds static types to JavaScript — catches bugs at compile time |
| **tsx** | 4.x | Runs TypeScript files directly in development (no compile step needed) |

**Why Node.js?**
Node.js uses an **event-driven, non-blocking I/O model**. This means when the server asks the database for data, it doesn't sit and wait — it handles other requests in the meantime. For a system like PatchFlow with many concurrent API calls, this makes it highly efficient without needing heavy thread management.

**Why Express 5 over alternatives?**

| Alternative | Why Express Was Preferred |
|---|---|
| **Fastify** | Faster raw throughput, but smaller ecosystem and more complex to extend. For 30–1,000 users, Express 5 comfortably handles ~5,000 req/s per instance — far more than needed. |
| **NestJS** | Adds heavy abstraction: decorators, dependency injection, module system. This increases onboarding complexity significantly. Express is transparent — you can read it top-to-bottom and understand exactly what happens to each request. |
| **Next.js API Routes** | Next.js is designed for server-side rendering (SSR) websites. PatchFlow is an internal tool where SEO is irrelevant. Express is a dedicated backend framework — cleaner separation, independent scaling, easier API testing. |

**Why TypeScript?**
TypeScript compiles to JavaScript but adds a type system on top. When you write `task.status = "INVALID_STATUS"`, TypeScript catches this as an error *before the code runs*. This is critical for a complex system with 11 statuses and 6 roles — without types, bugs slip through to production.

---

#### Database ORM: Prisma

**Prisma** is the layer between the Express server and PostgreSQL. Instead of writing raw SQL, the code uses Prisma's API:

```typescript
// Instead of: SELECT * FROM tasks WHERE id = '...' AND deletedAt IS NULL
const task = await prisma.task.findFirst({
  where: { id: taskId, lifecycleStatus: 0 },
  include: { developers: true, comments: true, statusHistory: true }
});
```

**Why Prisma 6 over alternatives?**

| Alternative | Why Prisma Was Preferred |
|---|---|
| **TypeORM** | Requires decorators on model classes. Schema gets scattered across TypeScript files. Prisma uses a single `schema.prisma` file as the **single source of truth** — any developer can open one file and understand the entire database structure. |
| **Drizzle** | Lighter weight but requires more manual SQL-like query building. Prisma's relation API (`include`, nested `where`, transactions) is more readable for a schema with 10+ interconnected models. |
| **Raw SQL / Knex** | Verbose, error-prone. Raw SQL means no auto-completion, no compile-time query validation, and manual protection against SQL injection. Prisma **automatically parameterizes** all queries — SQL injection is structurally impossible. |
| **Sequelize** | Older library, less active development, weaker TypeScript support. Prisma was built TypeScript-first. |

**Prisma also gives us:**
- `prisma migrate dev` — generates and applies database migration files automatically
- `prisma generate` — regenerates the type-safe client from the schema
- Built-in connection pooling for PostgreSQL

---

#### Other Backend Libraries

| Library | Purpose | Why This Choice |
|---|---|---|
| **bcrypt 6.x** | Password hashing | Industry standard. Uses adaptive cost factor (12) — takes ~250ms intentionally, making brute-force attacks computationally infeasible even with GPUs. Not MD5/SHA (which are fast and crackable). |
| **cors** | Cross-Origin Resource Sharing | Allows the React frontend (port 5173) to call the Express API (port 5001) without browser security blocks. |
| **crypto** (Node built-in) | SHA-256 token hashing | Hashes session tokens before storing in DB — even if the database leaks, tokens are useless. |

---

### 4.2 Frontend: React + Vite + Tailwind CSS

The frontend is a **Single Page Application (SPA)** — the browser downloads the app once, then all navigation happens client-side without full page reloads.

#### Core UI Framework

| Library | Version | Role |
|---|---|---|
| **React** | 19.x | UI library — component model, hooks, state |
| **Vite** | 8.x | Build tool and development server |
| **Tailwind CSS** | 4.x | Utility-first CSS framework |
| **TypeScript** | 6.x | Type safety across all components |

**Why React?**
React is the most widely adopted UI library in the world. It uses a **component model** — the UI is broken into small, reusable pieces (e.g., `PatchCard`, `PatchColumn`, `PatchDetailsModal`). Each component manages its own state and re-renders only when its data changes. This makes complex UIs manageable and testable.

**Why Vite 8 over alternatives?**

| Alternative | Why Vite Was Preferred |
|---|---|
| **Create React App (CRA)** | Officially deprecated by the React team in 2023. Slow builds (~30-60s), no native ES Modules. |
| **Webpack** | Vite uses **ESBuild** (written in Go) in development — 10-100x faster than Webpack's JavaScript-based bundler. Hot Module Replacement (HMR) under 50ms vs. seconds with Webpack. |
| **Turbopack** (Next.js) | Newer, less battle-tested, tied to Next.js ecosystem. Vite has a larger plugin ecosystem and better community support. |

**Why Tailwind CSS 4?**
Tailwind provides utility classes (`flex`, `text-lg`, `bg-gray-800`) instead of writing CSS by hand. Version 4 introduces:
- `@import "tailwindcss"` — single import, no config file needed
- `@theme` directive for design tokens
- Integrated Vite plugin for zero-config setup

Compared to alternatives:
- **styled-components**: Runtime CSS-in-JS adds bundle weight and has no design system constraints. Tailwind produces zero runtime overhead.
- **Material UI (MUI)**: 200KB+ gzipped, imposes Google's specific design language. Difficult to customize. Tailwind produces a unique enterprise dark UI.
- **Plain CSS**: No constraints, leads to inconsistent design across a team. Tailwind enforces a shared design system.

---

#### State Management: Zustand

**Zustand** manages global frontend state — specifically who is logged in:

```typescript
// authStore.ts
const useAuthStore = create(persist(
  (set) => ({
    user: null,
    token: null,
    login: (user, token) => set({ user, token }),
    logout: () => set({ user: null, token: null }),
  }),
  { name: 'auth-storage' }  // Persists to localStorage
));
```

**Why Zustand 5 over alternatives?**

| Alternative | Why Zustand Was Preferred |
|---|---|
| **Redux** | Requires boilerplate: action creators, reducers, dispatchers, selectors, middleware (thunks/sagas). A simple login state in Redux takes 5+ files. In Zustand: 1 file, 15 lines. |
| **React Context API** | Context re-renders **all consumers** when any value changes, even if that consumer doesn't use the changed value. Zustand uses subscriptions — components only re-render when the specific values they use change. |
| **MobX** | Requires decorators and class-based stores. More magic, harder to debug. Zustand is plain JavaScript functions. |

---

#### HTTP Client: Axios

Axios handles all API calls from the frontend. It's configured with **interceptors**:

```typescript
// client.ts
const api = axios.create({ baseURL: 'http://localhost:5001/api' });

// Automatically adds Bearer token to every request
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Automatically logs out on 401 (session expired)
api.interceptors.response.use(null, (error) => {
  if (error.response?.status === 401) useAuthStore.getState().logout();
  return Promise.reject(error);
});
```

**Why Axios over fetch()?**
The browser's native `fetch()` requires manual token injection on every call, manual JSON parsing, and has no interceptor mechanism. Axios centralizes all of this in one place.

---

#### Form Handling & Validation

| Library | Role |
|---|---|
| **React Hook Form 7.x** | Form state management using **uncontrolled inputs** (DOM-driven, not React state). This avoids re-rendering the entire form on every keystroke — critical for large forms like `CreatePatchModal`. |
| **Zod 4.x** | Schema-based validation. You define what valid data looks like, and Zod checks it. Works on both frontend (form validation) and can be reused on the backend. |

---

#### Reporting & Exports

| Library | Role |
|---|---|
| **Recharts** | Chart components (bar charts, line charts) for dashboard analytics. Built on SVG, tree-shakeable. |
| **jsPDF + jspdf-autotable** | Generate PDF reports directly in the browser — no server round-trip needed. |
| **xlsx** | Generate Excel/CSV files from filtered report data in the browser. |
| **Lucide React** | Icon library — SVG-based, tree-shakeable (unused icons are stripped from the bundle). |

---

#### Routing: React Router v7

React Router manages navigation without page reloads:

```
/login          → LoginPage (public, no auth required)
/               → DashboardPage (protected)
/patches        → PatchBoardPage (Kanban)
/modules        → ModulesPage (admin only)
/assignments    → ModuleAssignmentsPage (admin only)
/hierarchy      → ResourceHierarchyPage (admin only)
/reports        → ReportsPage
/settings       → SettingsPage
```

All routes except `/login` are wrapped in a `ProtectedRoute` component that redirects unauthenticated users to login.

---

### 4.3 Database: PostgreSQL 15

PostgreSQL is the primary data store. It runs locally via Docker (development) and can be hosted on **Neon** (serverless PostgreSQL) or any cloud provider in production.

**Why PostgreSQL 15 over alternatives?**

| Alternative | Why PostgreSQL Was Preferred |
|---|---|
| **MySQL** | PostgreSQL has superior JSON support (`jsonb` type), more advanced indexing (partial indexes, GiST), better compliance with SQL standards, and stronger ACID guarantees. The `AuditLog` table stores JSON blobs of old/new values — PostgreSQL handles this natively. |
| **SQLite** | SQLite is a single-file, single-writer database. Even 2 users writing at the same time can cause lock contention. Completely unsuitable for a multi-user web app. |
| **MongoDB** | PatchFlow's data is **fundamentally relational**: Task → Users → Modules → StatusHistory → AuditLogs → Comments. MongoDB would require application-level joins, losing ACID guarantees and making complex queries like "all patches assigned to developers in module X that changed status in the last 7 days" much harder. |
| **Redis** | Redis is an in-memory key-value store — excellent for caching, but not a primary database. It's in the scalability roadmap as a session cache layer. |

**Why Neon (Serverless PostgreSQL) for production?**
- **Zero ops** — no server to manage, no patching, automatic scaling
- **Built-in PgBouncer** (connection pooling) — manages database connection limits automatically
- **Branching** — create database branches for feature development (like Git branches for data)
- **Free tier** — sufficient for a 30-user MVP deployment
- Fully compatible with Prisma — just change the `DATABASE_URL` connection string

---

### 4.4 Authentication: Custom Session Tokens (Not JWT)

This is one of the most significant architectural decisions. Most tutorials teach JWT (JSON Web Tokens). PatchFlow deliberately chose **server-stored session tokens**.

#### How it works:

```
1. User logs in with username + password
2. Server verifies password with bcrypt
3. Server generates a random 32-byte hex token: e.g., "a3f9c2e1..."
4. Server stores SHA-256 hash of that token in the database (Session table)
   → The actual token is NEVER stored — only its hash
5. Server returns the raw token to the client
6. Client stores the token in localStorage (via Zustand persist)
7. Every subsequent request: client sends "Authorization: Bearer a3f9c2e1..."
8. Server hashes the incoming token (SHA-256), looks it up in Session table
9. If found and not expired (7-day TTL): request proceeds
10. If not found or expired: 401 Unauthorized
```

#### Why not JWT?

| JWT | Custom Session Tokens |
|---|---|
| Token is self-contained — server doesn't need to check a database | Token must be validated against the database on every request |
| **Cannot be revoked** — once issued, valid until expiry (usually 15min-24hrs) | **Can be revoked instantly** — delete the Session row, token becomes invalid immediately |
| Payload is readable by anyone (just Base64 encoded) | Token is an opaque random string — no information leaked |
| Requires a token blacklist for logout | Logout = DELETE FROM session WHERE tokenHash = '...' |

**For a compliance-heavy enterprise tool where an admin needs to immediately terminate a user's session** (e.g., employee offboarding, security incident), JWT is structurally incapable of doing this without a blacklist. Custom sessions provide **immediate revocation** as a first-class feature.

---

## 5. System Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                   BROWSER (React SPA)                           │
│  ┌──────────┐  ┌───────────┐  ┌──────────┐  ┌──────────────┐  │
│  │  Auth    │  │ Dashboard │  │  Patch   │  │   Reports    │  │
│  │  Store   │  │  (Stats)  │  │  Board   │  │  (CSV/PDF)   │  │
│  │ (Zustand)│  │           │  │ (Kanban) │  │              │  │
│  └──────────┘  └───────────┘  └──────────┘  └──────────────┘  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │         Axios Client (auto-injects Bearer token)        │   │
│  └───────────────────────────┬─────────────────────────────┘   │
└──────────────────────────────┼──────────────────────────────────┘
                               │ HTTP REST (JSON)
                               │ http://localhost:5001/api
┌──────────────────────────────┼──────────────────────────────────┐
│          EXPRESS SERVER       │                                  │
│  ┌────────────────────────────┴──────────────────────────────┐  │
│  │  Middleware Stack                                          │  │
│  │  1. cors()          → Allow cross-origin requests        │  │
│  │  2. express.json()  → Parse JSON request bodies          │  │
│  │  3. authenticate()  → Verify session token (SHA-256)     │  │
│  │  4. authorize()     → Check role permissions             │  │
│  └────────────────────────────┬──────────────────────────────┘  │
│  ┌────────────────────────────┴──────────────────────────────┐  │
│  │  Routes Layer  (auth, tasks, users, modules, reports...)  │  │
│  └────────────────────────────┬──────────────────────────────┘  │
│  ┌────────────────────────────┴──────────────────────────────┐  │
│  │  Controllers  (thin: parse req → call service → send res) │  │
│  └────────────────────────────┬──────────────────────────────┘  │
│  ┌────────────────────────────┴──────────────────────────────┐  │
│  │  Services  (all business logic, state machine, auditing)  │  │
│  └────────────────────────────┬──────────────────────────────┘  │
│  ┌────────────────────────────┴──────────────────────────────┐  │
│  │  Prisma ORM  (type-safe queries, transactions)            │  │
│  └────────────────────────────┬──────────────────────────────┘  │
└──────────────────────────────┼──────────────────────────────────┘
                               │
                  ┌────────────▼────────────┐
                  │     PostgreSQL 15        │
                  │  (Docker / Neon Cloud)   │
                  │  10+ tables, Prisma ORM  │
                  └─────────────────────────┘
```

### Backend Layered Architecture — Responsibilities

```
┌─────────────────────────────────────────────────────────────┐
│ ROUTES  (src/routes/)                                       │
│  Define: URL pattern + HTTP method + which middleware runs  │
│  Example: router.patch('/:id/status', authenticate,         │
│           authorize(['MANAGER','DEVELOPER']), controller)   │
├─────────────────────────────────────────────────────────────┤
│ CONTROLLERS  (src/controllers/)                             │
│  Thin layer: extract data from req, call service, send res  │
│  Handle: HTTP status codes (200, 400, 401, 403, 404, 500)  │
│  Do NOT contain business logic                              │
├─────────────────────────────────────────────────────────────┤
│ SERVICES  (src/services/)                                   │
│  All business logic lives here:                             │
│  - TaskService: state machine, RBAC checks, audit logging   │
│  - AuthService: password hashing, session creation          │
│  - NotificationService: create + retrieve notifications     │
│  Pure TypeScript — no knowledge of HTTP req/res objects     │
├─────────────────────────────────────────────────────────────┤
│ PRISMA ORM  (src/utils/prisma.ts)                           │
│  Singleton PrismaClient instance                            │
│  Type-safe database access — TypeScript knows all table     │
│  shapes, relation types, and query result types             │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. Database Schema

PatchFlow uses 10 core database models:

### Core Models

#### `User`
```prisma
model User {
  userId        String    @id @default(uuid())
  username      String    @unique
  passwordHash  String
  salt          String
  role          Role      // SUPER_ADMIN | CLIENT | ADMIN | MANAGER | DEVELOPER | VERIFIER
  name          String?
  designation   String?
  email         String?
  isActive      Boolean   @default(true)
  modules       Module[]  // Many-to-many: user belongs to modules
  sessions      Session[]
}
```

#### `Session` (Auth)
```prisma
model Session {
  sessionId  String   @id @default(uuid())
  userId     String
  tokenHash  String   @unique  // SHA-256 hash of the raw token
  expiresAt  DateTime           // 7-day TTL
  ipAddress  String?
  user       User     @relation(...)
}
```

#### `Task` (The Core Entity — A "Patch")
```prisma
model Task {
  id              String      @id @default(uuid())
  title           String
  description     String?
  status          TaskStatus  // DRAFT | ASSIGNED | IN_DEVELOPMENT | ...
  lifecycleStatus Int         @default(0)  // 0=active, 100=soft-deleted
  moduleId        String
  clientId        String?
  plannedStartDate DateTime?
  plannedEndDate   DateTime?
  dateStarted      DateTime?
  dateEnded        DateTime?
  
  // Many-to-many relations
  managers    User[]    // via implicit relation table
  developers  User[]    // via implicit relation table
  verifiers   User[]    // via implicit relation table
  
  // One-to-many relations
  comments      TaskComment[]
  attachments   TaskAttachment[]
  statusHistory StatusHistory[]
  auditLogs     AuditLog[]
}
```

#### `StatusHistory` (Append-Only Audit)
```prisma
model StatusHistory {
  id               String     @id @default(uuid())
  taskId           String
  previousStatus   TaskStatus?
  newStatus        TaskStatus
  changedById      String
  changedByName    String
  changedByRole    String
  reason           String?
  createdAt        DateTime   @default(now())
}
```

#### `AuditLog` (Immutable Compliance Log)
```prisma
model AuditLog {
  logId         String   @id @default(uuid())
  changedBy     String   // userId of actor
  targetUserId  String?
  fieldChanged  String   // e.g., "Task Status", "developers", "title"
  oldValue      String?  // Previous value (JSON stringified for objects)
  newValue      String?  // New value
  changedAt     DateTime @default(now())
  reason        String?
  taskId        String?
}
```

### Key Relationships
```
User ↔ Module:   Many-to-many (user can be in up to 5 modules)
User ↔ Manager:  Many-to-many via UserManager join table
Task ↔ Managers: Many-to-many (patch can have multiple managers)
Task ↔ Developers: Many-to-many (patch can have multiple developers)
Task ↔ Verifiers: Many-to-many (patch can have multiple verifiers)
Task → StatusHistory: One-to-many (append-only, never modified)
Task → AuditLog: One-to-many (append-only, never modified)
Task → Comment: One-to-many
User → Session: One-to-many (user can have multiple sessions)
```

---

## 7. The Workflow State Machine

The heart of PatchFlow is a **strict state machine** implemented in `TaskService.validateStatusTransition()`. No status change can happen without passing through this validation.

### 11 Statuses

```typescript
enum TaskStatus {
  DRAFT                 = "DRAFT",            // Just created
  ASSIGNED              = "ASSIGNED",          // Submitted to manager
  PENDING_APPROVAL      = "PENDING_APPROVAL",  // Manager reviewing
  IN_DEVELOPMENT        = "IN_DEVELOPMENT",    // Developers working
  VERIFYING             = "VERIFYING",         // QA reviewing
  COMPLETED             = "COMPLETED",         // Terminal: success
  RETURNED_TO_DEVELOPER = "RETURNED_TO_DEVELOPER", // Sent back for rework
  REJECTED              = "REJECTED",          // Terminal: rejected
  DELAYED               = "DELAYED",           // Blocked
  ON_HOLD               = "ON_HOLD",           // Paused
  CANCELLED             = "CANCELLED"          // Terminal: cancelled
}
```

### Allowed Transitions

```typescript
const ALLOWED_TRANSITIONS = {
  DRAFT:                  → [ASSIGNED]
  ASSIGNED:               → [PENDING_APPROVAL]
  PENDING_APPROVAL:       → [IN_DEVELOPMENT]
  IN_DEVELOPMENT:         → [VERIFYING]
  VERIFYING:              → [COMPLETED, RETURNED_TO_DEVELOPER, REJECTED, DELAYED, ON_HOLD, CANCELLED]
  RETURNED_TO_DEVELOPER:  → [IN_DEVELOPMENT]
  DELAYED:                → [IN_DEVELOPMENT]
  ON_HOLD:                → [IN_DEVELOPMENT]
  COMPLETED:              → []  // Terminal
  REJECTED:               → []  // Terminal
  CANCELLED:              → []  // Terminal
}
```

### Role-Based Transition Authorization

| Transition | Authorized Roles | Additional Conditions |
|---|---|---|
| DRAFT → ASSIGNED | CLIENT, Author, Manager | Client must own the task; or author/manager if no client |
| ASSIGNED → PENDING_APPROVAL | MANAGER | Must be in `task.managers[]` OR be team manager of assigned developers |
| PENDING_APPROVAL → IN_DEVELOPMENT | MANAGER | Same team manager check |
| IN_DEVELOPMENT → VERIFYING | DEVELOPER | Must be in `task.developers[]` |
| VERIFYING → COMPLETED | VERIFIER | Must be in `task.verifiers[]` |
| VERIFYING → RETURNED_TO_DEVELOPER | VERIFIER | Must be in `task.verifiers[]` |
| VERIFYING → REJECTED/DELAYED/ON_HOLD/CANCELLED | VERIFIER | Must be in `task.verifiers[]` |
| RETURNED_TO_DEV/DELAYED/ON_HOLD → IN_DEVELOPMENT | DEVELOPER or MANAGER | Developer assigned, or task/team manager |
| **Any → Any** | SUPER_ADMIN, ADMIN | Full bypass — no role or team checks |

### What Happens on Every Transition
Every single status change triggers 4 things automatically:
1. **`task.status` updated** in the database
2. **New `StatusHistory` row** created (actor, old status, new status, reason, timestamp)
3. **New `AuditLog` row** created (mirrors status history — immutable compliance record)
4. **`Notification` rows created** for all relevant users based on new status

---

## 8. Role-Based Access Control (RBAC)

RBAC is enforced at two levels:
1. **Middleware level** — `authorize(['MANAGER', 'ADMIN'])` on routes (coarse-grained)
2. **Service level** — `TaskService` checks if you own/are-assigned-to the specific task (fine-grained)

### Roles & Permissions

| Role | Create Patches | Move Workflow | See All Patches | Manage Users | Delete/Restore |
|---|---|---|---|---|---|
| **SUPER_ADMIN** | ✅ | ✅ (bypass all rules) | ✅ | ✅ | ✅ |
| **ADMIN** | ✅ | ✅ (bypass all rules) | ✅ | ❌ (can't create users) | ✅ |
| **MANAGER** | ✅ | ✅ (ASSIGNED→PENDING→IN_DEV) | Own team only | ❌ | ❌ |
| **DEVELOPER** | ✅ | ✅ (IN_DEV→VERIFYING) | Assigned patches only | ❌ | ❌ |
| **VERIFIER** | ❌ | ✅ (VERIFYING→final) | Assigned patches only | ❌ | ❌ |
| **CLIENT** | ✅ (own only) | ✅ (DRAFT→ASSIGNED) | Own patches only | ❌ | ❌ |

### Data Scoping (Row-Level Filtering in Application Layer)
- **CLIENT**: `WHERE authorId = me OR clientId = me`
- **DEVELOPER**: `WHERE me IN task.developers[]`
- **VERIFIER**: `WHERE me IN task.verifiers[]`
- **MANAGER**: `WHERE me IN task.managers[] OR author = me OR assigned to my direct reports`
- **ADMIN/SUPER_ADMIN**: `WHERE lifecycleStatus = 0` (all active patches)

---

## 9. API Endpoints Reference

### Authentication — `/api/auth`
| Method | Endpoint | Auth Required | Description |
|---|---|---|---|
| POST | `/api/auth/login` | None | Login with username + password. Returns session token. |
| POST | `/api/auth/register` | Bearer + SUPER_ADMIN | Create a new user account |
| GET | `/api/auth/me` | Bearer | Get current authenticated user info |
| GET | `/api/auth/users` | Bearer | List all users |
| POST | `/api/auth/logout` | Bearer | Invalidate current session token |

### Tasks (Patches) — `/api/tasks`
| Method | Endpoint | Auth Required | Description |
|---|---|---|---|
| GET | `/api/tasks` | Bearer | List patches (RBAC scoped to your role) |
| GET | `/api/tasks/:id` | Bearer | Full patch detail: relations, history, comments, audit |
| POST | `/api/tasks` | Bearer | Create a new patch |
| PATCH | `/api/tasks/:id/status` | Bearer | Transition workflow status |
| PATCH | `/api/tasks/:id/details` | Bearer | Update title, description, assignments, dates |
| POST | `/api/tasks/:id/comments` | Bearer | Add a comment (supports file metadata) |
| DELETE | `/api/tasks/:id` | Bearer + ADMIN | Soft delete (sets lifecycleStatus = 100) |
| POST | `/api/tasks/:id/restore` | Bearer + ADMIN | Restore soft-deleted patch |
| POST | `/api/tasks/:id/assign` | Bearer | Assign a developer to the patch |

### Users — `/api/users`
| Method | Endpoint | Auth Required | Description |
|---|---|---|---|
| GET | `/api/users` | Bearer | List active users (filter: `?role=MANAGER&moduleId=...`) |
| GET | `/api/users/:id/modules` | Bearer | Get which modules a user is assigned to |
| PUT | `/api/users/:id/modules` | Bearer + ADMIN | Update user's module assignments (max 5) |
| PUT | `/api/users/:id/managers` | Bearer + ADMIN | Update user's manager assignments (max 3) |
| POST | `/api/users/:id/reset-password` | Bearer + ADMIN | Reset a user's password |
| DELETE | `/api/users/:id` | Bearer + ADMIN | Deactivate user (soft delete) |

### Modules — `/api/modules`
| Method | Endpoint | Auth Required | Description |
|---|---|---|---|
| GET | `/api/modules` | Bearer | List all modules |
| GET | `/api/modules/hierarchy` | Bearer + ADMIN | Per-module matrix of all assigned users |
| POST | `/api/modules` | Bearer + ADMIN | Create a new module |
| PATCH | `/api/modules/:id` | Bearer + ADMIN | Update module name/description/status |

### Reports — `/api/reports`
| Method | Endpoint | Auth Required | Description |
|---|---|---|---|
| GET | `/api/reports/history` | Bearer | Status + audit history (RBAC filtered) |
| GET | `/api/reports/data` | Bearer | Filtered report data (time range, module, user, status) |

### Notifications — `/api/notifications`
| Method | Endpoint | Auth Required | Description |
|---|---|---|---|
| GET | `/api/notifications` | Bearer | All notifications for authenticated user |
| PATCH | `/api/notifications/:id/read` | Bearer | Mark a notification as read |

---

## 10. Security Architecture

| Concern | Implementation |
|---|---|
| **Password Storage** | bcrypt with cost factor 12 (~250ms per hash). Never stored in plaintext. |
| **Session Tokens** | 32-byte random hex. Only SHA-256 hash stored in DB. Raw token never persisted server-side. |
| **Session Expiry** | 7-day TTL. Expired sessions cleaned opportunistically on login. |
| **No JWTs** | Server-side sessions allow instant revocation — critical for enterprise compliance. |
| **SQL Injection** | Structurally impossible — Prisma parameterizes all queries. |
| **Authorization** | Double-checked: middleware (role level) + service (ownership level). |
| **Audit Logging** | All state changes, assignments, and modifications logged immutably with actor, timestamp, and before/after values. |
| **Soft Deletes** | No data is ever hard-deleted. Full history preserved for compliance. |
| **Input Validation** | Trimmed, type-checked, length-validated before hitting the database. |
| **CORS** | Configured to only allow requests from the frontend origin. |

---

## 11. Running the Project Locally

### Prerequisites
- Node.js 18+ (`node --version`)
- Docker Desktop (for local PostgreSQL)

### Step 1: Start PostgreSQL
```bash
# From the project root
docker compose -f docker-compose.local-postgres.yml up -d

# This starts a PostgreSQL 15 container on port 5432
# Database: patchflow | User: postgres | Password: password
```

### Step 2: Set Up Backend
```bash
cd backend

# Install dependencies
npm install

# Create the .env file
echo 'DATABASE_URL="postgresql://postgres:password@localhost:5432/patchflow?schema=public"' > .env

# Push the Prisma schema to the database (creates all tables)
npx prisma db push

# Seed the database with demo users, modules, and patches
npx tsx prisma/seed.ts

# Start the development server (hot reload on port 5001)
npm run dev
```

### Step 3: Set Up Frontend
```bash
# In a new terminal
cd frontend

# Install dependencies
npm install

# Start the Vite development server (port 5173)
npm run dev
```

### Step 4: Open the App
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:5001/api
- **Health Check**: http://localhost:5001/health

### Environment Variables (Backend `.env`)
```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/patchflow?schema=public"
PORT=5001
# Optional: NODE_ENV=development
```

---

## 12. Design Decisions & Why This Stack

### Why not a Monolith (Single Next.js app)?
Next.js combines frontend and backend in one framework using API Routes. This was rejected because:
1. PatchFlow is an **internal tool** — SEO (Next.js's main advantage) is irrelevant
2. **Independent scaling**: the backend may need to scale to 10 instances while the frontend stays as 1 static deployment
3. **Cleaner separation**: Express backend can be tested independently with Supertest; React frontend tested with Vitest
4. **Any frontend later**: a React Native mobile app, CLI tool, or third-party integration can consume the same Express API without changes

### Why not WebSockets for real-time notifications?
REST polling (refetch on tab focus) was chosen for the MVP because:
- WebSockets require connection management, reconnection logic, and state synchronization
- For 30 users, the complexity cost outweighs the UX benefit
- **Future path**: Server-Sent Events (SSE) or WebSocket can be added to the existing Express app without architectural changes

### Why Soft Delete instead of Hard Delete?
Compliance. The `lifecycleStatus` field uses `0 = active`, `100 = deleted`. When a patch is "deleted":
- It disappears from regular views
- All comments, status history, and audit logs remain intact
- Only ADMIN+ can see deleted patches (`?includeDeleted=true`)
- Any future audit can reconstruct the complete history of a deleted patch

### Why not testing (yet)?
The project is in MVP/demo phase. The testing infrastructure is defined and ready to implement:
- **Backend**: Jest + Supertest (HTTP integration tests against a test database)
- **Frontend**: Vitest + React Testing Library (component tests)

### Why Auto-Promote DRAFT → ASSIGNED?
When creating a patch, if all three resource types (managers, developers, verifiers) are provided in the creation request, the patch automatically starts in `ASSIGNED` status — skipping the manual DRAFT → ASSIGNED transition. This reduces friction for experienced users who know exactly what resources to assign upfront.

---

## 13. Scalability Roadmap

| Phase | User Count | Architecture Changes |
|---|---|---|
| **MVP** (current) | 30–50 | Single Node.js process + Vite static files + single PostgreSQL instance |
| **Growth** | 50–500 | PM2 cluster mode (use all CPU cores), Redis for session caching (remove per-request DB lookup), PostgreSQL read replicas for reports |
| **Enterprise** | 500–5,000 | Microservices: auth-service, task-service, notification-service. RabbitMQ message queue for async notifications. CDN for file uploads. Kubernetes for container orchestration. |

### Why is the current architecture not bottlenecked?
- Node.js's event loop handles ~5,000 concurrent requests per process on a single core
- Prisma + PostgreSQL connection pooling handles ~100 concurrent DB connections
- The bottleneck at 30–50 users is effectively zero — the system is massively over-provisioned for MVP scale

---

## 14. Demo Accounts

All accounts use password: **`Admin@123`**

| Username | Role | What They Can Do |
|---|---|---|
| `superadmin1` | SUPER_ADMIN | Everything — full system access, bypass all workflow rules |
| `admin1` | ADMIN | Everything except creating new user accounts |
| `manager1` | MANAGER | Approve patches, manage team assignments, move workflow |
| `developer1` | DEVELOPER | Work on assigned patches, move IN_DEV → VERIFYING |
| `verifier1` | VERIFIER | Review and accept/reject patches in VERIFYING status |
| `client1` | CLIENT | Create patch requests, track their status |

The frontend includes a **SwitchAccountDropdown** in the top bar — you can switch between any of these demo accounts without manually logging out and in, for easy demonstration.

---

## Tech Stack Summary

```
┌────────────────────────────────────────────────────────────┐
│                     PATCHFLOW STACK                         │
├─────────────────────┬──────────────────────────────────────┤
│ FRONTEND            │ BACKEND                              │
│ React 19            │ Node.js 18+ LTS                     │
│ Vite 8              │ Express 5                            │
│ Tailwind CSS 4      │ TypeScript 6                         │
│ TypeScript 6        │ Prisma ORM 6                         │
│ React Router 7      │ bcrypt 6                             │
│ Zustand 5           │ cors, crypto (built-in)              │
│ Axios 1             │                                      │
│ React Hook Form 7   │ DATABASE                             │
│ Zod 4               │ PostgreSQL 15                        │
│ Recharts            │ (Docker local / Neon cloud)          │
│ jsPDF               │                                      │
│ xlsx                │ AUTH                                 │
│ Lucide React        │ Custom SHA-256 session tokens        │
│                     │ (no JWT — server-revocable)          │
└─────────────────────┴──────────────────────────────────────┘
```

---

*PatchFlow — Engineering Deployment Governance Platform*
*Built with TypeScript end-to-end, PostgreSQL for data integrity, and a strict workflow state machine for compliance.*
