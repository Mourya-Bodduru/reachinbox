# ReachInbox Email Job Scheduler

A distributed email scheduler service and web dashboard built for the ReachInbox hiring assessment. It handles scheduling, provider rate-limiting, sender concurrency, fault recovery, and full-text search without using cron jobs.

## Tech Stack

- **Backend**: Node.js, Express, TypeScript, Prisma ORM
- **Queue & Storage**: Redis, BullMQ, MySQL 8
- **Search**: Elasticsearch (with automatic MySQL query fallback)
- **Email Delivery**: Nodemailer + Ethereal Fake SMTP
- **Integrations**: Slack OAuth / Webhooks, Google OAuth 2.0
- **Frontend**: React 18, TypeScript, Vite, Bootstrap 5 (Clean Light Theme)

---

## Architecture Overview

```
                        +----------------------------+
                        |   React 18 Dashboard       |
                        |   (Clean Light Theme)      |
                        +--------------+-------------+
                                       | HTTP / REST
                                       v
                        +----------------------------+
                        |   Express.js API Service   |
                        |   (Auth, Search, Queues)   |
                        +----+-------------+----+----+
                             |             |    |
                +------------+             |    +------------+
                v                          v                 v
        +---------------+          +---------------+   +---------------+
        | MySQL 8 (DB)  |          | Redis (Store) |   | Elasticsearch |
        | (Prisma ORM)  |          | (BullMQ ZSET) |   | (Text Search) |
        +---------------+          +-------+-------+   +---------------+
                                           | Delayed Jobs
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

---

## Core Requirements & Implementation

### 1. Scheduling Without Cron Jobs
Instead of running polling loops or cron intervals, email scheduling relies entirely on BullMQ delayed jobs backed by Redis sorted sets.
- When an email is scheduled for a future timestamp `scheduledAt`, the delay is computed as `Math.max(0, scheduledAt - Date.now())`.
- Redis holds the job in a sorted set (`delayed`), scored by execution time. When the time arrives, Redis transitions the job to `wait` state for immediate worker execution.

### 2. Persistence & Recovery Across Server Crashes
- **State Persistence**: Job metadata, recipient details, and execution status are persisted in MySQL.
- **Queue Synchronization on Boot**: During service startup (`syncQueueOnStartup`), the server queries MySQL for any jobs remaining in `SCHEDULED` or `RATE_LIMITED_RESCHEDULED` state. If a job is not found in Redis (e.g. after a Redis restart or wipe), it is automatically re-enqueued with its remaining delay.
- **Deterministic Job IDs**: Queue job IDs use the format `email_${id}` to ensure idempotency and eliminate duplicate sends.

### 3. Worker Concurrency & Provider Throttling
- The BullMQ worker operates with configurable concurrency (`WORKER_CONCURRENCY=5`).
- Before sending each email, an asynchronous delay (`MIN_DELAY_BETWEEN_EMAILS_MS`, default 2000ms) is enforced to respect provider rate limits.

### 4. Hourly Rate Limiting Per Sender
- Rate limit keys are stored in Redis using hourly windows: `rate_limit:${senderEmail}:${hourWindowKey}` where `hourWindowKey` is formatted as `YYYY-MM-DD-HH`.
- Each send attempts an atomic `INCR`. If the count exceeds the sender's hourly limit:
  1. The email is not dropped or failed; its status is updated to `RATE_LIMITED_RESCHEDULED`.
  2. The job is rescheduled to the top of the next hour window with a small random jitter to avoid thundering herd.
  3. A notification is dispatched to the connected Slack channel.

### 5. Full-Text Search
- Emails are indexed into Elasticsearch under `reachinbox_emails`.
- The search endpoint queries Elasticsearch for recipient, sender, subject, and body text.
- If Elasticsearch is not reachable or disabled, the query automatically falls back to MySQL database filtering so user workflows remain uninterrupted.

### 6. Light Theme Dashboard
- Fully styled in a clean, modern light theme (white cards, clean slate borders, crisp typography).
- Displays live KPI cards (Sent, Scheduled, Rescheduled, Failed) and active BullMQ queue counters.
- Supports single or multi-recipient campaigns via text input or CSV/TXT file upload.
- Table view with status pills, pagination, and direct links to Ethereal email previews.
- Live Bull-Board queue monitor mounted at `/admin/queues`.

---

## Getting Started

### Prerequisites
- Node.js 18+
- MySQL 8 (running locally or in a container)
- Redis 5+ (running locally or in a container)

### Local Setup

1. **Clone the repository and install dependencies**:
   ```bash
   cd reachinbox
   cd backend && npm install
   cd ../frontend && npm install
   ```

2. **Configure environment variables**:
   Create a `.env` file in the `backend/` directory (or use `.env.example` as a template):
   ```env
   PORT=5000
   NODE_ENV=development
   FRONTEND_URL=http://localhost:5173

   # Database
   DATABASE_URL="mysql://root:@localhost:3306/reachinbox_db"

   # Redis
   REDIS_HOST=localhost
   REDIS_PORT=6379

   # Elasticsearch (optional, falls back to MySQL if offline)
   ELASTICSEARCH_NODE=http://localhost:9200
   ELASTICSEARCH_INDEX=reachinbox_emails

   # Scheduler Configuration
   WORKER_CONCURRENCY=5
   MIN_DELAY_BETWEEN_EMAILS_MS=2000
   MAX_EMAILS_PER_HOUR_PER_SENDER=50

   # Security & Auth
   JWT_SECRET=reachinbox_development_jwt_secret_key

   # Optional OAuth credentials
   GOOGLE_CLIENT_ID=
   GOOGLE_CLIENT_SECRET=
   SLACK_CLIENT_ID=
   SLACK_CLIENT_SECRET=
   SLACK_REDIRECT_URI=http://localhost:5000/api/slack/callback
   ```

3. **Initialize the Database**:
   ```bash
   cd backend
   npx prisma db push
   npm run prisma:seed
   ```

4. **Start the Development Servers**:
   ```bash
   # Terminal 1: Backend API & Worker
   cd backend
   npm run dev

   # Terminal 2: Frontend Dashboard
   cd frontend
   npm run dev
   ```

   - Frontend Dashboard: `http://localhost:5173`
   - Backend API: `http://localhost:5000/api`
   - Live Queue Dashboard: `http://localhost:5000/admin/queues`

---

## Docker Setup

To run the entire stack (MySQL, Redis, Elasticsearch, Backend, Frontend) with Docker Compose:

```bash
docker-compose up --build
```

---

## Verification & Testing

An automated end-to-end test script is included to verify all assignment criteria:

```bash
node test_e2e.js
```

The script runs 7 checks:
1. Health check (`/health` verifying DB and Redis connectivity)
2. Senders query (`/api/emails/senders`)
3. Campaign scheduling with throttling delay
4. Hourly rate limit enforcement and next-window rescheduling
5. Search endpoint verification
6. Job cancellation (`DELETE /api/emails/:id`)
7. Queue metrics and delivery stats

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check (DB and Redis status) |
| `POST` | `/api/auth/google` | Google OAuth token verification |
| `POST` | `/api/auth/dev-login` | Demo user login |
| `GET` | `/api/auth/me` | Current user profile |
| `POST` | `/api/emails/schedule` | Schedule email campaign |
| `GET` | `/api/emails/scheduled` | List scheduled emails |
| `GET` | `/api/emails/sent` | List sent and failed emails |
| `GET` | `/api/emails/stats` | Dashboard metrics and queue counters |
| `GET` | `/api/emails/senders` | List available sender identities |
| `DELETE` | `/api/emails/:id` | Cancel scheduled email |
| `GET` | `/api/slack/authorize` | Slack OAuth URL |
| `GET` | `/api/slack/callback` | Slack OAuth redirect handler |
| `POST` | `/api/slack/webhook` | Connect Slack webhook directly |
| `POST` | `/api/slack/test` | Send test notification to Slack |
| `POST` | `/api/slack/disconnect` | Disconnect Slack integration |
| `GET` | `/admin/queues` | Bull-Board queue administration UI |

---

## Design Decisions

1. **Hourly Window Counter vs Token Bucket**: Using Redis atomic keys formatted by hour (`YYYY-MM-DD-HH`) guarantees thread-safe, distributed rate limiting across all concurrent worker processes without race conditions.
2. **Rescheduling with Jitter**: When multiple jobs hit the rate limit and are rescheduled to the next hour, a random jitter offset is applied to prevent all delayed jobs from waking up simultaneously.
3. **Graceful Search Fallback**: If Elasticsearch is not running, search requests fall back to SQL `LIKE` queries against MySQL so the dashboard remains completely usable in lightweight local setups.
4. **Idempotent Queue Synchronization**: Queue synchronization uses deterministic IDs based on the database primary key, preventing duplicate jobs if the worker restarts multiple times.
# reachinbox
