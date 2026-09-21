FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY apps/api/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY apps/api/procureai_api ./procureai_api
COPY data ./data
COPY infra ./infra
COPY scripts ./scripts
RUN python scripts/init_local_data.py

EXPOSE 8000
CMD ["uvicorn", "procureai_api.main:app", "--host", "0.0.0.0", "--port", "8000"]
