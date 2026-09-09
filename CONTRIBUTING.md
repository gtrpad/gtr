# Contributing

The project is two parts: Foundry contracts in `contracts` and a Next.js app with its worker in `web`. Read the root README first.

## Ground rules

* Public copy is English, short and plain. No emoji.
* Every list on the site keeps a fixed height and scrolls inside. The header and footer must measure the same on every page.
* Word coin prices come from the feed only. Nothing on the site invents a number the chain does not know.
* Contracts change only with tests. Run `forge test` before opening a pull request. The fork test needs `RH_RPC_URL`.
* The worker never holds user funds. Anything it does is a public transaction and lands in the journal.

## Local setup

```
make db
cd web && cp .env.example .env && npm install && npx prisma db push && npm run seed:words
make web
make worker
```

## Pull requests

Keep them small and describe how you checked the change. Screenshots for anything visual.
