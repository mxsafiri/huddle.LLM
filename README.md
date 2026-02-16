# Huddle 🤝

A viral WhatsApp micro-alignment agent that creates temporary group coordination sessions and auto-deletes memory after completion. Bilingual support for **English** and **Swahili**.

## Features

- **Session-based coordination** — Start a Huddle, track contributions/commitments, summarize, close
- **Low AI token usage** — Rule-based triggers handle most logic; AI only used for summaries and conflict resolution
- **Bilingual** — Auto-detects Swahili or English and responds accordingly
- **Privacy-first** — Sessions expire after 3 days and data is auto-deleted
- **Viral UX** — Minimal commands, auto-intro, easy group onboarding

## Architecture

```
src/
├── config/          # App config + logger
├── db/              # Database pool, schema, migrations
├── handlers/        # Message orchestrator
├── routes/          # Express webhook routes
├── services/        # AI, WhatsApp, memory modules
└── triggers/        # Keyword + regex trigger engine
tests/
├── triggers.test.js # Trigger engine unit tests
└── webhook.test.js  # Webhook integration tests (mocked)
```

## Quick Start

### Prerequisites

- Node.js >= 18
- PostgreSQL (or Supabase project)
- Meta WhatsApp Cloud API credentials
- OpenAI API key

### 1. Clone and install

```bash
git clone <repo-url> huddle
cd huddle
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your credentials
```

| Variable | Description |
|---|---|
| `WHATSAPP_VERIFY_TOKEN` | Your chosen webhook verification token |
| `WHATSAPP_ACCESS_TOKEN` | Meta WhatsApp Cloud API access token |
| `WHATSAPP_PHONE_NUMBER_ID` | Your WhatsApp phone number ID |
| `DATABASE_URL` | PostgreSQL connection string |
| `OPENAI_API_KEY` | OpenAI API key |
| `OPENAI_MODEL` | Model to use (default: `gpt-4o-mini`) |
| `SESSION_EXPIRY_DAYS` | Days before sessions expire (default: `3`) |

### 3. Run database migration

```bash
npm run db:migrate
```

### 4. Start the server

```bash
# Development
npm run dev

# Production
npm start
```

### 5. Configure WhatsApp webhook

Set your webhook URL in the Meta Developer Console:
- **Callback URL:** `https://your-domain.com/webhook`
- **Verify Token:** Same as `WHATSAPP_VERIFY_TOKEN` in `.env`
- **Subscribe to:** `messages`

## Commands

| Command | Swahili | Action |
|---|---|---|
| `start huddle` | `anza huddle` | Create a new coordination session |
| `5000 TZS` or `5k` | Same | Log a contribution |
| `I will...` | `nitafanya...` / `niko tayari` | Log a commitment |
| `summary` | `muhtasari` | Generate AI summary |
| `close` | `funga` | Close session + final summary |

## Deployment

### Docker

```bash
docker compose up -d
```

### Render / Railway

1. Connect your Git repo
2. Set build command: `npm install`
3. Set start command: `npm start`
4. Add all environment variables from `.env.example`
5. Set the health check path to `/health`

### Health Check

```
GET /health
```

Returns `{ status: "healthy", database: "connected", uptime: ... }`

## Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch
```

## How It Works

1. **Webhook receives** a WhatsApp message
2. **Trigger engine** checks for keywords/regex matches (no AI call)
3. If a trigger fires, the **handler** executes the action using **memory service**
4. AI is called **only** for summaries and conflict resolution, using structured session data (not full chat)
5. **Cron job** cleans up expired sessions every 6 hours

## License

MIT
