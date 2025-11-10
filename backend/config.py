from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    backend_host: str = "0.0.0.0"
    backend_port: int = 8000
    database_url: str = "sqlite:///./docker_metrics.db"
    collection_interval: int = 30
    data_retention_days: int = 30
    cors_origins: str = "http://localhost:5173,http://localhost:3000"
    
    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.cors_origins.split(",")]
    
    class Config:
        env_file = "../.env"
        case_sensitive = False

settings = Settings()
