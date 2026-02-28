FROM python:3.12-slim

WORKDIR /app

# Install dependencies first for better layer caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy agent source
COPY agent.py tools.py tenant_config.py call_logger.py ./

CMD ["python", "agent.py", "start"]
