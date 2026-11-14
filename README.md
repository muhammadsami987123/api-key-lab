# API Key Lab

**Know your API key works, before you ship.**

A production-grade, browser-based checker for AI provider API keys. Paste a key, get a full health report — authentication, model access, a real completion, latency, tokens, quota and exact error codes in plain English. Then test the same key in a dedicated chatbot.

Built and maintained by **Muhammad Sami**.

**Repository:** <https://github.com/muhammadsami987123/api-key-lab> · MIT licensed

---

## What it does

| Step | Check | What it proves |
|---|---|---|
| 1 | **Authenticate** | The key is accepted by the provider (rejects revoked, expired, mistyped and region-blocked keys) |
| 2 | **List models** | Which models this key can actually use — then auto-picks the cheapest capable one |
| 3 | **Live completion** | A real (tiny) generation request — catches no-credit, quota, rate limit, model-access and billing problems |

A key that "lists models" can still be out of credit. That is why step 3 exists.

### Highlights

- **Auto-detect** — recognises Anthropic, OpenAI, Gemini, Groq, OpenRouter, xAI, Perplexity and AWS keys from their prefix. Ambiguous keys are flagged instead of guessed.
- **Glass provider picker** — searchable, grouped popover with keyboard support (`↑ ↓ Enter Esc`), replacing the native dropdown.
- **Animated FAQ** — one panel open at a time, height-animated both ways, `prefers-reduced-motion` aware.
- **Smart model choice** — after auth, the model list is fetched and the cheapest capable model is suggested. Override any time, or type a custom model id.
- **Honest errors** — 401 / 402 / 403 / 404 / 429 / 5xx / timeout / CORS are mapped to a reason, a fix and the provider's own message. No "something went wrong".
- **Dedicated chatbot page** — separate URL, streaming responses, model switcher, temperature, max tokens, system prompt, copy/retry, stop generation.
- **Session-only keys** — held in `sessionStorage`, wiped on tab close **and on every full page reload**. No accounts, cookies, analytics or databases.
- **16 providers** incl. enterprise flows (Azure, Bedrock SigV4, Vertex service accounts).

---

## Folder structure

```
api-key-lab/
├─ frontend/                    # everything the browser loads
│  ├─ index.html                # Tester: key → health report, FAQ
│  ├─ chat.html                 # Dedicated chatbot page
│  ├─ terms.html                # Terms of use
│  ├─ privacy.html              # Privacy policy
│  ├─ security.html             # Security model
│  └─ assets/
│     ├─ css/glass.css          # Design tokens, glass system, motion
│     └─ js/
│        ├─ common.js           # Icons, toasts, session store, nav
│        ├─ providers.js        # Provider registry + key-prefix detection
│        ├─ picker.js           # Glass provider picker (combobox/listbox)
│        ├─ accordion.js        # Animated single-open FAQ
│        ├─ app.js              # Tester logic + report rendering
│        └─ chat.js             # Chat logic + SSE streaming
├─ backend/                     # all server-side code
│  ├─ handlers/
│  │  ├─ verify.js              # POST — actions: verify | models
│  │  └─ chat.js                # POST — non-stream + SSE stream
│  └─ lib/
│     ├─ providers.js           # Provider adapters, error taxonomy, SigV4, Vertex JWT
│     └─ guard.js               # Origin check, body cap, rate limit, JSON helpers
├─ api/                         # Vercel entry points (auto-routed)
│  ├─ verify.js                 # re-exports backend/handlers/verify.js
│  └─ chat.js                   # re-exports backend/handlers/chat.js
├─ archive/
│  └─ index.legacy.html         # Original 2024 single-file version, kept as a backup
├─ server.js                    # Zero-dependency local server (no Vercel needed)
├─ vercel.json                  # Security headers, function limits, caching
├─ package.json
├─ LICENSE
└─ README.md
```

**Why `api/` still exists:** Vercel only auto-routes serverless functions that live in a root `api/` directory. Those two files are two-line re-exports — the real code is in `backend/`, so the exact same handlers run locally and in production.

---

## Run it locally (no Vercel, no build step, no dependencies)

```bash
npm start
```

Then open **<http://localhost:3000>**.

That is the whole setup. `server.js` uses only Node's built-in `http` module:

- serves every page and asset from `frontend/`
- mounts `POST /api/verify` and `POST /api/chat` from `backend/handlers/`
- supports the same clean URLs as production (`/chat` as well as `/chat.html`)

| Page | URL |
|---|---|
| Tester | <http://localhost:3000/> |
| Chatbot | <http://localhost:3000/chat> |
| Terms | <http://localhost:3000/terms> |
| Privacy | <http://localhost:3000/privacy> |
| Security | <http://localhost:3000/security> |

Change the port if 3000 is taken:

```bash
# PowerShell
$env:PORT=8080; npm start

# macOS / Linux
PORT=8080 npm start
```

`npm run dev` is an alias for `npm start`.

### No Node at all?

You can double-click `frontend/index.html` and the UI works — including key detection and the **Ollama (local)** and **Custom** providers, which talk to the provider directly from the browser. Only the proxied providers need `/api/*`, so they require `npm start`.

### Optional — Vercel CLI

If you want the production runtime locally:

```bash
npx vercel dev
```

> Don't add a `"dev": "vercel dev"` script to `package.json`. The CLI reads that script and re-invokes itself, failing with *"must not recursively invoke itself"*.

### Old version

`archive/index.legacy.html` is the original 2024 single-file build (browser-direct calls, CORS-limited). Open it directly in a browser — it needs no server.

---

## Deploy to Vercel

```bash
npm i -g vercel
vercel login
vercel            # preview
vercel --prod     # production
```

Or from the dashboard: import the GitHub repo, framework preset **Other**, no build command. `vercel.json` already sets `"outputDirectory": "frontend"`, so the static site is served from that folder while `/api/*` keeps working.

`vercel.json` also sets:

- strict CSP (`script-src 'self'`, no inline scripts), `nosniff`, `DENY` framing, HSTS, permissions policy
- `maxDuration: 60` for API routes (streaming chat needs it)
- `Cache-Control: no-store` on `/api/*`

**No environment variables are required.** There is no server-side key, database or secret.

---

## API reference

Both endpoints are stateless, same-origin only, rate limited per IP, and return `Cache-Control: no-store`.

### `POST /api/verify`

```json
{
  "action": "verify",
  "config": {
    "provider": "openai",
    "apiKey": "sk-...",
    "model": "",
    "baseUrl": "",
    "secret": "",
    "region": "us-east-1",
    "deployment": "",
    "apiVersion": "",
    "location": "us-central1",
    "serviceAccount": ""
  }
}
```

`action` may be `verify` (default) or `models` (returns the model list + suggested model only).

Verify response (abridged):

```json
{
  "ok": true,
  "status": "valid",
  "title": "Key is valid and generating",
  "provider": "openai",
  "providerName": "OpenAI",
  "model": "gpt-4o-mini",
  "httpStatus": 200,
  "latencyMs": 812,
  "usage": { "prompt": 9, "completion": 2, "total": 11 },
  "quota": { "remainingRequests": "499", "remainingTokens": "149990", "reset": "6s" },
  "stages": [
    { "id": "auth", "label": "Authenticating key", "status": "ok", "ms": 320, "detail": "Credentials accepted by OpenAI" },
    { "id": "models", "label": "Listing models", "status": "ok", "ms": 0, "detail": "58 model(s) available to this key" },
    { "id": "completion", "label": "Sending test completion", "status": "ok", "ms": 812, "detail": "Model generated 2 characters" }
  ],
  "models": ["gpt-4o-mini", "..."],
  "suggestedModel": "gpt-4o-mini",
  "preview": "OK",
  "error": null
}
```

`status` is one of `valid`, `warning` (works but throttled / first model unavailable), `invalid`, `error`.

### `POST /api/chat`

```json
{
  "config": { "provider": "anthropic", "apiKey": "sk-ant-...", "model": "" },
  "messages": [{ "role": "user", "content": "Hello" }],
  "stream": true,
  "maxTokens": 512,
  "temperature": 0.7
}
```

Streaming responses use a normalised SSE stream:

```
data: {"delta":"Hel"}
data: {"delta":"lo"}
data: {"done":true,"model":"claude-3-5-haiku-latest"}
```

Errors arrive as `data: {"error":{"title":"...","message":"...","fix":"..."}}`. With `stream: false` you get a JSON body instead.

Limits: 40 messages per request, 8 000 chars per message, 16–2 048 output tokens, 20 s provider timeout, 256 KB body cap.

---

## Supported providers

| Group | Provider | Auth used |
|---|---|---|
| Popular | OpenAI | `Authorization: Bearer` |
| Popular | Anthropic | `x-api-key` + `anthropic-version` |
| Popular | Google Gemini | `?key=` query |
| Popular | Groq | Bearer (OpenAI-compatible) |
| Popular | Mistral AI | Bearer (OpenAI-compatible) |
| Extras | OpenRouter | Bearer |
| Extras | xAI (Grok) | Bearer |
| Extras | DeepSeek | Bearer |
| Extras | Together AI | Bearer |
| Extras | Perplexity | Bearer (no model list) |
| Local | Ollama | none — **browser → localhost directly** |
| Local | Custom OpenAI-compatible | Bearer + your Base URL |
| Enterprise | Azure OpenAI | `api-key` + resource/deployment/api-version |
| Enterprise | AWS Bedrock | SigV4 (access key + secret + region) |
| Enterprise | Google Vertex AI | Service-account JSON → JWT → OAuth |

### Fields per provider

| Provider | Fields you need |
|---|---|
| OpenAI, Groq, Mistral, OpenRouter, xAI, DeepSeek, Together, Perplexity | API key only |
| Anthropic | API key only |
| Gemini | API key only |
| Ollama | Base URL (default `http://localhost:11434`) — no key |
| Custom | API key + HTTPS Base URL |
| Azure OpenAI | API key + resource URL + deployment name + API version |
| AWS Bedrock | Access key ID + secret access key + region + model id |
| Vertex AI | Service-account JSON + location (project taken from the JSON) |

### Local Ollama notes

Local calls bypass the proxy entirely — the browser talks to your machine.

```bash
OLLAMA_ORIGINS=* ollama serve              # macOS / Linux
$env:OLLAMA_ORIGINS="*"; ollama serve      # Windows PowerShell
```

If the browser still blocks it, allow your site origin explicitly instead of `*`.

---

## Error handling

| Situation | What the report shows |
|---|---|
| `401` | Invalid or revoked key — regenerate it |
| `400` + "API key not valid" | Invalid key for that API |
| `402` / `insufficient_quota` | Key valid, account has no credit |
| `403` (region) | Model or account blocked in your country |
| `403` (model/scope) | Key lacks access to that model |
| `404` (model) | Model id renamed or unavailable — auto-retries another model |
| `429` | Rate limit / quota exhausted, with reset hint |
| `5xx` | Provider incident — retry later |
| Timeout (20 s) | Provider unreachable from the proxy |
| Local network error | Ollama not running or `OLLAMA_ORIGINS` missing |

---

## Security model

- Keys live in `sessionStorage` for the current tab only. Closing the tab or reloading the page deletes them.
- `api/verify` and `api/chat` forward the key once, then discard it. No database, no logs, no cache.
- Same-origin check, 256 KB body cap, 20 s timeouts, per-IP rate limits (40 checks/min, 60 chats/min).
- Custom base URLs must be HTTPS and cannot resolve to private/loopback hosts (SSRF guard).
- Strict CSP, no inline scripts, no third-party scripts, no analytics.
- Full details: **`frontend/security.html`** and **`frontend/privacy.html`**.

> Use scoped or low-limit keys while testing. Never paste a key you are not allowed to transmit to a third-party web app.

---

## Design system

Light-only "iOS Settings glass":

- frosted surfaces (`blur(28px) saturate(180%)`), specular top line, matte inner glow
- soft mesh background with slow drifting blobs, subtle grain overlay
- iOS palette — blue `#0A84FF`, green `#0F7B3F`, amber `#9A5B00`, red `#C21F30`
- Inter / Inter Tight, 28 px card radius, 18 px controls, 44 px touch targets
- motion 180–300 ms `cubic-bezier(.22,1,.36,1)`, spring press feedback, staggered reveals
- respects `prefers-reduced-motion`, `prefers-contrast`, keyboard focus and ARIA live regions
- responsive from 360 px to desktop; picker becomes a bottom sheet under 560 px

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `npm start` → `Port 3000 is already in use` | Run `PORT=8080 npm start` (PowerShell: `$env:PORT=8080; npm start`) |
| Verify returns "Missing configuration" | The page was opened via `file://` — start the local server with `npm start` |
| "Cross-origin requests are not allowed" | Use the site's own URL, not a proxy/iframe wrapper |
| Chat streams nothing | Check the Network tab: response must be `text/event-stream` |
| Custom provider fails with HTTPS error | Base URLs must be `https://`; use Ollama for local HTTP |
| Bedrock "signature" error | Check region and clock skew; the secret must belong to the access key |
| Vertex "service account" error | Enable the Vertex AI API and give the account `Vertex AI User` |
| `vercel dev` says "must not recursively invoke itself" | Remove any `"dev": "vercel dev"` script from `package.json` |
| FAQ panels feel snappy instead of animated | `prefers-reduced-motion` is enabled in the OS — that is intentional |

---

## Not included (by design)

Accounts, saved history across sessions, analytics, billing, blog/docs CMS, i18n. The tool stays small on purpose.

---

## Credits

**Made by Muhammad Sami** — design, frontend and the serverless proxy.

- Portfolio: <https://muhammad-sami.vercel.app>
- GitHub: <https://github.com/muhammadsami987123>
- Repository: <https://github.com/muhammadsami987123/api-key-lab>
- Email: <m.samiwaseem1234@gmail.com>

Licensed under the MIT License — see `LICENSE`.
