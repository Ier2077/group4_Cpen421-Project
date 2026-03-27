from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://erp_user:erp_pass@dispatch_db:5432/dispatch_db"
    JWT_SECRET: str = "changeme"
    JWT_ALGORITHM: str = "HS256"
    REDIS_URL: str = "redis://redis:6379/0"
    RABBITMQ_URL: str | None = None
    RABBITMQ_USER: str = "guest"
    RABBITMQ_PASS: str = "guest"
    RABBITMQ_HOST: str = "rabbitmq"
    RABBITMQ_PORT: int = 5672
    PORT: int = 8003

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()