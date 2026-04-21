DROP TABLE IF EXISTS ratings;
DROP TABLE IF EXISTS favorites;
DROP TABLE IF EXISTS search_preferences;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    username VARCHAR(50) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY unique_username (username)
);

CREATE TABLE favorites (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_name VARCHAR(50) NOT NULL,
    recipe_id VARCHAR(50) NOT NULL,
    recipe_title VARCHAR(255) NOT NULL,
    image_url VARCHAR(500),
    notes TEXT,
    meal_type VARCHAR(100),
    diet_type VARCHAR(100),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY unique_user_recipe (user_name, recipe_id)
);

CREATE TABLE ratings (
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

CREATE TABLE search_preferences (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_name VARCHAR(50) NOT NULL,
    preferred_meal_type VARCHAR(100),
    preferred_diet VARCHAR(100),
    favorite_cuisine VARCHAR(100),
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY unique_user_preferences (user_name)
);

/* Optional starter rows for testing after you register real users
INSERT INTO favorites (user_name, recipe_id, recipe_title, image_url, notes, meal_type, diet_type)
VALUES
('testuser', '1001', 'Veggie Pasta', '/img/placeholder.jpg', 'Try with garlic bread', 'Dinner', 'Vegetarian');

INSERT INTO ratings (user_id, recipe_id, rating_value)
VALUES
(1, '1001', 5);

INSERT INTO search_preferences (user_name, preferred_meal_type, preferred_diet, favorite_cuisine)
VALUES
('testuser', 'Dinner', 'Vegetarian', 'Italian');
*/
