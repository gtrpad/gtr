#!/usr/bin/env sh
# Start the database, the site and the worker for local work.
set -e
cd "$(dirname "$0")/.."
docker compose up -d postgres
cd web
[ -f .env ] || cp .env.example .env
npm install
npx prisma db push
npm run seed:words
npm run dev &
npm run worker
