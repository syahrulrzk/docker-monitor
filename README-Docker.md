# Docker Monitor - Containerized Version

This version packages both the backend (FastAPI) and frontend (React) into a single Docker container for easy deployment.

## Quick Start

### Build and Run with Docker Compose (Recommended)

```bash
# Build and start the application
docker-compose up --build

# Or run in background
docker-compose up -d --build
```

Access the application at:
- **Dashboard**: http://localhost:3000
- **API**: http://localhost:8000

### Build and Run Manually

```bash
# Build the image
docker build -t docker-monitor .

# Run the container
docker run -d \
  --name docker-monitor \
  -p 8000:8000 \
  -p 3000:3000 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v ./data:/app/data \
  docker-monitor
```

## Architecture

The container runs both services using `supervisord`:

- **Backend** (Port 8000): FastAPI server with Docker monitoring
- **Frontend** (Port 3000): React dashboard served by Python HTTP server

## Volumes

- `/var/run/docker.sock`: Docker socket for container monitoring
- `./data`: Persistent database storage
- `./logs`: Application logs (optional)

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BACKEND_HOST` | `0.0.0.0` | Backend server host |
| `BACKEND_PORT` | `8000` | Backend server port |
| `DATABASE_URL` | `sqlite:///./data/docker_metrics.db` | Database connection |
| `CORS_ORIGINS` | `http://localhost:3000,http://127.0.0.1:3000` | Allowed CORS origins |
| `DOCKER_HOST` | `unix:///var/run/docker.sock` | Docker daemon socket |

## Production Deployment

### With Nginx Reverse Proxy

```bash
# Start only the app container
docker-compose up -d docker-monitor

# Then configure Nginx to proxy:
# Frontend: proxy_pass http://localhost:3000;
# Backend API: proxy_pass http://localhost:8000;
```

### With SSL

```bash
# Use certbot with Nginx
sudo certbot --nginx -d your-domain.com
```

## Troubleshooting

### Container Won't Start
```bash
# Check logs
docker-compose logs docker-monitor

# Check if Docker socket is accessible
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock docker/docker-info
```

### Permission Issues
```bash
# Ensure Docker socket permissions
sudo chmod 666 /var/run/docker.sock

# Or add user to docker group
sudo usermod -aG docker $USER
```

### Port Conflicts
```bash
# Change ports in docker-compose.yml
ports:
  - "8080:8000"  # Backend
  - "3001:3000"  # Frontend
```

### Database Issues
```bash
# Reset database
docker-compose down
sudo rm -rf data/
docker-compose up --build
```

## Development

### Rebuild After Changes
```bash
# Rebuild and restart
docker-compose up --build --force-recreate
```

### Access Container Shell
```bash
docker-compose exec docker-monitor bash
```

### View Logs
```bash
# All logs
docker-compose logs -f

# Specific service logs
docker-compose logs -f docker-monitor
```

## File Structure

```
docker-monitor/
├── Dockerfile              # Multi-stage build
├── docker-compose.yml      # Container orchestration
├── supervisord.conf        # Process manager config
├── serve_frontend.py       # Frontend server script
├── backend/                # FastAPI backend
├── frontend/               # React frontend
└── data/                   # Persistent data (created)
```

## Security Notes

- Container runs as non-root user (`app`)
- Docker socket is mounted read-only for monitoring
- Health checks ensure service availability
- CORS configured for frontend-backend communication

## Resource Usage

- **Image Size**: ~500MB (multi-stage build optimizes size)
- **Memory**: ~200-300MB running
- **CPU**: Minimal when idle, scales with monitoring activity

## Backup & Restore

```bash
# Backup data
tar -czf backup_$(date +%Y%m%d).tar.gz data/

# Restore data
tar -xzf backup_20241111.tar.gz
