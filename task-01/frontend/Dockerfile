FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci --workspace frontend --include-workspace-root
COPY frontend frontend
ARG VITE_API_URL
ARG VITE_CURRENCY=USD
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_CURRENCY=$VITE_CURRENCY
RUN npm run build --workspace frontend

FROM nginxinc/nginx-unprivileged:alpine
COPY --from=build /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf.template /etc/nginx/templates/default.conf.template
HEALTHCHECK --interval=20s --timeout=5s --retries=3 CMD wget -q -O /dev/null "http://127.0.0.1:$PORT/" || exit 1
