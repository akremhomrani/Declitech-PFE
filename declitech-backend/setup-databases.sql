-- Run this once as the postgres superuser to create all service databases
-- Usage: psql -U postgres -f setup-databases.sql

CREATE DATABASE declitech_reports;
CREATE DATABASE declitech_sessions;
-- declitech_modules DROPPED: modules are managed in IAM (external source of truth)
