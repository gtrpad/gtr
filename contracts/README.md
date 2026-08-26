# GTR contracts

Foundry project. Sources in `src`, tests in `test`, the deploy script in `script`.

* `AttentionFeed` reference price per word, pushed by the keeper, stale after 36 hours
* `PegVault` mints and redeems word coins for USDG at the feed price, bounded by each word's reserve
* `Launchpad` markets on a virtual constant product curve, migration into Uniswap v4, fee ledger
* `Router` one transaction routes for ETH, USDG and word coins, quotes by simulation
* `Buyback` buys the exchange coin with ETH and burns it
* `Disperse` batched holder payouts

```
forge install OpenZeppelin/openzeppelin-contracts@v5.1.0 Uniswap/v4-core Uniswap/v4-periphery
forge test
RH_RPC_URL=... forge test --match-contract ForkTest
```
