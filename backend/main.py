from fastapi import FastAPI, Depends, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import and_
from datetime import datetime, timedelta
from typing import List
from pydantic import BaseModel
from database import get_db, HostMetric, ContainerMetric, init_db
from collector import start_collector
from config import settings
import logging
import asyncio
import docker
import json

# Configure logging with proper formatting
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

# Pydantic models for API responses
class HostMetricResponse(BaseModel):
    timestamp: datetime
    cpu_percent: float
    memory_percent: float
    memory_used_mb: float
    memory_total_mb: float
    disk_read_kb: float = 0.0
    disk_write_mb: float = 0.0
    network_in_mbit: float = 0.0
    network_out_mbit: float = 0.0
    
    class Config:
        from_attributes = True

class ContainerMetricResponse(BaseModel):
    timestamp: datetime
    container_id: str
    container_name: str
    cpu_percent: float
    memory_percent: float
    memory_used_mb: float
    memory_limit_mb: float
    
    class Config:
        from_attributes = True

class MetricsResponse(BaseModel):
    host_metrics: List[HostMetricResponse]
    container_metrics: List[ContainerMetricResponse]

# Initialize FastAPI app
app = FastAPI(
    title="Docker Monitor API",
    description="Real-time Docker container monitoring with FastAPI",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    """Initialize database and start metrics collector on startup"""
    logger.info("Starting up application...")
    init_db()
    start_collector()
    logger.info("Application startup complete")

@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "status": "running",
        "message": "Docker Monitor API",
        "version": "1.0.0"
    }

@app.get("/health")
async def health():
    """Health check endpoint for Docker healthcheck"""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat()
    }

@app.get("/api/metrics", response_model=MetricsResponse)
async def get_metrics(db: Session = Depends(get_db)):
    """
    Get host and container metrics from the last 24 hours
    """
    try:
        # Calculate 24 hours ago
        time_threshold = datetime.utcnow() - timedelta(hours=24)
        
        # Query host metrics
        host_metrics = db.query(HostMetric).filter(
            HostMetric.timestamp >= time_threshold
        ).order_by(HostMetric.timestamp.asc()).all()
        
        # Query container metrics
        container_metrics = db.query(ContainerMetric).filter(
            ContainerMetric.timestamp >= time_threshold
        ).order_by(ContainerMetric.timestamp.asc()).all()
        
        logger.info(f"Retrieved {len(host_metrics)} host metrics and {len(container_metrics)} container metrics")
        
        return MetricsResponse(
            host_metrics=[HostMetricResponse.from_orm(h) for h in host_metrics],
            container_metrics=[ContainerMetricResponse.from_orm(c) for c in container_metrics]
        )
    except Exception as e:
        logger.error(f"Error retrieving metrics: {e}")
        return MetricsResponse(
            host_metrics=[],
            container_metrics=[]
        )

@app.get("/api/metrics/latest")
async def get_latest_metrics(db: Session = Depends(get_db)):
    """Get the most recent metrics snapshot"""
    try:
        latest_host = db.query(HostMetric).order_by(HostMetric.timestamp.desc()).first()
        latest_containers = db.query(ContainerMetric).order_by(ContainerMetric.timestamp.desc()).limit(20).all()
        
        return {
            "host": HostMetricResponse.from_orm(latest_host) if latest_host else None,
            "containers": [ContainerMetricResponse.from_orm(c) for c in latest_containers]
        }
    except Exception as e:
        logger.error(f"Error retrieving latest metrics: {e}")
        return {"host": None, "containers": []}

@app.get("/api/containers/all")
async def get_all_containers():
    """Get all Docker containers (running and stopped) with detailed info"""
    import docker
    from datetime import datetime as dt, timezone
    try:
        docker_client = docker.from_env()
        containers = docker_client.containers.list(all=True)
        
        result = []
        for container in containers:
            # Get status info
            state = container.attrs['State']
            status = state['Status']  # running, exited, created, paused, etc
            
            # Parse started time for UPTIME (not created time)
            if status == 'running' and state.get('StartedAt'):
                started_str = state['StartedAt']
                started_dt = dt.fromisoformat(started_str.replace('Z', '+00:00'))
                now = dt.now(timezone.utc)
                uptime_seconds = (now - started_dt).total_seconds()
            elif state.get('FinishedAt') and state['FinishedAt'] != '0001-01-01T00:00:00Z':
                finished_str = state['FinishedAt']
                finished_dt = dt.fromisoformat(finished_str.replace('Z', '+00:00'))
                now = dt.now(timezone.utc)
                uptime_seconds = (now - finished_dt).total_seconds()
            else:
                created_str = container.attrs['Created']
                created_dt = dt.fromisoformat(created_str.replace('Z', '+00:00'))
                now = dt.now(timezone.utc)
                uptime_seconds = (now - created_dt).total_seconds()
            
            # Calculate uptime components
            days = int(uptime_seconds // 86400)
            hours = int((uptime_seconds % 86400) // 3600)
            minutes = int((uptime_seconds % 3600) // 60)
            
            # Create display text based on status
            if status == 'running':
                uptime_display = f"{days}d {hours}h" if days > 0 else f"{hours}h {minutes}m"
                uptime_label = "Up"
            elif status == 'exited':
                uptime_display = f"{days}d {hours}h" if days > 0 else f"{hours}h {minutes}m"
                uptime_label = "Exited"
            else:
                uptime_display = f"{days}d {hours}h" if days > 0 else f"{hours}h {minutes}m"
                uptime_label = "Created"
            
            # Get CPU and Memory from database metrics (faster than stats())
            cpu_percent = 0.0
            memory_mb = 0.0
            memory_percent = 0.0
            
            # Only get stats for running containers, but skip to avoid blocking
            # Frontend will get real-time metrics from /api/metrics endpoint
            
            result.append({
                "id": container.id[:12],
                "full_id": container.id,
                "name": container.name,
                "image": container.image.tags[0] if container.image.tags else container.image.id[:12],
                "status": status,
                "state": state['Status'],
                "created": container.attrs['Created'],
                "started_at": state.get('StartedAt', ''),
                "finished_at": state.get('FinishedAt', ''),
                "uptime_seconds": int(uptime_seconds),
                "uptime_days": days,
                "uptime_hours": hours,
                "uptime_minutes": minutes,
                "uptime_display": uptime_display,
                "uptime_label": uptime_label,
                "cpu_percent": round(cpu_percent, 2),
                "memory_mb": round(memory_mb, 2),
                "memory_percent": round(memory_percent, 2),
                "ports": container.attrs.get('NetworkSettings', {}).get('Ports', {})
            })
        
        return {"containers": result, "total": len(result)}
    except Exception as e:
        logger.error(f"Error getting containers: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return {"containers": [], "total": 0}

@app.get("/api/containers/{container_name}/logs")
async def get_container_logs(container_name: str, tail: int = 100, date: str = None):
    """Get real-time logs from a specific container with optional date filter"""
    import docker
    import re
    from datetime import datetime as dt
    from dateutil import parser as date_parser
    
    try:
        docker_client = docker.from_env()
        container = docker_client.containers.get(container_name)
        
        # Get more logs if filtering by date (fetch all for accuracy)
        # If date filter: get all logs, else use tail parameter
        if date:
            # Fetch all logs when filtering by date
            raw_logs = container.logs(timestamps=True).decode('utf-8', errors='ignore')
        else:
            # Fetch only tail amount for performance
            raw_logs = container.logs(tail=tail, timestamps=True).decode('utf-8', errors='ignore')
        
        logs = []
        for line in raw_logs.split('\n'):
            if not line.strip():
                continue
                
            # Parse timestamp and message - Docker format: TIMESTAMP MESSAGE
            parts = line.split(' ', 1)
            if len(parts) == 2:
                timestamp_str, message = parts
            else:
                timestamp_str = datetime.utcnow().isoformat()
                message = line
            
            # Filter by date if provided
            if date:
                try:
                    # Parse timestamp flexibly
                    log_datetime = date_parser.parse(timestamp_str)
                    log_date = log_datetime.strftime('%Y-%m-%d')
                    
                    # Skip if date doesn't match
                    if log_date != date:
                        continue
                except Exception as e:
                    logger.debug(f"Failed to parse timestamp {timestamp_str}: {e}")
                    continue
            
            # Determine log level from message content
            level = 'INFO'
            details = {}
            
            if re.search(r'\b(error|500|502|503|504|failed|exception|fatal)\b', message, re.IGNORECASE):
                level = 'ERROR'
                if '500' in message or 'error' in message.lower():
                    details['severity'] = 'high'
                    if 'http' in message.lower():
                        details['type'] = 'HTTP Error'
            elif re.search(r'\b(warn|warning|deprecated)\b', message, re.IGNORECASE):
                level = 'WARNING'
                details['severity'] = 'medium'
            elif re.search(r'\b(success|started|connected|ready)\b', message, re.IGNORECASE):
                level = 'INFO'
                details['severity'] = 'low'
            
            logs.append({
                'timestamp': timestamp_str,
                'level': level,
                'message': message.strip(),
                'details': details if details else None
            })
        
        return {
            'container_name': container_name,
            'logs': logs,
            'total': len(logs),
            'date': date or 'all'
        }
        
    except docker.errors.NotFound:
        logger.error(f"Container {container_name} not found")
        return {"error": "Container not found", "logs": []}
    except Exception as e:
        logger.error(f"Error getting container logs: {e}")
        return {"error": str(e), "logs": []}

@app.get("/api/containers/stats")
async def get_containers_stats():
    """Get container statistics including total size"""
    import docker
    try:
        docker_client = docker.from_env()
        containers = docker_client.containers.list(all=True)
        
        total_size = 0
        container_stats = []
        
        for container in containers:
            try:
                # Get container size
                size_data = container.attrs.get('SizeRw', 0) or 0
                root_fs = container.attrs.get('SizeRootFs', 0) or 0
                
                container_size = size_data + root_fs
                total_size += container_size
                
                container_stats.append({
                    'id': container.id[:12],
                    'name': container.name,
                    'size_bytes': container_size,
                    'size_mb': round(container_size / (1024 * 1024), 2),
                    'status': container.status
                })
            except Exception as e:
                logger.warning(f"Error getting size for container {container.name}: {e}")
                continue
        
        return {
            'total_size_bytes': total_size,
            'total_size_mb': round(total_size / (1024 * 1024), 2),
            'total_size_gb': round(total_size / (1024 * 1024 * 1024), 2),
            'container_count': len(containers),
            'containers': container_stats
        }
        
    except Exception as e:
        logger.error(f"Error getting container stats: {e}")
        return {
            'total_size_bytes': 0,
            'total_size_mb': 0,
            'total_size_gb': 0,
            'container_count': 0,
            'containers': []
        }

@app.get("/api/logs/files")
async def get_log_files(container_id: str = None, container_name: str = None):
    """List log files from /var/lib/docker/containers/<container_id>/"""
    import docker
    import os
    import glob
    from pathlib import Path
    
    try:
        docker_client = docker.from_env()
        log_files = []
        
        # Get all containers or specific one by ID or Name
        if container_id:
            try:
                container = docker_client.containers.get(container_id)
                containers_to_check = [container]
            except:
                containers_to_check = []
        elif container_name:
            try:
                container = docker_client.containers.get(container_name)
                containers_to_check = [container]
            except:
                containers_to_check = []
        else:
            containers_to_check = docker_client.containers.list(all=True)
        
        for container in containers_to_check:
            full_id = container.id
            log_dir = f"/var/lib/docker/containers/{full_id}"
            
            # Check if directory exists and is accessible
            if os.path.exists(log_dir) and os.access(log_dir, os.R_OK):
                # Find all .log files
                for log_file in glob.glob(f"{log_dir}/*.log"):
                    try:
                        file_stat = os.stat(log_file)
                        modified_date = datetime.fromtimestamp(file_stat.st_mtime)
                        
                        # Generate readable filename: container-name-YYYY-MM-DD.log
                        readable_filename = f"{container.name}-{modified_date.strftime('%Y-%m-%d')}.log"
                        
                        # Calculate log age in days
                        log_age_days = (datetime.now() - modified_date).days
                        retention_days = 30
                        retention_status = min(log_age_days, retention_days)
                        
                        log_files.append({
                            'path': log_file,
                            'filename': readable_filename,  # Human-readable filename
                            'original_filename': os.path.basename(log_file),  # Original Docker filename
                            'container_id': full_id[:12],
                            'full_container_id': full_id,
                            'container_name': container.name,
                            'container_status': container.status,
                            'size_bytes': file_stat.st_size,
                            'size_mb': round(file_stat.st_size / (1024 * 1024), 2),
                            'modified': modified_date.isoformat(),
                            'modified_date': modified_date.strftime('%Y-%m-%d'),
                            'log_age_days': log_age_days,
                            'retention_days': retention_days,
                            'retention_status': f"{retention_status}/{retention_days} days"
                        })
                    except Exception as e:
                        logger.warning(f"Error reading log file {log_file}: {e}")
                        continue
        
        # Sort by modified time (newest first)
        log_files.sort(key=lambda x: x['modified'], reverse=True)
        
        return {
            'log_files': log_files,
            'total': len(log_files)
        }
        
    except Exception as e:
        logger.error(f"Error listing log files: {e}")
        return {
            'log_files': [],
            'total': 0,
            'error': str(e)
        }

@app.get("/api/logs/read")
async def read_log_file(
    path: str,
    page: int = 1,
    page_size: int = 500,
    level: str = None,
    search: str = None,
    sort: str = 'newest',
    container_name: str = None
):
    """Read log file content with pagination and filtering"""
    import os
    import re
    import json
    from datetime import datetime
    
    try:
        # Security check - ensure path is within Docker containers directory
        if '/var/lib/docker/containers/' not in path or '..' in path:
            return {
                'error': 'Invalid log file path',
                'logs': [],
                'total': 0
            }
        
        if not os.path.exists(path) or not os.access(path, os.R_OK):
            return {
                'error': 'Log file not found or not accessible',
                'logs': [],
                'total': 0
            }
        
        logs = []
        
        # Read file
        with open(path, 'r', errors='ignore') as f:
            lines = f.readlines()
        
        # Parse each line (Docker JSON log format)
        for line_num, line in enumerate(lines):
            if not line.strip():
                continue
            
            try:
                # Try to parse as JSON (Docker log format)
                log_entry = json.loads(line)
                timestamp = log_entry.get('time', datetime.utcnow().isoformat())
                message = log_entry.get('log', '').strip()
                stream = log_entry.get('stream', 'stdout')
            except json.JSONDecodeError:
                # Fallback to plain text parsing
                timestamp = datetime.utcnow().isoformat()
                message = line.strip()
                stream = 'stdout'
            
            # Determine log level from message
            log_level = 'INFO'
            if re.search(r'\b(error|500|502|503|504|failed|exception|fatal|critical)\b', message, re.IGNORECASE):
                log_level = 'ERROR'
            elif re.search(r'\b(warn|warning|deprecated|caution)\b', message, re.IGNORECASE):
                log_level = 'WARNING'
            elif re.search(r'\b(debug|trace|verbose)\b', message, re.IGNORECASE):
                log_level = 'DEBUG'
            elif re.search(r'\b(info|success|started|connected|ready)\b', message, re.IGNORECASE):
                log_level = 'INFO'
            
            # Apply level filter
            if level and level.upper() != 'ALL' and log_level != level.upper():
                continue
            
            # Apply search filter
            if search and search.lower() not in message.lower():
                continue
            
            logs.append({
                'line_number': line_num + 1,
                'timestamp': timestamp,
                'level': log_level,
                'message': message,
                'stream': stream,
                'container_name': container_name if container_name else 'Unknown',
                'size': len(message)
            })
        
        # Sort logs
        if sort == 'oldest':
            logs.sort(key=lambda x: x['timestamp'])
        else:  # newest first (default)
            logs.sort(key=lambda x: x['timestamp'], reverse=True)
        
        # Pagination
        total_logs = len(logs)
        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size
        paginated_logs = logs[start_idx:end_idx]
        
        return {
            'logs': paginated_logs,
            'total': total_logs,
            'page': page,
            'page_size': page_size,
            'total_pages': (total_logs + page_size - 1) // page_size,
            'container_name': container_name
        }
        
    except Exception as e:
        logger.error(f"Error reading log file: {e}")
        return {
            'error': str(e),
            'logs': [],
            'total': 0
        }

@app.get("/api/containers/{container_name}/logs/live")
async def get_live_container_logs(container_name: str, since: str = None):
    """Get live container logs since a specific timestamp"""
    try:
        docker_client = docker.from_env()
        container = docker_client.containers.get(container_name)

        # Parse since timestamp
        since_timestamp = None
        if since:
            try:
                since_timestamp = int(datetime.fromisoformat(since.replace('Z', '+00:00')).timestamp())
            except:
                since_timestamp = int((datetime.utcnow() - timedelta(seconds=30)).timestamp())

        # Get logs since the specified time
        if since_timestamp:
            new_logs = container.logs(since=since_timestamp, timestamps=True).decode('utf-8', errors='ignore')
        else:
            # First call - get recent logs
            new_logs = container.logs(tail=50, timestamps=True).decode('utf-8', errors='ignore')

        logs = []
        for line in new_logs.split('\n'):
            if line.strip():
                # Parse timestamp and message
                parts = line.split(' ', 1)
                if len(parts) == 2:
                    timestamp_str, message = parts
                else:
                    timestamp_str = datetime.utcnow().isoformat()
                    message = line

                import re
                level = 'INFO'
                details = {}

                if re.search(r'\b(error|500|502|503|504|failed|exception|fatal)\b', message, re.IGNORECASE):
                    level = 'ERROR'
                    if '500' in message or 'error' in message.lower():
                        details['severity'] = 'high'
                        if 'http' in message.lower():
                            details['type'] = 'HTTP Error'
                elif re.search(r'\b(warn|warning|deprecated)\b', message, re.IGNORECASE):
                    level = 'WARNING'
                    details['severity'] = 'medium'
                elif re.search(r'\b(success|started|connected|ready)\b', message, re.IGNORECASE):
                    level = 'INFO'
                    details['severity'] = 'low'

                logs.append({
                    'timestamp': timestamp_str,
                    'level': level,
                    'message': message.strip(),
                    'details': details if details else None
                })

        return {
            'container_name': container_name,
            'logs': logs,
            'total': len(logs),
            'latest_timestamp': logs[-1]['timestamp'] if logs else None
        }

    except docker.errors.NotFound:
        logger.error(f"Container {container_name} not found")
        return {"error": "Container not found", "logs": []}
    except Exception as e:
        logger.error(f"Error getting live logs for container {container_name}: {e}")
        return {"error": str(e), "logs": []}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.backend_host,
        port=settings.backend_port,
        reload=True
    )
