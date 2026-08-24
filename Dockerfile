# syntax=docker/dockerfile:1

# Ein Abbild für beide Prozesse (Weboberfläche und Worker). Der Unterschied
# liegt nur im Startbefehl – das hält den Betrieb auf dem Server einfach.

FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# --- Alle Abhängigkeiten, für den Build ------------------------------------
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# --- Nur die Laufzeit-Abhängigkeiten ---------------------------------------
#
# Getrennt installiert statt einzelne Pakete aus dem Build-Abbild zu picken.
# Welche Pakete tsx oder Prisma intern brauchen, ändert sich mit jeder
# Version; eine handgepflegte Liste läuft dieser Änderung immer hinterher und
# lässt den Build irgendwann an einer fehlenden Datei scheitern.
FROM base AS prod-deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# --- Build -----------------------------------------------------------------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Prisma braucht beim Build eine gesetzte Variable; verbunden wird nicht.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
ENV ENCRYPTION_KEY="ZHVtbXkta2V5LWZvci1idWlsZC1vbmx5LTMyYnl0ZQ=="
ENV SESSION_SECRET="ZHVtbXktc2VjcmV0LWZvci1idWlsZC1vbmx5LTMyYnl0"
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate && npm run build

# --- Laufzeit --------------------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# Laufzeit-Abhängigkeiten für Worker und Migrationen.
COPY --from=prod-deps --chown=nextjs:nodejs /app/node_modules ./node_modules
# Der von Prisma erzeugte Client entsteht erst beim Build.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma

# Standalone-Ausgabe von Next: bringt ihre eigenen node_modules mit und legt
# sie über die vorhandenen. Deshalb nach den Laufzeit-Abhängigkeiten kopieren.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Quellcode und Schema für Worker und Migrationen.
COPY --from=builder --chown=nextjs:nodejs /app/src ./src
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/tsconfig.json ./tsconfig.json

USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
