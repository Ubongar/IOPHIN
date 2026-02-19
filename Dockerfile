FROM python:3.11-slim
WORKDIR /app
RUN apt-get update && apt-get install -y libgdal-dev gcc g++ && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY src/ ./src/
COPY data/ ./data/
COPY gee/ ./gee/
COPY .env .
CMD ["python", "src/scheduler_service.py"]
