# Java Runner - TestCraft AI
FROM eclipse-temurin:21-jdk-alpine

LABEL maintainer="TestCraft AI"
LABEL description="Java code runner for TestCraft AI"

# Install necessary tools
RUN apk add --no-cache bash curl jq

# Create working directory
WORKDIR /app

# Create non-root user for security
RUN addgroup -S testcraft && adduser -S runner -G testcraft
RUN mkdir -p /app/code /app/output /app/libs && \
    chown -R runner:testcraft /app

# Pre-install common dependencies
COPY dependencies/pom.xml /app/dependencies/pom.xml
RUN --mount=type=cache,target=/root/.m2 \
    cd /app/dependencies && \
    if [ -f pom.xml ]; then \
        apk add --no-cache maven && \
        mvn dependency:go-offline -B && \
        apk del maven; \
    fi || true

# Copy runner script
COPY runner.sh /app/runner.sh
RUN chmod +x /app/runner.sh

USER runner

# Environment variables
ENV JAVA_OPTS="-Xmx512m -Xms256m"
ENV CODE_DIR=/app/code
ENV OUTPUT_DIR=/app/output

ENTRYPOINT ["/app/runner.sh"]
