-- =========================================
-- DATABASE SETUP
-- =========================================

CREATE DATABASE IF NOT EXISTS pantrywizard;
USE pantrywizard;


-- =========================================
-- USERS TABLE
-- Stores user login information
-- =========================================

CREATE TABLE IF NOT EXISTS users (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    username VARCHAR(50) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY unique_username (username)
);


-- =========================================
-- FAVORITES TABLE
-- Stores recipes saved by users, including notes
-- =========================================

CREATE TABLE IF NOT EXISTS favorites (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id INT UNSIGNED NOT NULL,
    recipe_id VARCHAR(50) NOT NULL,
    recipe_title VARCHAR(255) NOT NULL,
    image_url VARCHAR(500),
    notes TEXT,
    meal_type VARCHAR(100),
    diet_type VARCHAR(100),
    source VARCHAR(20) NOT NULL DEFAULT 'spoonacular',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY unique_user_recipe (user_id, recipe_id)
);


-- =========================================
-- RATINGS TABLE
-- Stores user ratings for recipes (1–5)
-- =========================================

CREATE TABLE IF NOT EXISTS ratings (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id INT UNSIGNED NOT NULL,
    recipe_id VARCHAR(50) NOT NULL,
    rating_value TINYINT UNSIGNED NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY unique_user_recipe_rating (user_id, recipe_id),
    CONSTRAINT chk_rating_value CHECK (rating_value BETWEEN 1 AND 5)
);


-- =========================================
-- API CACHE TABLE
-- Caches API responses to reduce redundant calls and improve performance
-- =========================================

CREATE TABLE IF NOT EXISTS api_cache (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    cache_key VARCHAR(255) NOT NULL,
    cache_type VARCHAR(50) NOT NULL,
    payload_json LONGTEXT NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY unique_cache_key (cache_key)
);


-- =========================================
-- USER SESSIONS TABLE
-- Stores session data for logged-in users
-- =========================================

CREATE TABLE IF NOT EXISTS user_sessions (
    session_id VARCHAR(128) NOT NULL,
    session_data LONGTEXT NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (session_id),
    KEY idx_user_sessions_expires_at (expires_at)
);
