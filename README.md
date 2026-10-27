# QueueBite Backend

Production-ready backend API and real-time virtual queue management engine for **QueueBite**.

## Tech Stack

- **Runtime:** Node.js (LTS)
- **Framework:** Fastify 5.x
- **Language:** TypeScript 5.x
- **Database:** PostgreSQL with Prisma ORM 6.x
- **Validation:** Zod
- **Testing:** Vitest
- **API Documentation:** OpenAPI 3.0 / Swagger UI (@fastify/swagger & @fastify/swagger-ui)

## Project Structure

```
queuebite_backend/
├── prisma/
│   ├── migrations/             # Applied database migrations
│   └── schema.prisma           # Authoritative Prisma schema
├── src/
│   ├── config/
│   │   └── env.ts              # Zod-validated environment config
│   ├── errors/
│   │   └── app-error.ts        # Structured AppError classes and global error handler
│   ├── modules/
│   │   └── health/
│   │       └── health.routes.ts# Liveness (/health) and DB readiness (/ready) probes
│   ├── plugins/
│   │   ├── prisma.ts           # Prisma client Fastify plugin
│   │   └── swagger.ts          # OpenAPI / Swagger UI plugin
│   ├── app.ts                  # Fastify application factory
│   └── server.ts               # Server entry point with graceful shutdown
├── tests/
│   └── health.test.ts          # Automated integration tests
├── .env.example                # Example environment variables
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## Quick Start

### 1. Configure Environment Variables
Copy `.env.example` to `.env` and configure your credentials:
```bash
cp .env.example .env
```

Ensure `DATABASE_URL` points to your PostgreSQL instance.

### 2. Install Dependencies
```bash
npm install
```

### 3. Generate Prisma Client & Run Migrations
```bash
npm run prisma:generate
npm run prisma:migrate
```

### 4. Run Development Server
```bash
npm run dev
```
The server will start at `http://localhost:4000`.
Interactive Swagger UI is accessible at `http://localhost:4000/docs`.

### 5. Run Tests
```bash
npm test
```

### 6. Build & Run in Production Mode
```bash
npm run build
npm start
```
