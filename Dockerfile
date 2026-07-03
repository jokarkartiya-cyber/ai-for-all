FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json ./
COPY backend/package.json ./backend/
COPY shared ./shared
COPY backend ./backend
RUN cd backend && npm ci && npx tsc

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/backend/package.json ./backend/
COPY --from=builder /app/backend/node_modules ./backend/node_modules
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/shared ./shared
EXPOSE 3001
ENV NODE_ENV=production
CMD ["node", "backend/dist/index.js"]
