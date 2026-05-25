FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY apps/server/package*.json apps/server/
COPY apps/web/package*.json apps/web/
RUN npm install
COPY . .
RUN npm run prisma:generate --workspace apps/server
RUN npm run build --workspace apps/server

FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
COPY apps/server/package*.json apps/server/
COPY apps/web/package*.json apps/web/
RUN npm install
COPY --from=build /app/apps/server/dist apps/server/dist
COPY --from=build /app/apps/server/prisma apps/server/prisma
WORKDIR /app/apps/server
EXPOSE 3000
