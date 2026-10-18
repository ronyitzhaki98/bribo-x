# Bribo on X (@PMBribo)

An autonomous bot that posts 2–10 in-character tweets a day as **His Excellency Bribo** and replies to up to 15 mentions a day. It runs on GitHub Actions; there is no server. Design: [`docs/superpowers/specs/2026-10-15-bribo-x-design.md`](../docs/superpowers/specs/2026-10-15-bribo-x-design.md).

## How it works

- **`bribo-x-post`** runs at :17 past every second hour from 10:00 to 04:00 UTC (10 slots). Each day a seeded random plan picks 2–10 of those slots. In a chosen slot it reads today's headlines (Google News, Google Trends, Hacker News, with politics and tragedy filtered out), has Claude write 3 candidate posts in Bribo's voice, drops any that fail the code checks or a second Claude safety check, and posts the best one. If nothing passes, it posts from the evergreen bank (`content/bank.json`).
- **`bribo-x-reply`** runs at :47 past every second hour. It reads new mentions, skips spam, minors, political bait and repeat back-and-forths, and replies to the most-liked ones: at most 3 per run, 15 per day, 2 per person per day.
- **`bribo-x-bank`** (manual only) bulk-writes evergreen post candidates for curation.
- Everything posted is recorded in `state/` and committed back by the bot.

## Secrets and variables

In the repo: **Settings → Secrets and variables → Actions**.

| Secret | What |
|---|---|
| `X_CONSUMER_KEY`, `X_SECRET_KEY` | X app consumer key and secret |
| `X_ACCESS_TOKEN`, `X_ACCESS_TOKEN_SECRET` | X access token and secret for @PMBribo, created with **Read and write** |
| `ANTHROPIC_API_KEY` | Claude API key (used until 2026-11-01) |
| `CLAUDE_CODE_OAUTH_TOKEN` | Claude subscription token (used from 2026-11-01) |

| Variable | Values | Effect |
|---|---|---|
| `BRIBO_X_PAUSED` | `false` / anything else | Only an explicit `false` lets the bot post. Unset or `true` stops scheduled runs and makes manual runs dry runs |
| `BRIBO_X_DRY_RUN` | `true` / unset | `true` runs everything except posting |
| `BRIBO_X_LLM` | `api` / `subscription` / unset | Unset: API until 2026-11-01 00:00 UTC, subscription after |

### Creating `CLAUDE_CODE_OAUTH_TOKEN` (before 2026-11-01)

1. In a terminal on your computer, run `claude setup-token` and sign in with your Claude account when the browser opens.
2. Copy the token it prints.
3. Add it as a repo secret named `CLAUDE_CODE_OAUTH_TOKEN`.

Subscription runs count against your plan's usage limits. If a limit is hit, posts fall back to the bank and replies skip that run.

## Everyday operations

- **Pause:** set `BRIBO_X_PAUSED` to `true`.
- **Preview what it would post:** Actions → `bribo-x-post` (or `bribo-x-reply`) → **Run workflow**. While paused, this is always a dry run. The would-be posts are in the run's summary.
- **Go live:** set `BRIBO_X_PAUSED` to `false` and leave `BRIBO_X_DRY_RUN` unset.
- **See what it posted:** `state/posted.jsonl` and `state/replied.jsonl`, or each run's summary.
- **A run failed:** GitHub emails you. `X API 402` means the X credits ran out (top up in the X console). `X API 403` usually means the access token is read-only (regenerate it with Read and write). `Missing secret` means a secret is not set.

## Growing the evergreen bank

1. Actions → `bribo-x-bank` → Run workflow (default 1,000 candidates).
2. `gh run download <run-id> -n bank-candidates`
3. Pick the best ones into `content/bank.json` (ids `b121`, `b122`, …) and run `npm test` (the content test checks every item).

## Cost

| Item | Per month |
|---|---|
| X posts (~6 a day) | ~$3 |
| X replies (up to 15 a day) | ~$7 |
| X mention reads | typically under $5, at most ~$45 |
| Claude (API, until Nov 1) | ~$10–15, covered by the promotional credits |
| Claude (subscription, from Nov 1) | $0 extra; counts against plan limits |

The spending limit in the X developer console is the hard cap.

## Development

```bash
npm ci
npm test
npm run typecheck
```

Scheduled workflows only run from the repo's default branch (`main`).
