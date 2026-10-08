FROM node:24-bookworm-slim AS build
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.19.0 --activate
COPY . .
RUN pnpm install --frozen-lockfile --config.strict-dep-builds=false && pnpm rebuild esbuild
RUN pnpm --filter @workspace/knox-flooring build:public-sample

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production
ENV PORT=8080
WORKDIR /app
COPY --from=build /app/public-demo/server.mjs /app/public-demo/sample-data.mjs ./public-demo/
COPY --from=build /app/artifacts/knox-flooring/dist/public-sample ./artifacts/knox-flooring/dist/public-sample
EXPOSE 8080
USER node
CMD ["node", "public-demo/server.mjs"]
