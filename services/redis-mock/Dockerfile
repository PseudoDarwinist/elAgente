FROM node:20-alpine

WORKDIR /app

RUN mkdir -p /app/logs

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 6379

CMD ["npm", "start"]
