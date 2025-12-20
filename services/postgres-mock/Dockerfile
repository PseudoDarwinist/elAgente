FROM node:20-alpine

WORKDIR /app

# Create logs directory
RUN mkdir -p /app/logs

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5432

CMD ["npm", "start"]
