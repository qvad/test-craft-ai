# PHP Runner - TestCraft AI
FROM php:8.3-cli-alpine

LABEL maintainer="TestCraft AI"
LABEL description="PHP code runner for TestCraft AI"

# Install necessary tools and PHP extensions
RUN apk add --no-cache bash curl jq git unzip \
    postgresql-dev mysql-dev libxml2-dev \
    && docker-php-ext-install pdo pdo_mysql pdo_pgsql mysqli xml

# Install Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# Create working directory
WORKDIR /app

# Create non-root user for security
RUN addgroup -S testcraft && adduser -S runner -G testcraft
RUN mkdir -p /app/code /app/output /app/vendor && \
    chown -R runner:testcraft /app

# Install common packages
COPY composer.json /app/composer.json
RUN composer install --no-dev --optimize-autoloader

# Copy runner script
COPY runner.sh /app/runner.sh
RUN chmod +x /app/runner.sh

USER runner

# Environment variables
ENV CODE_DIR=/app/code
ENV OUTPUT_DIR=/app/output

ENTRYPOINT ["/app/runner.sh"]
