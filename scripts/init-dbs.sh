#!/bin/bash
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
    CREATE DATABASE declitech_reports;
    CREATE DATABASE declitech_sessions;
    CREATE DATABASE declitech_modules;
    CREATE DATABASE declitech_auth;
EOSQL
