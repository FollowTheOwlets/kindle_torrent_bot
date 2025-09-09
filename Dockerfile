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

# ❗ Требуется платформой: объявляем порты
# 3000 — если будете поднимать webhook HTTP-сервер (можно оставить даже при long polling, чтобы пройти валидацию)
EXPOSE 3000
# BitTorrent — входящие коннекты (ускоряет приём сидов)
EXPOSE 6881/tcp
EXPOSE 6881/udp

# В long-polling порты не нужны. Для входящих BT соединений — см. docker-compose.
CMD ["node", "dist/index.js"]
