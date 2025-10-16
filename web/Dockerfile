FROM node:20-bullseye AS deps
WORKDIR /app
COPY package*.json ./
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ pkg-config libusb-1.0-0-dev \
 && npm ci 
FROM node:20-bullseye AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-bullseye-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next ./.next
COPY package*.json ./
COPY public ./public
RUN npm ci --omit=dev
EXPOSE 3001
CMD ["npm","run","start","--","-p","3001"]
