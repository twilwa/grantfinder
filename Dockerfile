# ABOUTME: Builds and runs the Grantfinder Bun server for container platforms such as Coolify.
# ABOUTME: The image ships the bundled server and expects Postgres plus Privy credentials at runtime.

FROM oven/bun:1.2.21 AS build

WORKDIR /app

COPY package.json bun.lock tsconfig.json ./
COPY src ./src
COPY fixtures ./fixtures

RUN bun install --frozen-lockfile
RUN bun run build

FROM oven/bun:1.2.21

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=build /app/dist ./dist
COPY --from=build /app/fixtures ./fixtures

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD bun -e "const port = process.env.PORT ?? '3000'; const response = await fetch('http://127.0.0.1:' + port + '/health'); process.exit(response.ok ? 0 : 1)"

CMD ["bun", "dist/server.js"]
