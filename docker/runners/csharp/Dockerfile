# C# Runner - TestCraft AI
FROM mcr.microsoft.com/dotnet/sdk:8.0-alpine

LABEL maintainer="TestCraft AI"
LABEL description="C# code runner for TestCraft AI"

# Install necessary tools
RUN apk add --no-cache bash curl jq

# Create working directory
WORKDIR /app

# Create non-root user for security
RUN addgroup -S testcraft && adduser -S runner -G testcraft
RUN mkdir -p /app/code /app/output && \
    chown -R runner:testcraft /app

# Create a template project with common dependencies
COPY template.csproj /app/template/template.csproj
RUN cd /app/template && dotnet restore

# Copy runner script
COPY runner.sh /app/runner.sh
RUN chmod +x /app/runner.sh

USER runner

# Environment variables
ENV DOTNET_CLI_TELEMETRY_OPTOUT=1
ENV DOTNET_NOLOGO=true
ENV CODE_DIR=/app/code
ENV OUTPUT_DIR=/app/output

ENTRYPOINT ["/app/runner.sh"]
