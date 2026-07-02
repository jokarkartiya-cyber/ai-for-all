FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    nodejs \
    npm \
    git \
    && rm -rf /var/lib/apt/lists/*
RUN useradd -m -u 1000 sandbox
USER sandbox
WORKDIR /workspace
