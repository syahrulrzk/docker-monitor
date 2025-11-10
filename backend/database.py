from sqlalchemy import create_engine, Column, Integer, Float, String, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
from config import settings

Base = declarative_base()

class HostMetric(Base):
    __tablename__ = "host_metrics"
    
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    cpu_percent = Column(Float)
    memory_percent = Column(Float)
    memory_used_mb = Column(Float)
    memory_total_mb = Column(Float)
    disk_read_kb = Column(Float, default=0.0)
    disk_write_mb = Column(Float, default=0.0)
    network_in_mbit = Column(Float, default=0.0)
    network_out_mbit = Column(Float, default=0.0)

class ContainerMetric(Base):
    __tablename__ = "container_metrics"
    
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    container_id = Column(String, index=True)
    container_name = Column(String)
    cpu_percent = Column(Float)
    memory_percent = Column(Float)
    memory_used_mb = Column(Float)
    memory_limit_mb = Column(Float)
    disk_read_kb = Column(Float, default=0.0)
    disk_write_mb = Column(Float, default=0.0)
    network_in_mbit = Column(Float, default=0.0)
    network_out_mbit = Column(Float, default=0.0)

# Database setup
engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False} if "sqlite" in settings.database_url else {}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def init_db():
    Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
