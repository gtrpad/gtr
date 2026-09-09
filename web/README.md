# GTR web

Next.js app: public site, admin panel, API routes and the worker (indexer, oracle, keeper). See the root README for the full picture.

```
npm install
cp .env.example .env
npx prisma db push
npm run seed:words
npm run dev
npm run worker
```
