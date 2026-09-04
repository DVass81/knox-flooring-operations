FROM node:24-bookworm-slim AS build

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV NODE_ENV=production
ENV PORT=8080
ENV BASE_PATH=/

RUN corepack enable && corepack prepare pnpm@11.19.0 --activate

WORKDIR /app
COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @workspace/knox-flooring build
RUN pnpm --filter @workspace/api-server build

FROM node:24-bookworm-slim AS runtime

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV NODE_ENV=production
ENV PORT=8080

RUN corepack enable && corepack prepare pnpm@11.19.0 --activate

WORKDIR /app
COPY --from=build /app /app

EXPOSE 8080

CMD ["sh", "-c", "pnpm --filter @workspace/db push && exec node --enable-source-maps artifacts/api-server/dist/index.mjs"]
