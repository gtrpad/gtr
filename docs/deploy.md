# Deploying

## Contracts

```
cd contracts
cp .env.example .env
forge script script/Deploy.s.sol:Deploy --rpc-url rh --broadcast --slow
```

The script deploys the feed, the vault, the launchpad, the router, the buyback and disperse, registers the router and the keeper, and prints every address. Put them into `web/.env` as `NEXT_PUBLIC_ADDR_*` together with the deploy block.

## Web and worker

One Docker image serves both. `START_CMD` picks `npm run start` for the site and `npm run worker:prod` for the worker. The site runs `prisma db push` before it starts, so a fresh database is ready on first boot. Seed the catalogue once with `npm run seed:words`, then create the coins with the word deployment script or from the operator panel.

Set `public_base_url` in the operator panel to the public domain so token metadata resolves.
