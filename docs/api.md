# Public API

All routes return JSON and read from the indexer.

* `GET /api/stats` exchange totals and public settings
* `GET /api/markets?filter=all|new|migrated|curve&sort=volume|new|fdv&q=&word=` market cards
* `GET /api/markets/{token}` market detail with recent trades and the holder pool
* `GET /api/markets/{token}/candles?tf=1m|5m|1h|1d&limit=300` candles from trades
* `GET /api/markets/{token}/holders?limit=50` top holders
* `GET /api/words` word cards with price, change and a 30 day sparkline
* `GET /api/words/{slug}` word detail with 90 days of views and prices
* `GET /api/rewards?wallet=0x…` payouts and pending estimates for a wallet
* `POST /api/rpc` JSON RPC proxy to Robinhood Chain for the browser
* `POST /api/launch/meta` multipart upload of a launch image and metadata, returns the URI written on chain
* `GET /m/{id}` token metadata, `GET /m/{id}/image` the image
