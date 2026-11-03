# Multi-stage production Dockerfile for Render Scalable Container Service
# Environment: Node.js 22 LTS (Slim Debian)
FROM node:22-slim

# Set working directory inside container
WORKDIR /app/backend

# Copy dependency manifests first for layer caching
COPY backend/package*.json ./

# Install only production dependencies (clean and fast)
RUN npm install --omit=dev

# Copy backend application source code
COPY backend ./

# Set runtime production environment defaults
ENV NODE_ENV=production
ENV PORT=5000

# Expose port (Render injects $PORT dynamically)
EXPOSE 5000

# Default command: launch the Model Context Protocol (MCP) server
CMD ["node", "mcb/mcpServer.js"]
