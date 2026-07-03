FROM node:20-slim AS builder
WORKDIR /app
RUN apt-get update -qq && apt-get install -y -qq python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json ./
COPY backend/package.json ./backend/
COPY shared ./shared
COPY backend ./backend
RUN cd backend && npm ci && npx tsc

FROM node:20-slim
WORKDIR /app
RUN apt-get update -qq && apt-get install -y -qq python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/backend/package.json ./backend/
COPY --from=builder /app/backend/node_modules ./backend/node_modules
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/shared ./shared
EXPOSE 3001
ENV NODE_ENV=production
CMD ["node", "backend/dist/index.js"]
