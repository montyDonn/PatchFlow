# PatchFlow 🚀

## Overview
PatchFlow is a **collaborative patch management platform** designed to streamline the end‑to‑end workflow of handling software patches, bug fixes, and feature requests. It provides a unified board where clients, managers, and developers can interact, assign resources, set deadlines, and track progress across multiple stages.

---

## The Problem
- **Visibility gaps** – Managers could not see detailed patch information after logging in.
- **Uneditable deadlines** – The first stage (estimated deadline) was immutable for admins/managers.
- **Manual resource allocation** – Assigning developers to a patch required separate UI steps, leading to errors and delays.
- **Fragmented UI** – Users had to navigate through several pages to approve and assign a patch.

---

## Our Solution
PatchFlow introduces a **single‑page board** with:
1. **Full patch details** visible to managers after login.
2. **Inline deadline editing** – admins/managers can modify the `plannedEndDate` directly from the details modal.
3. **“Approve & Assign”** workflow – a dedicated card that lets a manager set the deadline, assign developers/verifiers, and move the patch to the `ASSIGNED` stage in one action (no extra “Move to Next Stage” button).
4. **Automatic prompts** – when a patch reaches the `ASSIGNED` stage, the UI highlights the need to allocate resources.

---

## Key Features
- Role‑based access control (Admin, Manager, Developer, Verifier).
- Real‑time status transitions with audit logging.
- Inline editing of deadlines and resource assignments.
- Clean, modern UI built with **React + Vite**, styled with premium CSS (glassmorphism, gradients, smooth animations).
- Backend API powered by **Spring Boot 3.3**, JPA, PostgreSQL.
- Comprehensive test suite (JUnit 5, Spring Boot Test) ensuring 100% pass rate.

---

## Tech Stack
| Layer | Technology |
|------|------------|
| Frontend | **React** (TypeScript) · Vite · Tailwind‑like custom CSS (premium design) |
| Backend | **Spring Boot 3.3** · JPA/Hibernate · PostgreSQL |
| DevOps | Maven · Node.js (npm) · Docker (optional) |
| Testing | JUnit 5 · Spring Boot Test · React Testing Library |

---

## Getting Started
### Prerequisites
- **Java 21** (or newer) and Maven installed.
- **Node.js 20** and npm.
- **PostgreSQL** instance (default credentials are in `application.yml`).

### Backend
```bash
cd backend
mvn clean install     # builds the JAR and runs tests
mvn spring-boot:run   # starts the API on http://localhost:8080
```
The API exposes endpoints under `/api/*` (auth, users, modules, tasks, etc.).

### Frontend
```bash
cd frontend
npm install          # install dependencies
npm run dev           # starts Vite dev server on http://localhost:5173
```
The UI automatically talks to the backend (CORS enabled).

---

## Running the Full Stack
1. Start PostgreSQL (or use the provided Docker compose file). 
2. In one terminal, run the backend (`mvn spring-boot:run`).
3. In another terminal, run the frontend (`npm run dev`).
4. Open **http://localhost:5173** in a browser and log in with the seeded admin credentials (`admin / upcl@123`).

---

## Testing
```bash
# Backend tests
mvn test
# Frontend tests
npm run test
```
All tests should pass.

---

## Contributing
Feel free to open issues or PRs. Follow the conventional commit style and ensure that new code meets the existing code‑style and passes all tests.

---

## License
This project is licensed under the **MIT License**.

---

_Repository_: https://github.com/dhxrni/PatchFlow
