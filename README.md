# Runway Relay

Connects your TikTok LIVE to the Roblox Runway game.

TikTok comments ──► relay (this) ──► Roblox polls /events every second ──► avatars walk

## Run locally

```bash
npm install
cp .env.example .env     # then fill in TIKTOK_USERNAME + SHARED_SECRET
npm start
```

Leave `TIKTOK_USERNAME` blank to run in test mode (no TikTok connection, test endpoints only).

## Deploy (Railway, the easy option)

1. Push this folder to a GitHub repo.
2. railway.app → New Project → Deploy from GitHub → pick the repo.
3. Variables: `TIKTOK_USERNAME`, `SHARED_SECRET` (same value as Roblox BridgeConfig), optionally `EULER_API_KEY`.
4. Settings → Networking → Generate Domain. Put that https URL into Roblox `BridgeConfig.Url`.

Render.com works the same way (Web Service, build `npm install`, start `npm start`).

## Endpoints

All except /health need header `x-runway-secret: <SHARED_SECRET>`.

| Method | Path | What |
|---|---|---|
| GET | /health | Uptime check |
| GET | /events?since=N | Events after id N (Roblox polls this) |
| GET | /status | TikTok connection state, linked viewers |
| POST | /test/comment | `{"tiktok":"viewer1","comment":"Eric_Z"}` fake a comment |
| POST | /test/gift | `{"tiktok":"viewer1","giftName":"Rose","diamonds":1,"count":5}` fake a gift |

## How viewers interact

- Comment just their Roblox username → they join the queue. Common chat words ("lol", "hi") are ignored.
- Their TikTok account is linked to that Roblox name, so their gifts boost *their* avatar.
- Gifts from viewers who haven't linked boost whoever is on the runway.
- Gift tiers use total diamonds (value × streak): `< 10` small, `10–99` medium, `100+` giant. Change with `TIER_MEDIUM_DIAMONDS` / `TIER_GIANT_DIAMONDS`.
- Busy chat? Set `COMMENT_MODE=prefix` so only `!walk username` counts.

## Notes

- tiktok-live-connector is unofficial/reverse-engineered. If connecting starts failing, update it (`npm update`) or add an Euler Stream API key.
- Events are kept in memory (last 1000). Restarting the relay clears them; Roblox ignores events older than 2 minutes anyway.
