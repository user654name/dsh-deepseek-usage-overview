[简体中文](README.md) | **English**

# dsh-deepseek-usage

**DeepSeek Platform usage, inside DeepSeek Harness — no browser tab, no copy-pasting balances.**

An in-app usage page for the [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Web GUI
(`dsh web`). It renders the same information as `platform.deepseek.com/usage` — recharge balance,
total spend, spend / API-request / token totals, and an hourly spend chart — directly inside the
Harness UI, opened from a sidebar shortcut or by double-clicking the bottom-right corner.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Platform: DeepSeek Harness Web](https://img.shields.io/badge/platform-DeepSeek%20Harness%20Web-4D6BFE)
![Node: >=20](https://img.shields.io/badge/node-%3E%3D20-339933)

---

## Table of contents

- [Why](#why)
- [Features](#features)
- [How it works](#how-it-works)
- [Install](#install)
- [Usage](#usage)
- [Security and privacy](#security-and-privacy)
- [Configuration](#configuration)
- [Development](#development)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)
- [Known limitations](#known-limitations)
- [License](#license)

## Why

Checking DeepSeek credit normally means leaving the Harness, opening the Platform dashboard,
logging in again, and navigating to the usage page. This plugin brings that page into the Harness as
a first-class in-app view, using the **account you are already signed in with** inside DSH:

- no second sign-in and no API key configuration;
- no new browser tab;
- the same numbers DeepSeek bills you for, not a locally estimated approximation.

## Features

- **Three ways to open it**
  - a **「用量」 shortcut** in the sidebar footer, next to Settings;
  - a **「用量」 button in the Settings header**, next to Close;
  - **double-click the bottom-right corner** (including the floating whale widget body, if you use it).
- **In-app page, not an iframe and not a new tab** — a React view mounted in the Harness overlay layer,
  styled with Harness theme tokens, so it follows light/dark themes and the active locale.
- **Balance card** — recharge balance, bonus credit when present, the Platform low-balance alert state,
  and a one-click **Top up** link.
- **Total spend card** — lifetime Platform spend in your account currency.
- **Period filters** — Today / Yesterday / Last 7 days / Last 30 days / This month.
- **API key filter** — restrict every number and the chart to one key.
- **Summary cards** — spend, API requests, tokens for the selected period and key.
- **Spend chart** — hourly bars for Today, daily bars for longer ranges; toggle between
  **call type** (model calls vs. tool calls) and **per API key** stacking.
- **CSV export** of the currently visible buckets.
- **Bilingual** — Simplified Chinese and English, following the Harness locale.
- **No build step** — the browser half is a hand-written `window.__ModuleLoader__` bundle.

## How it works

```
┌───────────────────────────────  Browser (Harness Web UI)  ───────────────────────────────┐
│  sidebar shortcut / settings button / bottom-right double-click                         │
│        │                                                                                │
│        ▼                                                                                │
│  in-app usage page (React, shell.overlay)  ──  fetch GET /api/deepseek-usage/overview ──┐│
└────────────────────────────────────────────────────────────────────────────────────────┼┘
                                                                                         │
┌──────────────────────────────  DSH Host (Node)  ────────────────────────────────────────▼┐
│  dsh-deepseek-usage host half                                                            │
│    • loopback-only HTTP route, GET only                                                  │
│    • deepseekAccount.getPlatformSession()  →  stored DeepSeek account grant             │
│    • queries the private endpoints the Platform usage page itself uses:                  │
│        GET /api/v0/users/get_user_summary                                                │
│        GET /auth-api/v0/users/current                                                    │
│        GET /api/v0/usage/by_api_key/amount                                               │
│        GET /api/v0/usage/by_api_key/cost                                                 │
│    • folds amount + cost payloads into hourly/daily buckets and aggregates them          │
│    • caches the aggregated result for 30 s                                               │
└───────────────────────────────────────────────────────────────────────────────────────────┘
                                                                                         │
                                                          platform.deepseek.com  ◄────────┘
```

The browser never receives the account token, deployment cookies, or raw Platform payloads — only
aggregated numbers and API key names. See [Security and privacy](#security-and-privacy).

### Request / response

```
GET /api/deepseek-usage/overview?start=<unix seconds>&end=<unix seconds>&tz=<seconds east>&lang=zh|en[&refresh=1]
```

```jsonc
{
  "ok": true,
  "origin": "https://platform.deepseek.com",
  "updatedAt": 1794190000000,
  "range": { "start": 1794153600, "end": 1794240000, "tz": 28800, "bucket": 3600 },
  "account": {
    "currency": "CNY",
    "balance": "11.79",
    "bonus": "0",
    "totalCosts": [{ "currency": "CNY", "amount": "266.87" }],
    "balanceAlert": { "enabled": true, "alertBound": "5" }
  },
  "usage": {
    "currency": "CNY",
    "bucket": 3600,
    "totals": { "cost": 2.03, "tokens": 22940748, "requests": 109, "...": "..." },
    "keys": [{ "id": "...", "name": "DeepSeek Harness", "cost": 2.03, "tokens": 22940748, "requests": 109 }],
    "buckets": [{ "time": 1794186000, "cost": 0.42, "tokens": 6839836, "requests": 11, "keys": { "...": {} } }]
  }
}
```

The route is registered as an exact `webServer` route and guarded by a **peer-socket loopback fence**
(IPv4 / IPv6 loopback only, `Host` header checked as an additional defense), `GET`-only, with a
30-second in-memory cache (`refresh=1` bypasses it).

## Install

Requirements:

- DeepSeek Harness with the Web GUI (`@deepseek-ai/dsh >= 0.2.2`), Node.js 20+;
- a **signed-in DeepSeek account** in DSH (Settings → Account & balance). The plugin reads the
  Platform account grant; an inference `DEEPSEEK_API_KEY` alone is not enough.

From a checkout:

```bash
dsh plugin --profile <profile> add /absolute/path/to/dsh-deepseek-usage
```

or inside a DSH session, ask the agent to install the bundle from that directory. Then **refresh the
Web UI once** (`Ctrl+F5`) so the browser loads the client bundle.

Typical profiles: `desktop` for the desktop app, `web` for `dsh web`.

> The plugin installs as a DSH **bundle**: `cordis.patch.yml` mounts the Host half and
> `package.json` declares the browser half (`dsh.client`), so there is nothing else to configure.

## Usage

| Entry point | Where |
| --- | --- |
| 「用量」 sidebar shortcut | sidebar footer, beside Settings (icon-only when the sidebar is collapsed) |
| 「用量」 Settings button | Settings panel header, beside Close |
| Bottom-right double-click | anywhere in the bottom-right 200 px corner, including the floating whale widget body; buttons and inputs keep their normal behavior |

The page shows:

| Section | Content |
| --- | --- |
| Balance | recharge balance, bonus credit, low-balance alert state, Top up |
| Total spend | lifetime spend for the account currency |
| Filters | period, API key, clear filters, CSV export |
| Summary | spend, API requests, tokens |
| Chart | spend bars, grouped by call type or API key |

## Security and privacy

- **Credentials never reach the browser.** The Host resolves the account grant through
  `deepseekAccount.getPlatformSession()` and keeps it server-side. The HTTP response contains only
  aggregates and API key display names.
- **Loopback only.** The route rejects non-loopback peer sockets (403), non-`GET` methods (405), and
  requests with a non-loopback `Host` header.
- **Fixed upstream origin.** Requests go only to the origin provided by the account service
  (normally `https://platform.deepseek.com`), always HTTPS, with `redirect: "error"`, a 15-second
  timeout, and a 4 MiB response cap.
- **No disk writes.** The plugin persists no credentials or usage data; the only state is a 30 s
  in-memory cache.
- **CSRF-safe by construction.** The endpoint is read-only, same-origin, and sets no CORS headers, so a
  foreign page cannot read the response.
- The private Platform endpoints are the same ones the official Platform usage page calls. They are
  undocumented and may change without notice.

## Configuration

No configuration is required. The plugin row is mounted with an empty config:

```yaml
- insert:
    - id: deepseek-usage
      name: dsh-deepseek-usage
      config: {}
```

The Host half only requires the Harness `webServer` service and optionally reads `deepseekAccount`.
Without an account service, or when signed out, the page shows a localized "Not signed in" state.

## Development

```text
dsh-deepseek-usage/
├── index.js              # Host half: route, Platform fetches, aggregation, loopback fence
├── client.js             # Browser half: hand-written __ModuleLoader__ bundle (no build step)
├── cordis.patch.yml      # Bundle patch that mounts the Host half
├── package.json          # Manifest (bundle + dsh.client)
├── locale/{zh,en}.json   # Display metadata for the plugin manager
├── icon.svg              # Plugin icon
├── test/                 # Offline tests (host aggregation + client render)
└── README.md (Chinese) / README.en.md (English)
```

```bash
pnpm install     # dev dependencies only (React for the client render test)
pnpm run check   # node --check index.js client.js
pnpm test        # offline tests (node:test)
```

The Host half must run in Node.js (the DSH Host); the browser half runs in the Harness page. The
client bundle is intentionally dependency-free apart from `react` and `react/jsx-runtime`, which the
Harness page provides.

### Style rules

- UI text goes through the Harness locale service (`ctx.locale`).
- Colors and surfaces use Harness theme tokens (`--dsw-alias-*`); chart bars use their own accent
  colors.
- The page is registered in `shell.overlay`, the sidebar shortcut in `sidebar.footer.action`, and the
  Settings shortcut in `settings.action`.
- No Harness Client package is imported as a module.

## Testing

`pnpm test` runs offline tests with `node:test`:

- **Host** — loopback fence, query validation, amount/cost aggregation, currency and balance
  selection, and a guarantee that the account token never appears in the browser payload.
- **Client** — renders the real client bundle with React 18 (`react-dom/server`) in empty, loaded,
  filtered and range-switched states, and asserts that every JSX call passes a props object (the
  regression that once crashed the page in the development jsx-runtime).

CI runs the same commands on every push via GitHub Actions.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Button does not open the page | Hard-refresh the Web UI once (`Ctrl+F5`). The browser keeps client bundles until reload. |
| Page shows "Not signed in to DeepSeek" | Sign in via Settings → Account & balance, then reopen the page. |
| Usage detail is empty but balance works | The Platform usage endpoints returned no data for the selected period, or the account has no API usage yet. |
| "Usage details are temporarily unavailable" banner | One of the private endpoints failed; balance and total spend are still shown. Retry with the refresh button. |
| Numbers differ from the Platform page | The response may lag by up to 5 minutes (Platform note), and the page caches for 30 s. Use the refresh button. |
| Render failure | The page shows an error panel with the message and a **Copy details** button; report it in the issue tracker with that text. |

## Known limitations

- Requires the official DeepSeek **account** login (not API-key-only setups).
- Only the `CNY` / `USD` wallets the Platform exposes are shown; multi-currency accounts pick the
  account currency and fall back to the first currency with spend.
- The private Platform usage endpoints are undocumented; a change on the Platform side can break the
  page until the plugin is updated. The page degrades to balance + total spend instead of failing
  completely.
- The bottom-right double-click zone is intentionally generous (200 px) so it covers the floating
  whale widget body; interactive controls inside that corner are ignored unless you double-click the
  exact 44 px corner.
- The client bundle requires a page refresh after an update (DSH does not hot-reload installed client
  plugins in the Electron app).

## License

[MIT](LICENSE)

---

Made for the DeepSeek Harness community. Issues and pull requests are welcome.
