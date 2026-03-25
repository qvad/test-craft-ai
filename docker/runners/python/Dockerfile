# Python Runner - TestCraft AI
FROM python:3.12-slim

LABEL maintainer="TestCraft AI"
LABEL description="Python code runner for TestCraft AI"

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    jq \
    && rm -rf /var/lib/apt/lists/*

# Create working directory
WORKDIR /app

# Create non-root user for security
RUN groupadd -r testcraft && useradd -r -g testcraft runner
RUN mkdir -p /app/code /app/output && \
    chown -R runner:testcraft /app

# Install common Python packages
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# Copy runner script
COPY runner.sh /app/runner.sh
RUN chmod +x /app/runner.sh

USER runner

# Environment variables
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV CODE_DIR=/app/code
ENV OUTPUT_DIR=/app/output

ENTRYPOINT ["/app/runner.sh"]
