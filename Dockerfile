# Multi-stage Docker build for Docker Monitor

# Stage 1: Build Frontend
FROM node:18-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy package files
COPY frontend/package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY frontend/ ./

# Build the application
RUN npm run build

# Stage 2: Setup Backend
FROM python:3.13-slim AS backend-builder

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy backend requirements
COPY backend/requirements.txt ./

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Stage 3: Final Production Image
FROM python:3.13-slim

# Install Node.js for runtime (for serving built frontend)
RUN apt-get update && apt-get install -y \
    nodejs \
    npm \
    supervisor \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy frontend server script
COPY serve_frontend.py /app/serve_frontend.py
RUN chmod +x /app/serve_frontend.py

# Copy supervisord config
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Create app directory
WORKDIR /app

# Copy Python dependencies from backend builder
COPY --from=backend-builder /usr/local/lib/python3.13/site-packages /usr/local/lib/python3.13/site-packages
COPY --from=backend-builder /usr/local/bin /usr/local/bin

# Copy backend code
COPY backend/ ./

# Copy built frontend
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Create data and log directories
RUN mkdir -p /app/data /var/log/supervisor && chmod -R 777 /var/log

# Expose ports
EXPOSE 8000 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Default command - run both services with supervisord
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
