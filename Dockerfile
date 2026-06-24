FROM node:20-alpine

WORKDIR /app

# Instalar dependencias necesarias para compilar paquetes nativos si los hubiera
RUN apk add --no-cache libc6-compat

COPY package*.json ./

# Instalar dependencias de producción
RUN npm ci

COPY . .

# Deshabilitar telemetría de Next.js
ENV NEXT_TELEMETRY_DISABLED=1

# Compilar la aplicación Next.js
RUN npm run build

EXPOSE 3000

ENV PORT=3000
ENV NODE_ENV=production

CMD ["npm", "start"]
