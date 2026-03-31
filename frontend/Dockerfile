FROM node:20-alpine

WORKDIR /app

# Installe les dépendances en premier (layer cacheable)
COPY package.json package-lock.json ./
RUN npm install

# Copie le code (écrasé par le volume en dev)
COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev"]
