FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY apps/web/package*.json apps/web/
COPY apps/server/package*.json apps/server/
RUN npm install
COPY . .
RUN npm run build --workspace apps/web

FROM nginx:1.27-alpine
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
