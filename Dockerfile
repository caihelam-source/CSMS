# Use Node.js 18 Alpine
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (including @aws-sdk for R2 support)
RUN npm ci

# Copy application files
COPY . .

# Create uploads directory
RUN mkdir -p uploads/documents uploads/images

# Expose port
EXPOSE 5000

# Set environment
ENV NODE_ENV=production

# Start application
CMD ["node", "server/index.js"]
