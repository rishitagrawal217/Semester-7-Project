# Slim image: the proxy only needs httpx (no scikit-learn / model) - it asks the
# ml-service API for every verdict.
FROM python:3.12-slim

WORKDIR /app

RUN pip install --no-cache-dir httpx

COPY server.py .

# Unbuffered so the proxy's log lines show up in `docker compose logs` immediately.
ENV PYTHONUNBUFFERED=1

EXPOSE 8081

CMD ["python", "server.py"]
