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
    recipe_id VARCHAR(100) NOT NULL,
    recipe_title VARCHAR(255) NOT NULL,
    image_url VARCHAR(500),
    notes TEXT,
    meal_type VARCHAR(100),
    diet_type VARCHAR(100),
    source VARCHAR(20) NOT NULL DEFAULT 'spoonacular',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),

    -- Foreign key linking to users table
    CONSTRAINT fk_favorites_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE,

    -- Prevent duplicate favorites for same user + recipe
    UNIQUE KEY unique_user_recipe_favorite (user_id, recipe_id)
);


-- =========================================
-- RATINGS TABLE
-- Stores user ratings for recipes (1–5)
-- =========================================

CREATE TABLE IF NOT EXISTS ratings (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id INT UNSIGNED NOT NULL,
    recipe_id VARCHAR(100) NOT NULL,
    rating_value TINYINT UNSIGNED NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),

    -- Foreign key linking to users table
    CONSTRAINT fk_ratings_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE,

    -- Ensure rating is between 1 and 5
    CONSTRAINT chk_rating_value
        CHECK (rating_value BETWEEN 1 AND 5),

    -- One rating per user per recipe
    UNIQUE KEY unique_user_recipe_rating (user_id, recipe_id)
);


-- =========================================
-- SEARCH PREFERENCES TABLE
-- Stores saved user filter preferences
-- =========================================

CREATE TABLE IF NOT EXISTS search_preferences (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id INT UNSIGNED NOT NULL,
    preferred_meal_type VARCHAR(100),
    preferred_diet VARCHAR(100),
    favorite_cuisine VARCHAR(100),
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),

    -- Foreign key linking to users table
    CONSTRAINT fk_preferences_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE,

    -- Each user has only one preferences row
    UNIQUE KEY unique_user_preferences (user_id)
);


-- =========================================
-- SAMPLE DATA (OPTIONAL FOR TESTING)
-- =========================================

-- Insert a demo user (password is just placeholder)
INSERT INTO users (username, password_hash)
VALUES
    ('demo_user', '$2b$10$examplehashedpasswordstring');

-- Insert sample favorites
INSERT INTO favorites (user_id, recipe_id, recipe_title, image_url, notes, meal_type, diet_type, source)
VALUES
    (1, '716429', 'Pasta with Garlic, Scallions, Cauliflower & Breadcrumbs', 'https://img.spoonacular.com/recipes/716429-312x231.jpg', 'Try with extra garlic next time', 'Dinner', 'Vegetarian', 'spoonacular'),
    (1, '52772', 'Teriyaki Chicken Casserole', 'https://www.themealdb.com/images/media/meals/wvpsxx1468256321.jpg', 'Good for meal prep', 'Dinner', 'High Protein', 'mealdb');

-- Insert sample ratings
INSERT INTO ratings (user_id, recipe_id, rating_value)
VALUES
    (1, '716429', 5),
    (1, '52772', 4);

-- Insert sample preferences
INSERT INTO search_preferences (user_id, preferred_meal_type, preferred_diet, favorite_cuisine)
VALUES
    (1, 'Dinner', 'Vegetarian', 'Italian');
