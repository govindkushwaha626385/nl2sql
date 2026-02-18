-- 1. Enable Vector Support
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Create restricted user for AI (Run as Superuser)
-- Replace 'your_secure_password' with a real one
CREATE USER nl2sql_readonly WITH PASSWORD 'your_secure_password';

-- 3. Grant Permissions
GRANT CONNECT ON DATABASE matrimony_db TO nl2sql_readonly;
GRANT USAGE ON SCHEMA public TO nl2sql_readonly;

-- We grant SELECT on all tables so the AI can read data but not change it
ALTER DEFAULT PRIVILEGES IN SCHEMA public 
GRANT SELECT ON TABLES TO nl2sql_readonly;