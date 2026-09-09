# Security

GTR runs live on Robinhood Chain. If you find a problem in the contracts, the router, the keeper or the site, please report it privately through GitHub security advisories on this repository before posting anywhere else.

What is in scope: the six contracts listed in the README, the worker (indexer, oracle, keeper), the admin panel and the public API.

Things we already know and document on purpose: a word coin is redeemable only up to its own reserve, a stale feed pauses trading in that word, and article views can be pushed in the short term. These are design limits, not bugs, and the site shows them on every word page.
