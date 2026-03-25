# Go Runner - TestCraft AI
FROM golang:1.22-alpine

LABEL maintainer="TestCraft AI"
LABEL description="Go code runner for TestCraft AI"

# Install necessary tools
RUN apk add --no-cache bash curl jq git

# Create working directory
WORKDIR /app

# Create non-root user for security
RUN addgroup -S testcraft && adduser -S runner -G testcraft
RUN mkdir -p /app/code /app/output /go/pkg && \
    chown -R runner:testcraft /app /go

# Pre-download common Go modules
COPY go.mod go.sum /app/deps/
RUN cd /app/deps && go mod download

# Copy runner script
COPY runner.sh /app/runner.sh
RUN chmod +x /app/runner.sh

USER runner

# Environment variables
ENV GOPROXY=https://proxy.golang.org,direct
ENV CODE_DIR=/app/code
ENV OUTPUT_DIR=/app/output

ENTRYPOINT ["/app/runner.sh"]
