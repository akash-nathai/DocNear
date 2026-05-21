-- Run once on first postgres container start.
-- The postgis/postgis image already has PostGIS installed;
-- this script ensures pgcrypto and uuid-ossp are also available.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
-- PostGIS already enabled by the base image; enable here for completeness
CREATE EXTENSION IF NOT EXISTS postgis;
