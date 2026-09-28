FROM node:24-alpine AS deps
WORKDIR /app
COPY apps/web/package*.json ./
RUN npm ci

FROM node:24-alpine AS builder
WORKDIR /app
ARG NEXT_PUBLIC_COMPASS_API_URL=http://localhost:28000
ENV NEXT_PUBLIC_COMPASS_API_URL=$NEXT_PUBLIC_COMPASS_API_URL
ARG NEXT_PUBLIC_MARKETPLACE_URL=http://localhost:3100
ENV NEXT_PUBLIC_MARKETPLACE_URL=$NEXT_PUBLIC_MARKETPLACE_URL
COPY --from=deps /app/node_modules ./node_modules
COPY apps/web ./
RUN npm run build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]
