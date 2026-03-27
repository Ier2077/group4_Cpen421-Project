FROM python:3.12-slim
WORKDIR /app
COPY shared/ /app/shared/
COPY services/incident_service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY services/incident_service/ .
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8002}