# TypeScript Runner - TestCraft AI
FROM node:22-alpine

LABEL maintainer="TestCraft AI"
LABEL description="TypeScript code runner for TestCraft AI"

# Install necessary tools
RUN apk add --no-cache bash curl jq

# Create working directory
WORKDIR /app

# Create non-root user for security
RUN addgroup -S testcraft && adduser -S runner -G testcraft
RUN mkdir -p /app/code /app/output /app/node_modules && \
    chown -R runner:testcraft /app

# Install TypeScript and dependencies
COPY package.json /app/package.json
COPY tsconfig.json /app/tsconfig.json
RUN npm install && \
    chown -R runner:testcraft /app/node_modules

# Copy runner script
COPY runner.sh /app/runner.sh
RUN chmod +x /app/runner.sh

USER runner

# Environment variables
ENV NODE_ENV=production
ENV CODE_DIR=/app/code
ENV OUTPUT_DIR=/app/output
ENV NODE_PATH=/app/node_modules

ENTRYPOINT ["/app/runner.sh"]
