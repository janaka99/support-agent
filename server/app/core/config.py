from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List

class Settings(BaseSettings):
    PROJECT_NAME: str = "Support Agent API"
    DATABASE_URL: str
    OPENAI_API_KEY: str
    REDIS_URL: str
    
    # Comma-separated list of CORS origins
    CORS_ORIGINS: str = ""

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    @property
    def async_database_url(self) -> str:
        if self.DATABASE_URL.startswith("postgresql://"):
            return self.DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)
        return self.DATABASE_URL

    # In Docker, env vars are injected directly. 
    # This env_file helps when running locally without docker.
    model_config = SettingsConfigDict(env_file="../.env", extra="ignore")

settings = Settings()
