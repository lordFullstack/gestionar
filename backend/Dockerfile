FROM node:20-alpine AS builder
WORKDIR /app
# Copiar package.json y package-lock.json
COPY package*.json ./
# Instalar dependencias
RUN npm ci
# Copiar el schema de prisma ANTES de generar el cliente
COPY prisma ./prisma
# Generar el cliente de Prisma (crítico: sin esto, nest build falla)
RUN npx prisma generate
# Copiar código fuente
COPY . .
# Buildear la app
RUN npm run build
# Stage final - runtime
FROM node:20-alpine
WORKDIR /app
# Copiar solo package.json para instalar dependencias de producción
COPY package*.json ./
# Instalar solo dependencias de producción
RUN npm ci --only=production
# Copiar el schema de prisma (necesario para que el cliente funcione en runtime)
COPY prisma ./prisma
# Generar el cliente de Prisma también en la imagen final
RUN npx prisma generate
# Copiar dist compilado desde el builder
COPY --from=builder /app/dist ./dist
# Exponer puerto (NestJS por defecto usa 3000)
EXPOSE 3000
# Ejecutar migraciones pendientes y luego arrancar el server
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
