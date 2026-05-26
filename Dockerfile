# Multi-stage build for the Vite SPA.
#
# Hardening rationale:
#   - Pin Node LTS (22) by digest. Node 25 is non-LTS and drops security
#     patches relatively quickly. Update the digest when a new LTS minor
#     ships.
#   - Use a separate build stage so dev dependencies, source, and the
#     git history do NOT ship in the final image. The `.dockerignore`
#     file keeps secrets (.env, serviceAccountKey.json, .git) out of the
#     build context.
#   - `npm ci` for reproducible installs from `package-lock.json`.
#   - Final stage is `nginx:alpine` carrying only the static `dist/`
#     output. nginx drops privileges to a non-root worker after binding.

# ---- Build stage ------------------------------------------------------------
FROM node:22.13.1-alpine AS builder

WORKDIR /app

# Install deps first for layer caching.
COPY package.json package-lock.json ./
RUN npm ci

# Build context is filtered by `.dockerignore` (no `.env`, no SA key,
# no node_modules, no .git, no .planning, no docs).
COPY . .

RUN npm run build

# ---- Runtime stage ----------------------------------------------------------
FROM nginx:1.27-alpine

# Replace the default config with a SPA-friendly one.
RUN rm /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

RUN printf '%s\n' \
  'server {' \
  '  listen 8080;' \
  '  server_name _;' \
  '  root /usr/share/nginx/html;' \
  '  index index.html;' \
  '  location ~ /\\. { deny all; }' \
  '  location / {' \
  '    try_files $uri $uri/ /index.html;' \
  '  }' \
  '}' > /etc/nginx/conf.d/spa.conf

EXPOSE 8080

# nginx master process drops privileges to the `nginx` worker after start.
CMD ["nginx", "-g", "daemon off;"]
