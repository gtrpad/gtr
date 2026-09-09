# Architecture

Three moving parts share one idea: attention as a quote currency.

## On chain

* **AttentionFeed** keeps one price per word, in USD with 18 decimals, and the time it was written. A read fails when the word is unknown or the last push is older than the staleness limit.
* **PegVault** owns every word coin. Buying sends USDG in and mints coins at the feed price plus the peg fee. Selling burns coins and pays USDG out of the reserve that word collected. The reserve is the hard limit on redemptions.
* **Launchpad** creates a market: a launch token with one billion supply, eight hundred million on a virtual constant product curve, two hundred million reserved for the pool. Caps are converted to the word coin at creation and never move. When the curve sells out the market migrates into a Uniswap v4 pool in the same transaction. Fees accrue in a ledger with three shares.
* **Router** stitches ETH, USDG and the word coin into one transaction in both directions and produces quotes by running the route and reverting with the result.
* **Buyback** takes ETH and burns the exchange coin. **Disperse** pays many holders in one transaction.

## Off chain

* **Indexer** reads launchpad, router, pool manager and transfer events into Postgres: markets, trades, balances, fee sweeps.
* **Oracle** reads yesterday's article views from Wikimedia once a day and pushes every word in one transaction.
* **Keeper** collects pool fees, sweeps the ledger, pays holders, converts treasury shares to USDG and ETH, and runs the buyback. Every action is journaled. Payouts and conversions only go on chain when the operator turns the execute switch on.

## Site

Next.js app router. Server components read Postgres through a small data layer, client components talk to the chain through an RPC proxy so the provider key never ships to the browser. The admin panel is a hidden route behind one password and a cookie.
