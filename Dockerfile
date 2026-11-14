# Backend Laravel NAIK untuk Render (Docker). Konteks build = root repo.
FROM php:8.3-cli

RUN apt-get update \
    && apt-get install -y --no-install-recommends libpq-dev unzip git \
    && docker-php-ext-install pdo_pgsql \
    && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /app
COPY backend/ .

RUN composer install --no-dev --optimize-autoloader --no-interaction --no-progress \
    && mkdir -p storage/framework/cache/data storage/framework/sessions storage/framework/views storage/logs bootstrap/cache

# Render mengisi $PORT. PHP_CLI_SERVER_WORKERS = beberapa proses sekaligus, jadi request tidak antre satu-satu.
ENV PHP_CLI_SERVER_WORKERS=4
EXPOSE 10000

# config:cache dijalankan saat start (bukan saat build) supaya membaca environment variable Render.
# server.php Laravel memakai folder kerja sebagai public, jadi pindah dulu ke public/.
CMD ["sh", "-c", "php artisan config:cache && cd public && exec php -S 0.0.0.0:${PORT:-10000} -t . ../vendor/laravel/framework/src/Illuminate/Foundation/resources/server.php"]
