# Rust Runner - TestCraft AI
FROM rust:1.76-alpine

LABEL maintainer="TestCraft AI"
LABEL description="Rust code runner for TestCraft AI"

# Install necessary tools
RUN apk add --no-cache bash curl jq musl-dev openssl-dev

# Create working directory
WORKDIR /app

# Create non-root user for security
RUN addgroup -S testcraft && adduser -S runner -G testcraft
RUN mkdir -p /app/code /app/output && \
    chown -R runner:testcraft /app

# Pre-compile common dependencies
COPY Cargo.toml /app/template/Cargo.toml
COPY src/lib.rs /app/template/src/lib.rs
RUN cd /app/template && cargo build --release 2>/dev/null || true

# Copy runner script
COPY runner.sh /app/runner.sh
RUN chmod +x /app/runner.sh

USER runner

# Environment variables
ENV CARGO_HOME=/app/.cargo
ENV CODE_DIR=/app/code
ENV OUTPUT_DIR=/app/output

ENTRYPOINT ["/app/runner.sh"]
