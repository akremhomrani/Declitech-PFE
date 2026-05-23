FROM node:20-bookworm-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund --loglevel=error
COPY . .
RUN node --max-old-space-size=1024 node_modules/@angular/cli/bin/ng build --configuration production

FROM nginx:alpine
COPY --from=builder /app/dist/declitech-frontend/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
