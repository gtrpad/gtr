.PHONY: db web worker build test typecheck seed words deploy

db:
	docker compose up -d postgres

web:
	cd web && npm run dev

worker:
	cd web && npm run worker

build:
	cd web && npm run build

test:
	cd contracts && forge test

typecheck:
	cd web && npx tsc --noEmit -p .

seed:
	cd web && npm run seed:words

words:
	cd web && npx tsx --env-file=.env scripts/deploy-words.ts

deploy:
	cd contracts && forge script script/Deploy.s.sol:Deploy --rpc-url rh --broadcast --slow
