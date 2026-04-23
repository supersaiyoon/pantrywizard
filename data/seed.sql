USE pantrywizard;

-- =========================================
-- OPTIONAL SAMPLE DATA
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
