FROM node:20-alpine AS builder

WORKDIR /app

# Copiar package.json y package-lock.json
COPY package*.json ./

# Instalar dependencias
RUN npm ci

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

# Copiar dist compilado desde el builder
COPY --from=builder /app/dist ./dist

# Exponer puerto (NestJS por defecto usa 3000)
EXPOSE 3000

# Comando para correr la app
CMD ["node", "dist/main.js"]
