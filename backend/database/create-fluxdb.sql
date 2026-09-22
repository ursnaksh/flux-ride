-- Run using a MySQL administrator if the application account cannot create databases.
CREATE DATABASE IF NOT EXISTS fluxdb
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- Configure a local MySQL user and grant access to fluxdb separately.
-- Keep its password outside this repository; supply DB_PASSWORD when starting the app.
-- Hibernate creates/updates users, rides, pools and pool_members on startup.
