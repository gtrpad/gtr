# GTR web + worker (same image, START_CMD picks the process)
FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --no-audit --no-fund

FROM deps AS build
COPY . .
ARG NEXT_PUBLIC_ADDR_FEED
ARG NEXT_PUBLIC_ADDR_VAULT
ARG NEXT_PUBLIC_ADDR_LAUNCHPAD
ARG NEXT_PUBLIC_ADDR_ROUTER
ARG NEXT_PUBLIC_ADDR_BUYBACK
ARG NEXT_PUBLIC_ADDR_DISPERSE
ENV NEXT_PUBLIC_ADDR_FEED=$NEXT_PUBLIC_ADDR_FEED NEXT_PUBLIC_ADDR_VAULT=$NEXT_PUBLIC_ADDR_VAULT NEXT_PUBLIC_ADDR_LAUNCHPAD=$NEXT_PUBLIC_ADDR_LAUNCHPAD NEXT_PUBLIC_ADDR_ROUTER=$NEXT_PUBLIC_ADDR_ROUTER NEXT_PUBLIC_ADDR_BUYBACK=$NEXT_PUBLIC_ADDR_BUYBACK NEXT_PUBLIC_ADDR_DISPERSE=$NEXT_PUBLIC_ADDR_DISPERSE
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate && npm run build

FROM node:22-bookworm-slim AS run
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
COPY --from=build /app ./
EXPOSE 3000
# web: `npm run start` ; worker: `npm run worker:prod`
CMD ["sh", "-c", "${START_CMD:-npm run start}"]
