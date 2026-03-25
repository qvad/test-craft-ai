# Kotlin Runner - TestCraft AI
FROM eclipse-temurin:21-jdk-alpine

LABEL maintainer="TestCraft AI"
LABEL description="Kotlin code runner for TestCraft AI"

# Install Kotlin compiler and tools
RUN apk add --no-cache bash curl jq unzip && \
    curl -L https://github.com/JetBrains/kotlin/releases/download/v1.9.22/kotlin-compiler-1.9.22.zip -o kotlin.zip && \
    unzip kotlin.zip -d /opt && \
    rm kotlin.zip && \
    ln -s /opt/kotlinc/bin/kotlin /usr/local/bin/kotlin && \
    ln -s /opt/kotlinc/bin/kotlinc /usr/local/bin/kotlinc

# Create working directory
WORKDIR /app

# Create non-root user for security
RUN addgroup -S testcraft && adduser -S runner -G testcraft
RUN mkdir -p /app/code /app/output /app/libs && \
    chown -R runner:testcraft /app

# Copy common libraries (same as Java)
COPY libs/ /app/libs/

# Copy runner script
COPY runner.sh /app/runner.sh
RUN chmod +x /app/runner.sh

USER runner

# Environment variables
ENV JAVA_OPTS="-Xmx512m -Xms256m"
ENV CODE_DIR=/app/code
ENV OUTPUT_DIR=/app/output

ENTRYPOINT ["/app/runner.sh"]
