# ResumeGuard AI

Educational **Red / Blue** lab: poison a resume with invisible prompt injections, hijack a naive Gemini HR screener so **Nodemailer** sends mail, then defend with sanitize → XML delimiters → hardened prompt → **app-level SMTP gate**.

> Bypass resume automation by poisoning LLM-visible text. Defend by never trusting resume text and never letting the model own SMTP.

## Stack

| Layer | Choice |
|--------|--------|
| Frontend | React + Vite + TypeScript + Tailwind |
| Backend | **Node.js + Express (TypeScript)** |
| LLM | Google Gemini + function calling |
| Mail | **Nodemailer** (in-process; Red sends, Blue gates first) |
| PDF | `pdf-lib` + `pdf-parse` |

## Quick start

```bash
cd C:\Users\RAHUL\indo\=bh
# ensure .env has GEMINI_API_KEY, SMTP_*, ADMIN_ALERT_EMAIL, EMAIL_DOMAIN_WHITELIST
npm install
npm run dev
```

- UI: http://localhost:5174  
- API: http://localhost:3010  

Set `MAIL_DRY_RUN=true` to log mail instead of sending. Without Gemini, agents use a deterministic fallback so Red/Blue mail paths still demo.

### Demo (N=5)

1. **Attack (Red)** → upload resume or paste form → injection count **5** → Generate → Submit to naive HR → Nodemailer send.
2. **Defend (Blue)** → same run → sanitize/delimit/gate → unauthorized mail blocked + admin alert.

## API

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/red/inject` | resume + `{ count ∈ 3/5/10/100 }` → poisoned PDF + `run_id` |
| `POST` | `/api/red/attack` | `{ run_id }` → naive Gemini + Nodemailer |
| `POST` | `/api/blue/defend` | `{ run_id }` → sanitize + secure Gemini + interceptor |
| `GET` | `/api/catalog/patterns` | ~100 seed payloads |
| `GET` | `/api/runs/:id` | timeline |

## Tests & harness

```bash
npm test
npm run harness:red
npm run harness:blue
npm run harness:all
npx tsx fixtures/generate-sample.ts
```

## Lesson

- **Red:** scattered invisible text reaches the LLM; tool calls hit Nodemailer directly.
- **Blue:** scrub + `<untrusted_resume_data>` + hardened prompt + Node interceptor (whitelist only). The model never owns SMTP.
