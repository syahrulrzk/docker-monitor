import psutil
import docker
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from database import HostMetric, ContainerMetric, SessionLocal, init_db
from config import settings
import time
import threading
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class MetricsCollector:
    def __init__(self):
        self.docker_client = None
        self.last_disk_io = None
        self.last_network_io = None
        self.last_time = time.time()
        try:
            self.docker_client = docker.from_env()
            logger.info("Docker client initialized successfully")
        except Exception as e:
            logger.warning(f"Could not initialize Docker client: {e}")
    
    def collect_host_metrics(self, db: Session):
        """Collect host CPU, RAM, Disk I/O and Network metrics"""
        try:
            # CPU & Memory
            cpu_percent = psutil.cpu_percent(interval=1)
            memory = psutil.virtual_memory()
            
            # Disk I/O
            disk_io = psutil.disk_io_counters()
            current_time = time.time()
            
            disk_read_kb = 0.0
            disk_write_mb = 0.0
            
            if self.last_disk_io and disk_io:
                time_delta = current_time - self.last_time
                if time_delta > 0:
                    # Calculate KB/s for reads
                    read_bytes = disk_io.read_bytes - self.last_disk_io.read_bytes
                    disk_read_kb = (read_bytes / 1024) / time_delta
                    
                    # Calculate MB/s for writes
                    write_bytes = disk_io.write_bytes - self.last_disk_io.write_bytes
                    disk_write_mb = (write_bytes / (1024 * 1024)) / time_delta
            
            self.last_disk_io = disk_io
            
            # Network I/O
            net_io = psutil.net_io_counters()
            
            network_in_mbit = 0.0
            network_out_mbit = 0.0
            
            if self.last_network_io and net_io:
                time_delta = current_time - self.last_time
                if time_delta > 0:
                    # Calculate Mbit/s
                    bytes_recv = net_io.bytes_recv - self.last_network_io.bytes_recv
                    network_in_mbit = (bytes_recv * 8 / 1_000_000) / time_delta
                    
                    bytes_sent = net_io.bytes_sent - self.last_network_io.bytes_sent
                    network_out_mbit = (bytes_sent * 8 / 1_000_000) / time_delta
            
            self.last_network_io = net_io
            self.last_time = current_time
            
            host_metric = HostMetric(
                cpu_percent=cpu_percent,
                memory_percent=memory.percent,
                memory_used_mb=memory.used / (1024 * 1024),
                memory_total_mb=memory.total / (1024 * 1024),
                disk_read_kb=round(disk_read_kb, 2),
                disk_write_mb=round(disk_write_mb, 2),
                network_in_mbit=round(network_in_mbit, 2),
                network_out_mbit=round(network_out_mbit, 2)
            )
            db.add(host_metric)
            db.commit()
            logger.info(f"Host metrics: CPU={cpu_percent}%, RAM={memory.percent}%, Disk R={disk_read_kb:.2f}KB/s W={disk_write_mb:.2f}MB/s, Net In={network_in_mbit:.2f}Mbit/s Out={network_out_mbit:.2f}Mbit/s")
        except Exception as e:
            logger.error(f"Error collecting host metrics: {e}")
            db.rollback()
    
    def collect_container_metrics(self, db: Session):
        """Collect container CPU and RAM metrics"""
        if not self.docker_client:
            logger.warning("Docker client not available, skipping container metrics")
            return
        
        try:
            containers = self.docker_client.containers.list()
            
            for container in containers:
                try:
                    stats = container.stats(stream=False)
                    
                    # Calculate CPU percentage
                    cpu_delta = stats['cpu_stats']['cpu_usage']['total_usage'] - \
                                stats['precpu_stats']['cpu_usage']['total_usage']
                    system_delta = stats['cpu_stats']['system_cpu_usage'] - \
                                   stats['precpu_stats']['system_cpu_usage']
                    
                    cpu_percent = 0.0
                    if system_delta > 0 and cpu_delta > 0:
                        cpu_percent = (cpu_delta / system_delta) * \
                                     len(stats['cpu_stats']['cpu_usage'].get('percpu_usage', [1])) * 100.0
                    
                    # Calculate memory percentage
                    memory_usage = stats['memory_stats'].get('usage', 0)
                    memory_limit = stats['memory_stats'].get('limit', 1)
                    memory_percent = (memory_usage / memory_limit) * 100.0 if memory_limit > 0 else 0.0
                    
                    container_metric = ContainerMetric(
                        container_id=container.id[:12],
                        container_name=container.name,
                        cpu_percent=round(cpu_percent, 2),
                        memory_percent=round(memory_percent, 2),
                        memory_used_mb=memory_usage / (1024 * 1024),
                        memory_limit_mb=memory_limit / (1024 * 1024)
                    )
                    db.add(container_metric)
                    
                except Exception as e:
                    logger.error(f"Error collecting metrics for container {container.name}: {e}")
                    continue
            
            db.commit()
            logger.info(f"Container metrics collected for {len(containers)} containers")
        except Exception as e:
            logger.error(f"Error collecting container metrics: {e}")
            db.rollback()
    
    def cleanup_old_data(self, db: Session):
        """Remove data older than retention period"""
        try:
            cutoff_date = datetime.utcnow() - timedelta(days=settings.data_retention_days)
            
            deleted_host = db.query(HostMetric).filter(HostMetric.timestamp < cutoff_date).delete()
            deleted_container = db.query(ContainerMetric).filter(ContainerMetric.timestamp < cutoff_date).delete()
            
            db.commit()
            
            if deleted_host > 0 or deleted_container > 0:
                logger.info(f"Cleaned up old data: {deleted_host} host metrics, {deleted_container} container metrics")
        except Exception as e:
            logger.error(f"Error cleaning up old data: {e}")
            db.rollback()
    
    def run_collection_loop(self):
        """Main collection loop running in separate thread"""
        logger.info(f"Starting metrics collection loop (interval: {settings.collection_interval}s)")
        
        # Initialize database
        init_db()
        
        while True:
            try:
                db = SessionLocal()
                
                # Collect metrics
                self.collect_host_metrics(db)
                self.collect_container_metrics(db)
                
                # Cleanup old data (every 100 iterations)
                if int(time.time()) % (settings.collection_interval * 100) == 0:
                    self.cleanup_old_data(db)
                
                db.close()
                
            except Exception as e:
                logger.error(f"Error in collection loop: {e}")
            
            time.sleep(settings.collection_interval)

def start_collector():
    """Start the metrics collector in a background thread"""
    collector = MetricsCollector()
    thread = threading.Thread(target=collector.run_collection_loop, daemon=True)
    thread.start()
    logger.info("Metrics collector thread started")
