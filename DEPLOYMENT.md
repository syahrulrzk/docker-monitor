# Docker Monitor Deployment Guide

## Prerequisites

Before deploying Docker Monitor on a new server, ensure you have:

### System Requirements
- **Linux/Ubuntu/Debian** (recommended)
- **Python 3.8+**
- **Node.js 16+** and **npm**
- **Docker** and **Docker Compose**
- **Git**

### Check Prerequisites
```bash
# Check Python version
python3 --version

# Check Node.js version
node --version
npm --version

# Check Docker
docker --version
docker-compose --version

# Check if Docker daemon is running
systemctl status docker
```

## Installation Steps

### 1. Clone Repository
```bash
git clone https://github.com/syahrulrzk/docker-monitor.git
cd docker-monitor
```

### 2. Backend Setup

#### Install Python Dependencies
```bash
cd backend

# For Ubuntu/Debian (recommended)
pip install -r requirements.txt

# For systems with externally managed Python (like Kali Linux)
pip install -r requirements.txt --break-system-packages
```

#### Verify Backend Dependencies
```bash
python -c "import fastapi, uvicorn, sqlalchemy, docker, psutil; print('All dependencies installed successfully')"
```

### 3. Frontend Setup

#### Install Node.js Dependencies
```bash
cd ../frontend
npm install
```

#### Build Frontend (Optional - for production)
```bash
npm run build
```

### 4. Environment Configuration

#### Create .env file (if needed)
```bash
# In the root directory
cp .env.example .env  # if you have an example file
```

Default configuration should work for most setups, but you can customize:
- Backend host/port
- CORS origins
- Database path

## Running the Application

### Development Mode

#### Start Backend
```bash
cd backend
python main.py
```
Backend will run on: `http://localhost:8000`

#### Start Frontend (in new terminal)
```bash
cd frontend
npm run dev
```
Frontend will run on: `http://localhost:5173` or `http://localhost:5174`

### Production Mode

#### Using PM2 (Recommended)
```bash
# Install PM2 globally
npm install -g pm2

# Start backend
cd backend
pm2 start "python main.py" --name "docker-monitor-backend"

# Start frontend (if using build)
cd ../frontend
pm2 start "npm run preview" --name "docker-monitor-frontend"

# Save PM2 configuration
pm2 save
pm2 startup
```

#### Using Docker Compose (Alternative)
```yaml
# docker-compose.yml
version: '3.8'
services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    volumes:
      - ./backend:/app
      - /var/run/docker.sock:/var/run/docker.sock
    environment:
      - DOCKER_HOST=unix:///var/run/docker.sock

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    depends_on:
      - backend
```

## Troubleshooting

### Common Issues

#### 1. "ModuleNotFoundError" for Python packages
```bash
# Try installing with --user flag
pip install -r requirements.txt --user

# Or use virtual environment
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

#### 2. "Address already in use" error
```bash
# Kill existing processes
pkill -f "python main.py"
pkill -f "npm"

# Or change ports in configuration
# Backend: modify settings in config.py
# Frontend: modify vite.config.js or package.json
```

#### 3. Docker permission denied
```bash
# Add user to docker group
sudo usermod -aG docker $USER

# Restart session or run:
newgrp docker
```

#### 4. Frontend build fails
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Clear npm cache
npm cache clean --force
```

#### 5. Database issues
```bash
# Remove old database
rm backend/docker_metrics.db

# The application will create a new one automatically
```

### Health Checks

#### Check if backend is running
```bash
curl http://localhost:8000/
# Should return: {"status":"running","message":"Docker Monitor API","version":"1.0.0"}
```

#### Check if frontend is accessible
```bash
curl http://localhost:5173/  # or your frontend port
```

#### Check Docker connectivity
```bash
curl http://localhost:8000/api/containers/all
# Should return container list
```

## Production Deployment

### 1. Using Nginx as Reverse Proxy
```nginx
# /etc/nginx/sites-available/docker-monitor
server {
    listen 80;
    server_name your-domain.com;

    location /api {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location / {
        proxy_pass http://localhost:5173;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 2. SSL with Let's Encrypt
```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d your-domain.com
```

### 3. Systemd Service
```bash
# Create service file: /etc/systemd/system/docker-monitor.service
[Unit]
Description=Docker Monitor Application
After=network.target docker.service

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/docker-monitor
ExecStart=/usr/bin/python3 backend/main.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

## Monitoring & Maintenance

### Logs
```bash
# Backend logs
tail -f backend/logs/app.log

# PM2 logs
pm2 logs

# System logs
journalctl -u docker-monitor -f
```

### Updates
```bash
# Pull latest changes
git pull origin main

# Update dependencies
cd backend && pip install -r requirements.txt --upgrade
cd ../frontend && npm update

# Restart services
pm2 restart all
```

### Backup
```bash
# Backup database
cp backend/docker_metrics.db backup/$(date +%Y%m%d)_metrics.db

# Backup configuration
cp .env backup/$(date +%Y%m%d)_config.env
```

## Security Considerations

1. **Change default ports** in production
2. **Use HTTPS** with SSL certificates
3. **Restrict CORS origins** to your domain only
4. **Use environment variables** for sensitive data
5. **Regular updates** of dependencies
6. **Monitor logs** for security issues
7. **Use firewall** (ufw/iptables) to restrict access

## Support

If you encounter issues:
1. Check the troubleshooting section above
2. Verify all prerequisites are installed
3. Check logs for error messages
4. Ensure Docker daemon is running
5. Verify network connectivity between services

For additional help, check the application logs and system resources.
