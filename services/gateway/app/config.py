from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    AUTH_SERVICE_URL: str = "http://auth_service:8001"
    INCIDENT_SERVICE_URL: str = "http://incident_service:8002"
    DISPATCH_SERVICE_URL: str = "http://dispatch_service:8003"
    ANALYTICS_SERVICE_URL: str = "http://analytics_service:8004"

    ALLOWED_ORIGINS: str = "*"  # comma-separated in production
    PORT: int = 8000

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
