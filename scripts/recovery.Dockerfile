FROM node:24-bookworm-slim
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV NODE_ENV=production
ENV PORT=8080
ENV READ_ONLY_RECOVERY=true
ENV BACKGROUND_WORKERS_ENABLED=false
ENV DEMO_ACCESS_ENABLED=false
RUN corepack enable && corepack prepare pnpm@11.19.0 --activate
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile --prod=false --config.strict-dep-builds=false && pnpm rebuild esbuild
RUN pnpm --filter @workspace/api-server build
EXPOSE 8080
# Recovery must never apply schema changes or execute demo initialization.
CMD ["sh", "-c", "pnpm --filter @workspace/db migrate:check && exec node --enable-source-maps artifacts/api-server/dist/recovery.mjs"]
