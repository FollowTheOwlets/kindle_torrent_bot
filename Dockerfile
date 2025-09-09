# ---------- build stage ----------
FROM node:20-bookworm-slim AS builder
WORKDIR /app

# Оптимальный кеш: сначала манифесты
COPY package.json package-lock.json* ./
RUN npm ci

# Копируем исходники и собираем
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---------- runtime stage ----------
FROM node:20-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    # Telegraf: снимем лимит 90с на обработчик
    TELEGRAF_HANDLER_TIMEOUT=Infinity

# Только прод-зависимости
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# Копируем собранный dist
COPY --from=builder /app/dist ./dist

# Работать как non-root (uid 1000 у node)
USER node

# В long-polling порты не нужны. Для входящих BT соединений — см. docker-compose.
CMD ["node", "dist/index.js"]
