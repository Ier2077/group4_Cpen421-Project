from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://erp_user:erp_pass@analytics_db:5432/analytics_db"
    JWT_SECRET: str = "changeme"
    JWT_ALGORITHM: str = "HS256"
    RABBITMQ_URL: str | None = None
    RABBITMQ_USER: str = "guest"
    RABBITMQ_PASS: str = "guest"
    RABBITMQ_HOST: str = "rabbitmq"
    RABBITMQ_PORT: int = 5672
    PORT: int = 8004

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()