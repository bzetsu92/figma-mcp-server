FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./

RUN npm ci --only=production=false

COPY src ./src

RUN npm run build

EXPOSE 3333

CMD ["npm", "start"]

