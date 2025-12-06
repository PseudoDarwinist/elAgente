FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source files
COPY . .

# Build TypeScript
RUN npm run build

# Expose port
EXPOSE 3001

# Set environment variables
ENV PORT=3001
ENV TRANSPORT=SSE

# Run the server
CMD ["node", "dist/index.js"]
