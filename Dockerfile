# Production image for Railway (or any Docker host).
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Build-time env validation is skipped; runtime validates real config.
ENV NEXT_TELEMETRY_DISABLED=1
RUN APP_URL=https://build.invalid DATABASE_URL=postgres://build npm run build

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
COPY --from=build /app ./
EXPOSE 3000
# Applies pending migrations (advisory-locked) then starts the server.
CMD ["npm", "run", "start:prod"]
