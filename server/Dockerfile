# Backend API. Provisioning uses CREATE DATABASE ... TEMPLATE only (no pg_dump/psql).
FROM node:18-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

CMD ["node", "server.js"]
