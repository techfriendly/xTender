FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY apps/embedding_api/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY apps/embedding_api/embedding_api ./embedding_api

EXPOSE 8010
CMD ["uvicorn", "embedding_api.main:app", "--host", "0.0.0.0", "--port", "8010"]
