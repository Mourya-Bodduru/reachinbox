# ReachInbox • Full-Stack Email Job Scheduler

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Express.js](https://img.shields.io/badge/Express.js-000000?style=flat&logo=express&logoColor=white)](https://expressjs.com/)
[![BullMQ](https://img.shields.io/badge/BullMQ-E10098?style=flat&logo=redis&logoColor=white)](https://docs.bullmq.io/)
[![MySQL](https://img.shields.io/badge/MySQL-4479A1?style=flat&logo=mysql&logoColor=white)](https://www.mysql.com/)
[![React](https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB)](https://react.dev/)
[![Bootstrap](https://img.shields.io/badge/Bootstrap-7952B3?style=flat&logo=bootstrap&logoColor=white)](https://getbootstrap.com/)

A production-grade distributed email scheduler service and modern SaaS dashboard built for **ReachInbox (Outbox Labs)**. Features persistent delayed queues, worker concurrency, atomic hourly rate limiting per sender, fake SMTP via Ethereal, Elasticsearch full-text search, Slack OAuth rate-limit alerts, real Google OAuth 2.0 login, and zero cron dependencies.

---

## 🏗 System Architecture

```
                             ┌─────────────────────────────────┐
                             │       React 18 + TS UI          │
                             │ (Bootstrap 5, Vite, Dark Theme) │
                             └──────────────┬──────────────────┘
                                            │ HTTP / REST
                                            ▼
                             ┌─────────────────────────────────┐
                             │     Express.js API Gateway      │
                             │ (JWT Auth, Slack, Search, Queues)│
                             └───────┬──────────────┬──────────┘
                                     │              │
                   ┌─────────────────┴────┐   ┌─────┴────────────────┐
                   ▼                      ▼   ▼                      ▼
           ┌──────────────┐     ┌──────────────┐             ┌──────────────┐
           │ MySQL / DB   │     │ Redis 5/7    │             │ Elasticsearch│
           │ (Prisma ORM) │     │ (BullMQ ZSET)│             │ (Full-text)  │
           └──────────────┘     └──────┬───────┘             └──────────────┘
                                       │ Delayed Jobs
                                       ▼
                             ┌─────────────────────────────────┐
                             │      BullMQ Worker Pool         │
                             │ • Configurable Concurrency (5)  │
                             │ • Min Delay Throttling (2s)     │
                             │ • Redis Atomic Hourly Rate Limit│
                             └─────────┬──────────────┬────────┘
                                       │              │
                    Rate Limit Exceeded│              │ Normal Send
                                       ▼              ▼
                             ┌──────────────┐   ┌──────────────┐
                             │ Slack Alert  │   │ Ethereal     │
                             │ (Webhook/API)│   │ Fake SMTP    │
                             └──────────────┘   └──────────────┘
```

---

## 🚀 Key Features

### Backend Architecture
- **No Cron Jobs**: Scheduling is executed exclusively via BullMQ delayed jobs backed by Redis sorted sets (`ZSET`).
- **Server Restart Persistence & Idempotency**:
  - All jobs are persisted in Redis.
  - On backend startup, `syncQueueOnStartup()` scans MySQL for any `SCHEDULED` or `RATE_LIMITED_RESCHEDULED` jobs and ensures they exist in BullMQ without duplicates.
  - Deterministic job IDs (`email_${id}`) prevent duplicate dispatching.
- **Worker Concurrency & Throttling**:
  - Configurable worker pool (`WORKER_CONCURRENCY=5`).
  - Enforces minimum delay between email sends (default: **2 seconds**) to mimic provider throttling.
- **Hourly Window Rate Limiting**:
  - Atomic Redis counters: `rate_limit:${senderEmail}:${hourWindowKey}` (`YYYY-MM-DD-HH`).
  - When the limit is reached, jobs are **never dropped or failed**; they are automatically rescheduled into the next hour window (`(60 - minutes) * 60s + stagger`) while preserving FIFO ordering.
- **Live Slack Alerts on Rate Limit**:
  - Real OAuth 2.0 flow (`/api/slack/authorize` & `/api/slack/callback`) and direct webhook support.
  - Sends a Slack notification containing sender email, hourly limit reached, and next execution window time the moment a rate limit is exceeded.
- **Elasticsearch Search**:
  - Dedicated `@elastic/elasticsearch` indexing for recipient, sender, subject, and content.
  - Automatic, seamless fallback to SQL database queries when Elasticsearch is offline.
- **Live BullMQ Queue Dashboard**:
  - Mounted at `/admin/queues` powered by `@bull-board/express`.
- **Ethereal Fake SMTP**:
  - Generates verifiable preview links (`nodemailer.getTestMessageUrl`) accessible directly from the dashboard.

### Frontend Dashboard
- **Modern ReachInbox SaaS Aesthetic**: Clean dark mode with indigo/purple accents, responsive layout, and KPI stats.
- **Google OAuth Login**: Real Google OAuth 2.0 integration + one-click demo login for rapid evaluation.
- **Compose Campaign Modal**:
  - Subject and body editor.
  - Multi-sender identity selection.
  - **CSV / TXT Lead Uploader**: Drag-and-drop parser detecting and deduplicating email addresses in real time.
  - Start time picker with quick presets (*"Send Now"*, *"+15 Mins"*, *"Tomorrow 9 AM"*).
  - Configurable delay between sends and hourly limits.
- **Scheduled Emails Table**: Status tags (`SCHEDULED`, `RATE_LIMITED_RESCHEDULED`), cancellation action, Elasticsearch search bar, pagination.
- **Sent Emails Table**: Status tags (`SENT`, `FAILED`), *"View in Ethereal"* preview link, search, pagination.
- **Real-Time Queue Monitor**: Live stats for delayed, waiting, active, completed, and failed jobs.

---

## 🛠 Prerequisites & Installation

### Option A: Local Run (Recommended)
1. **Node.js** (v18+)
2. **MySQL** running on `localhost:3306` (e.g. XAMPP, Laragon, or standalone)
3. **Redis** running on `localhost:6379`

#### 1. Clone & Install
```bash
git clone <repo-url>
cd reachinbox

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

#### 2. Configure Environment Variables
Copy `.env.example` in `backend/`:
```bash
cp backend/.env.example backend/.env
```
Default configuration:
```env
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# MySQL Database
DATABASE_URL="mysql://root:@localhost:3306/reachinbox_db"

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Elasticsearch
ELASTICSEARCH_NODE=http://localhost:9200
ELASTICSEARCH_INDEX=reachinbox_emails

# Scheduler Settings
WORKER_CONCURRENCY=5
MIN_DELAY_BETWEEN_EMAILS_MS=2000
MAX_EMAILS_PER_HOUR_PER_SENDER=50

# JWT & OAuth
JWT_SECRET=reachinbox_super_secret_jwt_key_2026
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
SLACK_CLIENT_ID=your_slack_client_id
SLACK_CLIENT_SECRET=your_slack_client_secret
SLACK_REDIRECT_URI=http://localhost:5000/api/slack/callback

# Ethereal SMTP (Leave blank to auto-generate a test account)
ETHEREAL_USER=
ETHEREAL_PASS=
```

#### 3. Initialize Database
```bash
cd backend
npx prisma db push
npm run prisma:seed
```

#### 4. Run Services
```bash
# Start backend (Terminal 1)
cd backend
npm run dev

# Start frontend (Terminal 2)
cd frontend
npm run dev
```
- Frontend: `http://localhost:5173` (or `http://localhost:5174`)
- Backend API: `http://localhost:5000/api`
- BullMQ Live Dashboard: `http://localhost:5000/admin/queues`

---

### Option B: Docker Compose
```bash
docker-compose up --build
```
Spins up:
- MySQL (`3306`)
- Redis (`6379`)
- Elasticsearch (`9200`)
- Backend API & BullMQ Worker (`5000`)
- Frontend Nginx Dashboard (`5173`)

---

## 🧪 Automated End-to-End Verification

An automated test suite is provided to verify all core requirements in under 15 seconds:
```bash
node test_e2e.js
```
Validates:
1. System health check (`/health`)
2. Multi-sender configuration
3. Campaign scheduling with throttling
4. Hourly rate limit threshold & next-window rescheduling
5. Elasticsearch full-text search
6. Deterministic job cancellation
7. Queue metrics and delivery verification

---

## 🔬 In-Depth Engineering Details

### 1. How Scheduling Works Without Cron
- Scheduling uses BullMQ's native delayed job functionality.
- When an email is scheduled for a future timestamp `T`:
  $$\text{delay} = \max(0, T - \text{Date.now()})$$
- Jobs are inserted into Redis as delayed jobs. Redis manages the timer internally using sorted sets scored by execution timestamp.
- No OS crontab or `node-cron` timers are used.

### 2. How Persistence Across Server Restarts is Handled
- **Redis Durability**: BullMQ keeps job definitions, payloads, and delays in Redis. If the Node.js server crashes, Redis preserves all delayed jobs.
- **Relational Backup & Recovery**: MySQL stores the single source of truth for all jobs (`SCHEDULED`, `SENT`, `RATE_LIMITED_RESCHEDULED`).
- **On Server Boot**: `syncQueueOnStartup()` executes on startup. It queries MySQL for all jobs with status `SCHEDULED` or `RATE_LIMITED_RESCHEDULED`. For each job, it verifies whether the job exists in Redis. If missing (e.g. after Redis restart), it re-enqueues the job with remaining delay:
  $$\text{remainingDelay} = \max(0, \text{job.scheduledAt} - \text{Date.now()})$$
- Deterministic job IDs (`email_${id}`) guarantee idempotency.

### 3. Concurrency, Provider Throttling & Rate Limiting
- **Worker Concurrency**: BullMQ worker runs with configurable concurrency (`WORKER_CONCURRENCY=5`).
- **Delay Between Sends**: Before dispatching each email, workers apply an asynchronous sleep delay (default: **2000 ms**) to avoid triggering SMTP provider burst limits.
- **Hourly Window Rate Limiting**:
  - Key: `rate_limit:${senderEmail}:${hourWindowKey}` where `hourWindowKey = YYYY-MM-DD-HH`.
  - Atomic Redis operation: `INCR rate_limit:...` with a 2-hour TTL.
  - If counter exceeds limit:
    1. Calculate milliseconds until the next hour starts:
       $$\text{delayUntilNextHour} = (60 - \text{minute}) \times 60 \times 1000 - \text{second} \times 1000 + \text{jitter}$$
    2. Reschedule job with new delay.
    3. Update MySQL status to `RATE_LIMITED_RESCHEDULED`.
    4. Post a real Slack notification via OAuth token or incoming webhook.

---

## 📬 API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Service health (DB, Redis, BullMQ status) |
| `POST` | `/api/auth/google` | Exchange Google OAuth ID token for session JWT |
| `POST` | `/api/auth/dev-login` | Quick one-click developer demo login |
| `GET` | `/api/auth/me` | Fetch authenticated user profile & Slack status |
| `POST` | `/api/emails/schedule` | Schedule email campaign (accepts array of leads) |
| `GET` | `/api/emails/scheduled` | Query scheduled emails (with search & pagination) |
| `GET` | `/api/emails/sent` | Query sent emails (with Ethereal preview links) |
| `GET` | `/api/emails/stats` | Dashboard statistics & queue depths |
| `GET` | `/api/emails/senders` | Retrieve configured sender identities |
| `DELETE` | `/api/emails/:id` | Cancel scheduled email from queue |
| `GET` | `/api/slack/authorize` | Generate Slack OAuth install URL |
| `GET` | `/api/slack/callback` | OAuth redirect callback handler |
| `POST` | `/api/slack/webhook` | Connect incoming webhook directly |
| `POST` | `/api/slack/test` | Dispatch verified test notification to Slack |
| `POST` | `/api/slack/disconnect` | Disconnect Slack integration |
| `GET` | `/admin/queues` | Live BullMQ Bull-Board dashboard |

---

## ⚖️ Trade-offs and Design Decisions
1. **Atomic Redis Counter vs Token Bucket**: Redis counters keyed by hour window (`YYYY-MM-DD-HH`) provide strictly atomic rate limiting across distributed workers without race conditions.
2. **Rescheduling with Jitter**: When 50+ rate-limited jobs are rescheduled to the next hour, a random jitter (0-45s) is added so the worker is not slammed at the exact start of the hour.
3. **Elasticsearch with Seamless Fallback**: `@elastic/elasticsearch` indexes all emails upon creation and updates them upon delivery. If Elasticsearch is unavailable, search automatically falls back to MySQL full-text queries so the application never breaks.
4. **Dev Login Mode**: In addition to real Google OAuth, a demo login is provided to enable instant evaluation without having to register a Google Cloud OAuth app.

---

## 👥 Submission
- **Monorepo Structure**: `backend/` and `frontend/`
- **Access Granted To**: `Mitrajit` and `Yadav036`
