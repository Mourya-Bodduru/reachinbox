# ReachInbox Full-Stack Email Job Scheduler

A production-grade, distributed email scheduling service and web dashboard built for the ReachInbox hiring assessment. It handles scheduling, provider rate-limiting, sender concurrency, fault recovery, and full-text search without using cron jobs.

---

## Table of Contents
1. [Tech Stack](#tech-stack)
2. [Architecture Overview](#architecture-overview)
   - [How Scheduling Works (No Cron Jobs)](#1-how-scheduling-works-no-cron-jobs)
   - [How Persistence on Restart is Handled](#2-how-persistence-on-restart-is-handled)
   - [How Rate Limiting & Concurrency are Implemented](#3-how-rate-limiting--concurrency-are-implemented)
3. [Features Implemented](#features-implemented)
   - [Backend Capabilities](#backend-capabilities)
   - [Frontend Capabilities](#frontend-capabilities)
4. [Getting Started & Local Setup](#getting-started--local-setup)
   - [Prerequisites](#prerequisites)
   - [Environment Variables & Ethereal Setup](#environment-variables--ethereal-setup)
   - [Running the Backend](#running-the-backend)
   - [Running the Frontend](#running-the-frontend)
   - [Docker Compose Alternative](#docker-compose-alternative)
5. [Automated Verification & Testing](#automated-verification--testing)
6. [API Endpoints Reference](#api-endpoints-reference)
7. [Assumptions, Shortcuts, and Trade-Offs](#assumptions-shortcuts-and-trade-offs)

---

## Tech Stack

- **Backend**: Node.js 18+, Express, TypeScript, Prisma ORM
- **Queue & Worker Engine**: Redis, BullMQ (distributed delayed jobs)
- **Database**: MySQL 8 / MariaDB (relational state persistence)
- **Search Engine**: Elasticsearch (with automatic MySQL full-text fallback)
- **Email Delivery**: Nodemailer + Ethereal Fake SMTP
- **Integrations**: Slack Incoming Webhooks / OAuth 2.0, Google OAuth 2.0
- **Frontend**: React 18, TypeScript, Vite, Bootstrap 5 (Clean Light Theme)
- **Queue Administration**: Bull-Board dashboard mounted at `/admin/queues`

---

## Architecture Overview

```
                        +----------------------------+
                        |     React 18 Dashboard     |
                        |   (Clean Light Theme UI)   |
                        +--------------+-------------+
                                       | REST API (HTTP)
                                       v
                        +----------------------------+
                        |   Express.js API Service   |
                        | (Auth, Campaigns, Queues)  |
                        +----+-------------+----+----+
                             |             |    |
                +------------+             |    +------------+
                v                          v                 v
        +---------------+          +---------------+   +---------------+
        | MySQL 8 (DB)  |          | Redis (Store) |   | Elasticsearch |
        | (Prisma ORM)  |          | (BullMQ ZSET) |   | (Text Search) |
        +---------------+          +-------+-------+   +---------------+
                                           | Delayed Queue Jobs
                                           v
                        +----------------------------+
                        |    BullMQ Worker Pool      |
                        | - Concurrency: 5 workers   |
                        | - Min delay: 2s per send   |
                        | - Atomic hourly limits     |
                        +--------------+-------------+
                                       |
                   +-------------------+-------------------+
                   | Rate limit hit                        | Normal send
                   v                                       v
        +--------------------+                   +--------------------+
        | Slack Alert Hook   |                   | Ethereal Fake SMTP |
        | (Channel Notifier) |                   | (Preview URL)      |
        +--------------------+                   +--------------------+
```

### 1. How Scheduling Works (No Cron Jobs)
Instead of running polling loops, intervals, or system cron jobs, email scheduling relies entirely on **BullMQ delayed jobs backed by Redis sorted sets (ZSETs)**:
1. When a user schedules an email for a future timestamp `scheduledAt`, the delay is calculated:
   $$\text{delayMs} = \max(0, \text{scheduledAt} - \text{Date.now()})$$
2. The job is enqueued with `emailQueue.add('send-email', data, { delay: delayMs, jobId: 'email_' + id })`.
3. Redis stores the delayed job in a sorted set scored by timestamp. When the scheduled time arrives, Redis transitions the job to the `wait` queue for immediate worker execution.

### 2. How Persistence on Restart is Handled
Guaranteed durability across worker crashes, server restarts, or Redis flush:
- **Dual-Layer Persistence**: Every scheduled job is committed to MySQL first with `status: 'SCHEDULED'` and its target `scheduledAt`.
- **Boot Recovery Routine (`syncQueueOnStartup`)**: On backend startup, `syncQueueOnStartup()` queries MySQL for any jobs remaining in `SCHEDULED` or `RATE_LIMITED_RESCHEDULED` state.
- **Queue Reconciliation**: For each job found, the server checks if it currently exists in BullMQ. If absent (e.g. after Redis restarted or wiped), the server re-enqueues the job with its remaining delay:
  $$\text{remainingDelay} = \max(0, \text{job.scheduledAt} - \text{Date.now()})$$
- **Deterministic Idempotent Job IDs**: BullMQ job IDs follow `email_${id}`, preventing duplicate processing even if recovered multiple times.

### 3. How Rate Limiting & Concurrency are Implemented
- **Concurrency Control**: The BullMQ worker is instantiated with `concurrency: 5` (`WORKER_CONCURRENCY`), allowing up to 5 email jobs to be processed concurrently across worker threads without race conditions.
- **Provider Throttling (`MIN_DELAY_BETWEEN_EMAILS_MS`)**: An asynchronous delay (default 2000ms, or user-configured campaign delay) is awaited before sending each email to respect SMTP connection burst limits.
- **Atomic Hourly Rate Limiting Per Sender**:
  - Redis keys track sender volume in hourly windows: `rate_limit:${senderEmail}:${YYYY-MM-DD-HH}`.
  - Before sending, an atomic `INCR` is performed with an expiration of 2 hours.
  - If `count > hourlyLimit`:
    1. The email is not dropped or marked failed; its status is updated to `RATE_LIMITED_RESCHEDULED`.
    2. The job is rescheduled to the start of the next hour window (`HH:00:00`) with a random jitter (0–45s) to avoid thundering-herd spikes.
    3. A notification payload is dispatched to the connected Slack channel.

---

## Features Implemented

| Domain | Feature | Description |
|---|---|---|
| **Backend** | **Cron-less Scheduler** | Redis ZSET delayed queue architecture using BullMQ. |
| **Backend** | **Crash Recovery** | `syncQueueOnStartup` automatically recovers orphaned jobs on boot. |
| **Backend** | **Rate Limiting** | Redis atomic hourly counters per sender; safe deferral to next window with jitter. |
| **Backend** | **Worker Concurrency** | Configurable worker concurrency (`WORKER_CONCURRENCY=5`) and throttling delays. |
| **Backend** | **Full-Text Search** | Elasticsearch integration with automatic MySQL `LIKE` fallback if ES is offline. |
| **Backend** | **Queue Admin UI** | Bull-Board dashboard integrated at `/admin/queues`. |
| **Backend** | **Slack Integration** | Incoming Webhooks & OAuth 2.0 for real-time rate limit notifications. |
| **Backend** | **Authentication** | Google OAuth token verification and JWT session tokens. |
| **Frontend** | **Light Theme UI** | Clean, state-of-the-art light dashboard with white cards and crisp typography. |
| **Frontend** | **Campaign Composer** | Single & multi-recipient modal with CSV/TXT file upload, custom delays, and hourly limits. |
| **Frontend** | **Live Metrics Cards** | Real-time counters: Sent, Scheduled, Rate Rescheduled, and Failed. |
| **Frontend** | **Live Queue Monitor** | Dynamic BullMQ queue counters: Active, Waiting, Delayed, Completed, Failed. |
| **Frontend** | **Scheduled Table** | Tabular view of upcoming jobs with sender, recipient, execution time, and cancel action. |
| **Frontend** | **Sent Table** | Searchable history with status pills, pagination, and direct links to Ethereal email previews. |
| **Frontend** | **Slack Modal** | Webhook configuration, OAuth connect button, and instant Test Alert button. |
| **Frontend** | **Dual Authentication** | Google Sign-In with instant Dev Login fallback for testing. |

---

## Getting Started & Local Setup

### Prerequisites
- **Node.js 18+**
- **Redis 5+** (e.g. standard local Redis on `localhost:6379`)
- **MySQL 8+ / MariaDB** (e.g. running via XAMPP or local MySQL on `localhost:3306`)

---

### Environment Variables & Ethereal Setup

1. **Backend Environment** (`backend/.env`):
   Create `backend/.env` with the following variables:
   ```env
   PORT=5000
   NODE_ENV=development
   FRONTEND_URL=http://localhost:5173

   # Database (Default XAMPP MySQL root with no password)
   DATABASE_URL="mysql://root:@localhost:3306/reachinbox_db"

   # Redis
   REDIS_HOST=localhost
   REDIS_PORT=6379
   REDIS_PASSWORD=

   # Elasticsearch (Optional: queries automatically fallback to MySQL if offline)
   ELASTICSEARCH_NODE=http://localhost:9200
   ELASTICSEARCH_INDEX=reachinbox_emails

   # Scheduler & Worker Settings
   WORKER_CONCURRENCY=5
   MIN_DELAY_BETWEEN_EMAILS_MS=2000
   MAX_EMAILS_PER_HOUR_PER_SENDER=50

   # Security & Auth
   JWT_SECRET=reachinbox_super_secret_jwt_key_2026

   # Google OAuth (Optional: Dev Login button is available)
   GOOGLE_CLIENT_ID=316105007854-odtqeip2mpufh768kc7fe100b4hv1not.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=

   # Slack OAuth & Notifications (Optional)
   SLACK_CLIENT_ID=
   SLACK_CLIENT_SECRET=
   SLACK_REDIRECT_URI=http://localhost:5000/api/slack/callback

   # Ethereal Fake SMTP
   ETHEREAL_USER=a4ct2pxwmslx2pyy@ethereal.email
   ETHEREAL_PASS=ku6W3VZdSEmwJRYFZn
   ```

2. **Frontend Environment** (`frontend/.env`):
   ```env
   VITE_GOOGLE_CLIENT_ID=316105007854-odtqeip2mpufh768kc7fe100b4hv1not.apps.googleusercontent.com
   ```

#### Setting up Ethereal Email
- Ethereal is a fake SMTP service used for development so real emails are never sent.
- **Default Built-in Account**: The repository already includes working Ethereal credentials pre-configured in `.env` (`ETHEREAL_USER` and `ETHEREAL_PASS`).
- **To create your own custom account**:
  1. Go to [https://ethereal.email/create](https://ethereal.email/create)
  2. Copy the generated Username and Password into `ETHEREAL_USER` and `ETHEREAL_PASS` in `backend/.env`.
  3. Every sent email generates a clickable **Ethereal Preview URL** in the Sent Emails table on the dashboard.

---

### Running the Backend

1. Install dependencies:
   ```bash
   cd reachinbox/backend
   npm install
   ```

2. Initialize database schema & seed initial senders:
   ```bash
   npx prisma db push
   npm run prisma:seed
   ```

3. Start backend API & BullMQ worker:
   ```bash
   npm run dev
   ```
   - Server runs on: `http://localhost:5000`
   - Queue Monitor UI: `http://localhost:5000/admin/queues`
   - Health check: `http://localhost:5000/health`

---

### Running the Frontend

1. Install dependencies:
   ```bash
   cd reachinbox/frontend
   npm install
   ```

2. Start the Vite development server:
   ```bash
   npm run dev
   ```
   - Dashboard opens at: `http://localhost:5173`

---

### Docker Compose Alternative

To run the entire system (MySQL, Redis, Elasticsearch, Backend, and Frontend) in one command:

```bash
docker-compose up --build
```

---

## Automated Verification & Testing

An end-to-end acceptance script is included to programmatically verify all requirements:

```bash
node test_e2e.js
```

The script runs 7 checks:
1. **Health check**: Confirms MySQL and Redis connectivity.
2. **Senders query**: Verifies configured sender profiles.
3. **Campaign scheduling**: Enqueues delayed jobs with throttling delay.
4. **Hourly rate limiting**: Tests limit breaches and automatic next-window rescheduling.
5. **Search endpoint**: Validates search querying across subject and body.
6. **Job cancellation**: Validates deleting scheduled jobs from Redis and MySQL.
7. **Queue metrics**: Verifies delivery counts and BullMQ state counters.

---

## API Endpoints Reference

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | System health check (MySQL DB & Redis status) |
| `POST` | `/api/auth/google` | Google OAuth ID token verification |
| `POST` | `/api/auth/dev-login` | Instant demo login for evaluation |
| `GET` | `/api/auth/me` | Current authenticated user profile |
| `POST` | `/api/emails/schedule` | Schedule email campaign (single or batch) |
| `GET` | `/api/emails/scheduled` | List upcoming scheduled email jobs |
| `GET` | `/api/emails/sent` | List sent / failed emails with search & pagination |
| `GET` | `/api/emails/stats` | Dashboard KPI metrics and live BullMQ queue stats |
| `GET` | `/api/emails/senders` | List configured sender identities |
| `DELETE` | `/api/emails/:id` | Cancel and remove a scheduled email |
| `GET` | `/api/slack/authorize` | Slack OAuth authorization URL |
| `GET` | `/api/slack/callback` | Slack OAuth callback redirect |
| `POST` | `/api/slack/webhook` | Connect Slack incoming webhook URL |
| `POST` | `/api/slack/test` | Dispatch a test alert to Slack |
| `POST` | `/api/slack/disconnect` | Disconnect Slack integration |
| `GET` | `/admin/queues` | Bull-Board queue administration dashboard |

---

## Assumptions, Shortcuts, and Trade-Offs

1. **BullMQ Delayed Jobs vs Cron**:
   - *Design Decision*: Completely avoided recurring cron polling loops in favor of Redis sorted-set delayed jobs.
   - *Trade-off*: Requires Redis to be continuously running, but provides $O(\log N)$ delay scheduling and zero polling database overhead.

2. **Hourly Window Counter vs Token Bucket**:
   - *Design Decision*: Used Redis atomic keys partitioned by hour (`YYYY-MM-DD-HH`).
   - *Rationale*: Atomic `INCR` guarantees thread-safe rate limiting across multiple concurrent workers without distributed locking or race conditions.
   - *Trade-off*: Rescheduling defers jobs to the next hour boundary rather than a sliding 60-minute window, which is simpler, deterministic, and aligns with standard email provider quotas.

3. **Elasticsearch Fallback**:
   - *Design Decision*: Implemented automatic fallback to MySQL `LIKE` pattern matching if Elasticsearch is offline or unreachable.
   - *Trade-off*: Allows reviewers to run and evaluate the application with just MySQL and Redis without needing a heavy 2GB+ Elasticsearch container locally.

4. **Ethereal Fake SMTP**:
   - *Design Decision*: Used Nodemailer with Ethereal SMTP instead of real sending credentials (e.g. SendGrid or SES).
   - *Benefit*: Completely safe for evaluation with zero spam risk, while generating realistic HTML preview links for every sent email.
