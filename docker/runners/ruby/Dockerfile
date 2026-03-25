# Ruby Runner - TestCraft AI
FROM ruby:3.3-alpine

LABEL maintainer="TestCraft AI"
LABEL description="Ruby code runner for TestCraft AI"

# Install necessary tools
RUN apk add --no-cache bash curl jq build-base postgresql-dev mysql-dev

# Create working directory
WORKDIR /app

# Create non-root user for security
RUN addgroup -S testcraft && adduser -S runner -G testcraft
RUN mkdir -p /app/code /app/output && \
    chown -R runner:testcraft /app

# Install common gems
COPY Gemfile /app/Gemfile
RUN bundle install

# Copy runner script
COPY runner.sh /app/runner.sh
RUN chmod +x /app/runner.sh

USER runner

# Environment variables
ENV CODE_DIR=/app/code
ENV OUTPUT_DIR=/app/output

ENTRYPOINT ["/app/runner.sh"]
