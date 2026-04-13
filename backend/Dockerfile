# Use official Node.js LTS image
FROM node:24-alpine

# Set working directory
WORKDIR /usr/src/app

# Copy package manifests first to leverage Docker layer caching
COPY package*.json ./

# Install build dependencies for native modules (like better-sqlite3)
RUN apk add --no-cache python3 make g++

# Install dependencies
RUN npm install --production=false

# Copy application source
COPY . .

# Ensure entrypoint and scripts are executable
RUN if [ -f ./docker-entrypoint.sh ]; then chmod +x ./docker-entrypoint.sh; fi
RUN if [ -d ./scripts ]; then chmod +x ./scripts/*.js 2>/dev/null || true; fi

# Create data and uploads directories
RUN mkdir -p /usr/src/app/data /usr/src/app/uploads

# Expose port
EXPOSE 8081

# Use entrypoint
ENTRYPOINT ["/usr/src/app/docker-entrypoint.sh"]

# Default command (development)
CMD ["npm", "run", "dev"]
