from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List
import os
from dotenv import load_dotenv

# Ensure environment variables from .env are injected into os.environ
# so that libraries like LangChain and LangSmith can pick them up.
load_dotenv("../.env")
class Settings(BaseSettings):
    PROJECT_NAME: str = "Support Agent API"
    DATABASE_URL: str
    OPENAI_API_KEY: str = ""
    OPENROUTER_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""
    GOOGLE_API_KEY: str = ""
    GROQ_API_KEY: str = ""
    DEEPSEEK_API_KEY: str = ""
    OPENAI_API_BASE: str = ""
    REDIS_URL: str
    SECRET_KEY: str = "default_secret_key_change_in_production"
    
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
