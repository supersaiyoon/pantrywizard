// =====================
//  IMPORTS
// =====================

import express from "express";
import mysql from "mysql2/promise";
import bcrypt from "bcrypt";
import session from "express-session";
import { CUISINES, DIETS } from "./data/recipeFilters.mjs";


// =====================
// SETUP & CONFIGURATION
// =====================

const app = express();

// For render
const port = process.env.PORT || 4000;
import "dotenv/config";
import config from "./config.mjs";

app.set("view engine", "ejs");
app.use(express.static("public"));


// =====================
// API CONFIGURATION
// =====================

// API keys
const spoonacularApiKey = process.env.SPOONACULAR_API_KEY;
const theMealDbApiKey = process.env.THEMEALDB_API_KEY || "1";
const sessionSecret = process.env.SESSION_SECRET;
const saltRounds = 10;

if (!sessionSecret) {
    throw new Error("SESSION_SECRET is required. Add it to your .env file before starting the server.");
}

// API base URLs
const spoonacularBaseUrl = "https://api.spoonacular.com/recipes";
const theMealDbBaseUrl = `https://www.themealdb.com/api/json/v1/${theMealDbApiKey}`;

//for Express to get values using POST method
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: "lax",
        maxAge: 1000 * 60 * 60 * 24
    }
}));

app.use((req, res, next) => {
    res.locals.currentUser = req.session.username || null;
    res.locals.isAuthenticated = Boolean(req.session.userId);
    next();
});

//setting up database connection pool
const pool = mysql.createPool(config);


// =====================
// ROUTES
// =====================

// Home page
app.get("/", (req, res) => {
    res.render("index");
});

app.get("/about", (req, res) => {
    res.render("about");
});

app.get("/favorites", isAuthenticated, async (req, res) => {
    try {
        const sql = `
            SELECT *
            FROM favorites
            WHERE user_id = ?
            ORDER BY created_at DESC
        `;

        const [favorites] = await pool.query(sql, [req.session.userId]);

        res.render("favorites", { favorites });
    }
    catch (err) {
        console.error("Favorites page error:", err);
        res.status(500).send("Unable to load favorites right now.");
    }
});


// =====================
// FAVORITES PAGE (UPDATED)
// Loads favorites from database instead of static render
// =====================

app.get("/favorites", isAuthenticated, async (req, res) => {
    try {
        // Query favorites for current logged-in user
        const sql = `
            SELECT *
            FROM favorites
            WHERE user_id = ?
            ORDER BY created_at DESC
        `;

        const [favorites] = await pool.query(sql, [req.session.userId]);

        // Pass favorites data into EJS page
        res.render("favorites", { favorites });
    }
    catch (err) {
        console.error("Favorites page error:", err);
        res.status(500).send("Unable to load favorites right now.");
    }
});

// =====================
// ADD FAVORITE (NEW)
// Inserts recipe into favorites table
// =====================
app.post("/favorites/add", isAuthenticated, async (req, res) => {
    const {
        recipe_id,
        recipe_title,
        image_url,
        notes,
        meal_type,
        diet_type
    } = req.body;

    try {
        const sql = `
            INSERT INTO favorites (
                user_id,
                recipe_id,
                recipe_title,
                image_url,
                notes,
                meal_type,
                diet_type
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;

        // Insert favorite tied to logged-in user
        await pool.query(sql, [
            req.session.userId,
            recipe_id,
            recipe_title,
            image_url || "",
            notes || "",
            meal_type || "",
            diet_type || ""
        ]);

        res.redirect("/favorites");
    }
    catch (err) {
        console.error("Add favorite error:", err);
        res.status(500).send("Unable to save favorite right now.");
    }
});

// =====================
// DELETE FAVORITE (NEW)
// Removes recipe from favorites
// =====================
app.post("/favorites/delete", isAuthenticated, async (req, res) => {
    const { recipe_id } = req.body;

    try {
        const sql = `
            DELETE FROM favorites
            WHERE user_id = ? AND recipe_id = ?
        `;

        await pool.query(sql, [req.session.userId, recipe_id]);

        res.redirect("/favorites");
    }
    catch (err) {
        console.error("Delete favorite error:", err);
        res.status(500).send("Unable to delete favorite right now.");
    }
});

app.get("/recipe/:id", async (req, res) => {
    const recipeId = req.params.id;
    const source = normalizeRecipeSource(req.query.source);

    try {
        const recipe = await fetchRecipeDetails(recipeId, source);
        const averageRating = await getAverageRating(recipeId);
        let userRating = null;
        let favorite = null;

        if (req.session.username) {
            userRating = await getUserRating(req.session.username, recipeId);
            favorite = await getFavorite(req.session.username, recipeId);
        }

        res.render("recipe-detail", {
            recipe,
            averageRating,
            userRating,
            favorite,
            source
        });
    }
    catch (err) {
        console.error("Recipe detail error:", err);
        res.status(500).render("recipe-detail", {
            recipe: {
                id: recipeId,
                title: "Recipe Details",
                image: "/img/placeholder.jpg",
                ingredients: [],
                instructions: [],
                category: "N/A",
                area: "N/A",
                mealType: "",
                dietType: "",
                source: source === "mealdb" ? "TheMealDB" : "Spoonacular"
            },
            averageRating: null,
            userRating: null,
            favorite: null,
            source
        });
    }
});

app.get("/register", (req, res) => {
    if (req.session.userId) {
        return res.redirect("/search");
    }

    res.render("register", {
        errors: [],
        successMessage: "",
        formData: {
            username: ""
        }
    });
});

app.post("/register", async (req, res) => {
    let username = req.body.username || "";
    let password = req.body.password || "";
    let errors = [];

    username = username.trim().toLowerCase();

    if (username === "") {
        errors.push({ msg: "Username is required." });
    }

    if (username.length > 0 && (username.length < 3 || username.length > 50)) {
        errors.push({ msg: "Username must be between 3 and 50 characters." });
    }

    if (password === "") {
        errors.push({ msg: "Password is required." });
    }

    if (password.length > 0 && password.length < 8) {
        errors.push({ msg: "Password must be at least 8 characters long." });
    }

    if (errors.length > 0) {
        return res.status(400).render("register", {
            errors: errors,
            successMessage: "",
            formData: { username }
        });
    }

    try {
        let sql = `SELECT id
                   FROM users
                   WHERE username = ?`;

        const [rows] = await pool.query(sql, [username]);

        if (rows.length > 0) {
            return res.status(400).render("register", {
                errors: [{ msg: "That username is already taken." }],
                successMessage: "",
                formData: { username }
            });
        }

        let passwordHash = await bcrypt.hash(password, saltRounds);

        sql = `INSERT INTO users (username, password_hash)
               VALUES (?, ?)`;

        await pool.query(sql, [username, passwordHash]);

        res.status(201).render("register", {
            errors: [],
            successMessage: "Account created successfully. You can log in next.",
            formData: {
                username: ""
            }
        });
    }
    catch (err) {
        console.error("Registration error:", err);
        res.status(500).render("register", {
            errors: [{ msg: "Unable to create account right now." }],
            successMessage: "",
            formData: { username }
        });
    }
});

app.get("/login", (req, res) => {
    if (req.session.userId) {
        return res.redirect("/search");
    }

    res.render("login", {
        errors: [],
        formData: {
            username: ""
        }
    });
});

app.post("/login", async (req, res) => {
    let username = req.body.username || "";
    let password = req.body.password || "";
    let errors = [];

    username = username.trim().toLowerCase();

    if (username === "") {
        errors.push({ msg: "Username is required." });
    }

    if (password === "") {
        errors.push({ msg: "Password is required." });
    }

    if (errors.length > 0) {
        return res.status(400).render("login", {
            errors: errors,
            formData: { username }
        });
    }

    try {
        let sql = `SELECT *
                   FROM users
                   WHERE username = ?`;

        const [rows] = await pool.query(sql, [username]);

        if (rows.length === 0) {
            return res.status(401).render("login", {
                errors: [{ msg: "Invalid username or password." }],
                formData: { username }
            });
        }

        let user = rows[0];
        let match = await bcrypt.compare(password, user.password_hash);

        if (!match) {
            return res.status(401).render("login", {
                errors: [{ msg: "Invalid username or password." }],
                formData: { username }
            });
        }

        req.session.userId = user.id;
        req.session.username = user.username;

        res.redirect("/search");
    }
    catch (err) {
        console.error("Login error:", err);
        res.status(500).render("login", {
            errors: [{ msg: "Unable to log in right now." }],
            formData: { username }
        });
    }
});

app.post("/logout", (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error("Logout error:", err);
            return res.status(500).send("Unable to log out right now.");
        }

        res.clearCookie("connect.sid");
        res.redirect("/");
    });
});

app.get("/search", (req, res) => {
    res.render("search", {
        cuisines: CUISINES,
        diets: DIETS
    });
});

app.post("/favorites", isAuthenticated, async (req, res) => {
    const source = normalizeRecipeSource(req.body.source);
    const recipeId = (req.body.recipeId || "").trim();
    const recipeTitle = (req.body.recipeTitle || "").trim();
    const imageUrl = (req.body.imageUrl || "").trim();
    const notes = (req.body.notes || "").trim();
    const mealType = (req.body.mealType || "").trim();
    const dietType = (req.body.dietType || "").trim();

    if (!recipeId || !recipeTitle) {
        return res.status(400).send("Recipe id and recipe title are required.");
    }

    try {
        const sql = `INSERT INTO favorites (
                        user_name,
                        recipe_id,
                        recipe_title,
                        image_url,
                        notes,
                        meal_type,
                        diet_type
                     )
                     VALUES (?, ?, ?, ?, ?, ?, ?)
                     ON DUPLICATE KEY UPDATE
                        recipe_title = VALUES(recipe_title),
                        image_url = VALUES(image_url),
                        notes = VALUES(notes),
                        meal_type = VALUES(meal_type),
                        diet_type = VALUES(diet_type),
                        updated_at = CURRENT_TIMESTAMP`;

        await pool.query(sql, [
            req.session.username,
            recipeId,
            recipeTitle,
            imageUrl || null,
            notes || null,
            mealType || null,
            dietType || null
        ]);

        res.redirect(`/recipe/${encodeURIComponent(recipeId)}?source=${encodeURIComponent(source)}`);
    }
    catch (err) {
        console.error("Save favorite error:", err);
        res.status(500).send("Unable to save favorite right now.");
    }
});

app.post("/favorites/:recipeId/delete", isAuthenticated, async (req, res) => {
    const recipeId = req.params.recipeId;

    try {
        const sql = `DELETE FROM favorites
                     WHERE user_name = ? AND recipe_id = ?`;

        await pool.query(sql, [req.session.username, recipeId]);
        res.redirect("/favorites");
    }
    catch (err) {
        console.error("Delete favorite error:", err);
        res.status(500).send("Unable to remove favorite right now.");
    }
});

app.post("/ratings", isAuthenticated, async (req, res) => {
    const source = normalizeRecipeSource(req.body.source);
    const recipeId = (req.body.recipeId || "").trim();
    const ratingValue = Number.parseInt(req.body.ratingValue, 10);

    if (!recipeId || Number.isNaN(ratingValue) || ratingValue < 1 || ratingValue > 5) {
        return res.status(400).send("Please submit a rating between 1 and 5.");
    }

    try {
        const sql = `INSERT INTO ratings (user_name, recipe_id, rating_value)
                     VALUES (?, ?, ?)
                     ON DUPLICATE KEY UPDATE
                        rating_value = VALUES(rating_value),
                        updated_at = CURRENT_TIMESTAMP`;

        await pool.query(sql, [req.session.username, recipeId, ratingValue]);
        res.redirect(`/recipe/${encodeURIComponent(recipeId)}?source=${encodeURIComponent(source)}`);
    }
    catch (err) {
        console.error("Rating error:", err);
        res.status(500).send("Unable to save rating right now.");
    }
});

// =====================
// API ENDPOINTS
// =====================

app.get("/api/search/ingredients", async (req, res) => {
    const ingredients = req.query.ingredients?.trim();
    const cuisine = req.query.cuisine?.trim();
    const diet = req.query.diet?.trim();

    if (!ingredients) {
        return res.status(400).json({
            error: "Please enter at least one ingredient."
        });
    }

    try {
        // Clean and format ingredients list from raw input
        let ingredientArr = ingredients.split(",");
        let cleanedArr = [];

        for (let ingredient of ingredientArr) {
            ingredient = ingredient.trim();

            if (ingredient !== "") {
                cleanedArr.push(ingredient);
            }
        }

        const cleanedIngredients = cleanedArr.join(",");
        const isSingleIngredientSearch = cleanedArr.length === 1;


        const apiUrl = new URL(`${spoonacularBaseUrl}/complexSearch`);
        apiUrl.searchParams.set("apiKey", spoonacularApiKey);
        apiUrl.searchParams.set("includeIngredients", cleanedIngredients);
        apiUrl.searchParams.set("number", "10");
        apiUrl.searchParams.set("sort", "max-used-ingredients");
        apiUrl.searchParams.set("ignorePantry", "true");
        apiUrl.searchParams.set("fillIngredients", "true");
        apiUrl.searchParams.set("addRecipeInformation", "true");
        apiUrl.searchParams.set("addRecipeInstructions", "true");
        apiUrl.searchParams.set("instructionsRequired", "true");

        // Optional search criteria
        if (cuisine) {
            apiUrl.searchParams.set("cuisine", cuisine);
        }

        if (diet) {
            apiUrl.searchParams.set("diet", diet);
        }

        const response = await fetch(apiUrl);

        // Max 50 points per day for free tier, so display quota info
        const quotaRequest = response.headers.get("X-API-Quota-Request");
        const quotaLeft = response.headers.get("X-API-Quota-Left");

        console.log("Spoonacular quota request:", quotaRequest);
        console.log("Spoonacular quota left:", quotaLeft);

        if (!response.ok) {
            return res.status(response.status).json({error: "Failed to fetch recipes based on ingredients."});
        }

        const data = await response.json();

        const results = data.results || [];
        const recipes = [];

        for (let recipe of results) {
            let usedIngredients = recipe.usedIngredients || [];
            let missedIngredients = recipe.missedIngredients || [];
            let analyzedInstructions = recipe.analyzedInstructions || [];

            let usedIngredientCount = recipe.usedIngredientCount;
            if (usedIngredientCount == null) {
                usedIngredientCount = usedIngredients.length;
            }

            let missedIngredientCount = recipe.missedIngredientCount;
            if (missedIngredientCount == null) {
                missedIngredientCount = missedIngredients.length;
            }

            let newRecipe = {
                ...recipe,
                source: "Spoonacular",
                sourceKey: "spoonacular",
                sourceDetails: "Matches your pantry ingredients and applies cuisine/diet filters.",
                filtersApplied: true,
                usedIngredients: usedIngredients,
                missedIngredients: missedIngredients,
                analyzedInstructions: analyzedInstructions,
                usedIngredientCount: usedIngredientCount,
                missedIngredientCount: missedIngredientCount
            };

            recipes.push(newRecipe);
        }

        if (isSingleIngredientSearch) {
            // TheMealDB only supports ingredient filtering cleanly for a single ingredient,
            // so merge those matches into response only for that case.
            const mealDbRecipes = await fetchMealDbRecipesByIngredient(cleanedArr[0], {
                hasFilters: Boolean(cuisine || diet)
            });

            recipes.push(...mealDbRecipes);
        }

        res.send(recipes);
    }
    catch (err) {
        console.error("Ingredient search error:", err);
        res.status(500).json({error: "Failed to fetch recipes."});
    }
});


// Test database connection
app.get("/dbTest", async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT CURDATE()");
        res.send(rows);
    }
    catch (err) {
        console.error("Database error:", err);
        res.status(500).send("Database error");
    }
});

initializeDatabase()
    .then(() => {
        app.listen(port, () => {
            console.log(`Server listening on port http://localhost:${port}`);
        });
    })
    .catch((err) => {
        console.error("Database initialization error:", err);
        process.exit(1);
    });

async function initializeDatabase() {
    await createUsersTable();
    await createFavoritesTable();
    await createRatingsTable();
}

async function createUsersTable() {
    let sql = `CREATE TABLE IF NOT EXISTS users (
                   id INT UNSIGNED NOT NULL AUTO_INCREMENT,
                   username VARCHAR(50) NOT NULL,
                   password_hash VARCHAR(255) NOT NULL,
                   created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                   PRIMARY KEY (id),
                   UNIQUE KEY unique_username (username)
               )`;

    try {
        await pool.query(sql);
        console.log("Users table is ready.");
    }
    catch (err) {
        console.error("Error creating users table:", err);
    }
}

async function createFavoritesTable() {
    const sql = `CREATE TABLE IF NOT EXISTS favorites (
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
                 )`;

    try {
        await pool.query(sql);
        console.log("Favorites table is ready.");
    }
    catch (err) {
        console.error("Error creating favorites table:", err);
        throw err;
    }
}

async function createRatingsTable() {
    const sql = `CREATE TABLE IF NOT EXISTS ratings (
                     id INT UNSIGNED NOT NULL AUTO_INCREMENT,
                     user_name VARCHAR(50) NOT NULL,
                     recipe_id VARCHAR(50) NOT NULL,
                     rating_value TINYINT UNSIGNED NOT NULL,
                     created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                     updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                     PRIMARY KEY (id),
                     UNIQUE KEY unique_user_recipe_rating (user_name, recipe_id),
                     CONSTRAINT chk_rating_value CHECK (rating_value BETWEEN 1 AND 5)
                 )`;

    try {
        await pool.query(sql);
        console.log("Ratings table is ready.");
    }
    catch (err) {
        console.error("Error creating ratings table:", err);
        throw err;
    }
}

async function fetchMealDbRecipesByIngredient(ingredient, options = {}) {
    const { hasFilters = false } = options;
    const searchUrl = new URL(`${theMealDbBaseUrl}/filter.php`);
    searchUrl.searchParams.set("i", ingredient);

    try {
        const response = await fetch(searchUrl);

        if (!response.ok) {
            console.error("TheMealDB ingredient search failed:", response.status);
            return [];
        }

        const data = await response.json();
        const meals = data.meals || [];

        if (meals.length === 0) {
            return [];
        }

        const detailedMeals = await Promise.all(
            meals.slice(0, 10).map((meal) => fetchMealDbRecipeDetails(meal.idMeal))
        );

        return detailedMeals
            .filter(Boolean)
            .map((meal) => normalizeMealDbRecipe(meal, hasFilters));
    }
    catch (err) {
        console.error("TheMealDB ingredient search error:", err);
        return [];
    }
}

async function fetchMealDbRecipeDetails(mealId) {
    const lookupUrl = new URL(`${theMealDbBaseUrl}/lookup.php`);
    lookupUrl.searchParams.set("i", mealId);

    try {
        const response = await fetch(lookupUrl);

        if (!response.ok) {
            console.error("TheMealDB lookup failed for meal:", mealId, response.status);
            return null;
        }

        const data = await response.json();
        return data.meals?.[0] || null;
    }
    catch (err) {
        console.error("TheMealDB lookup error for meal:", mealId, err);
        return null;
    }
}

function normalizeMealDbRecipe(meal, hasFilters) {
    const instructions = meal.strInstructions?.trim() || "";
    // TheMealDB returns inconsistent instruction formatting, so try to clean it up.
    const parsedSteps = parseMealDbInstructions(instructions);
    const steps = parsedSteps.map((step) => ({ step }));

    return {
        id: meal.idMeal,
        title: meal.strMeal,
        image: meal.strMealThumb,
        source: "TheMealDB",
        sourceKey: "mealdb",
        sourceDetails: hasFilters
            ? "Single-ingredient match from TheMealDB. Cuisine and diet filters do not apply."
            : "Single-ingredient match from TheMealDB.",
        filtersApplied: false,
        category: meal.strCategory || null,
        area: meal.strArea || null,
        usedIngredients: [],
        ingredients: extractMealDbIngredients(meal),
        mealType: meal.strCategory || "",
        dietType: "",
        missedIngredients: [],
        usedIngredientCount: null,
        missedIngredientCount: null,
        analyzedInstructions: steps.length > 0 ? [{ steps }] : [],
        instructionsText: instructions
    };
}

async function fetchRecipeDetails(recipeId, source) {
    if (source === "mealdb") {
        const meal = await fetchMealDbRecipeDetails(recipeId);

        if (!meal) {
            throw new Error("Recipe not found in TheMealDB.");
        }

        const normalizedMeal = normalizeMealDbRecipe(meal, false);
        return {
            id: normalizedMeal.id,
            title: normalizedMeal.title,
            image: normalizedMeal.image || "/img/placeholder.jpg",
            ingredients: normalizedMeal.ingredients || [],
            instructions: convertInstructionsToText(normalizedMeal.analyzedInstructions, normalizedMeal.instructionsText),
            category: normalizedMeal.category || "N/A",
            area: normalizedMeal.area || "N/A",
            mealType: normalizedMeal.mealType || "",
            dietType: normalizedMeal.dietType || "",
            source: normalizedMeal.source
        };
    }

    const detailUrl = new URL(`${spoonacularBaseUrl}/${recipeId}/information`);
    detailUrl.searchParams.set("apiKey", spoonacularApiKey);
    detailUrl.searchParams.set("includeNutrition", "false");

    const response = await fetch(detailUrl);

    if (!response.ok) {
        throw new Error(`Spoonacular detail lookup failed for recipe ${recipeId}.`);
    }

    const recipe = await response.json();

    return {
        id: recipe.id,
        title: recipe.title,
        image: recipe.image || "/img/placeholder.jpg",
        ingredients: (recipe.extendedIngredients || []).map((ingredient) => ingredient.original),
        instructions: convertInstructionsToText(recipe.analyzedInstructions, recipe.instructions),
        category: recipe.dishTypes?.[0] || recipe.category || "N/A",
        area: recipe.cuisines?.[0] || "N/A",
        mealType: recipe.dishTypes?.[0] || "",
        dietType: (recipe.diets || []).join(", "),
        source: "Spoonacular"
    };
}

function convertInstructionsToText(analyzedInstructions, instructionsText = "") {
    if (Array.isArray(analyzedInstructions) && analyzedInstructions.length > 0) {
        const steps = analyzedInstructions[0]?.steps || [];
        if (steps.length > 0) {
            return steps.map((step) => step.step).filter(Boolean);
        }
    }

    if (!instructionsText) {
        return [];
    }

    return instructionsText
        .split(/\r?\n+/)
        .map((step) => step.trim())
        .filter(Boolean);
}

function extractMealDbIngredients(meal) {
    const ingredients = [];

    for (let index = 1; index <= 20; index += 1) {
        const ingredient = meal[`strIngredient${index}`]?.trim();
        const measure = meal[`strMeasure${index}`]?.trim();

        if (!ingredient) {
            continue;
        }

        ingredients.push([measure, ingredient].filter(Boolean).join(" ").trim());
    }

    return ingredients;
}

async function getAverageRating(recipeId) {
    const sql = `SELECT ROUND(AVG(rating_value), 1) AS average_rating
                 FROM ratings
                 WHERE recipe_id = ?`;

    const [rows] = await pool.query(sql, [recipeId]);
    return rows[0]?.average_rating ?? null;
}

async function getUserRating(username, recipeId) {
    const sql = `SELECT rating_value
                 FROM ratings
                 WHERE user_name = ? AND recipe_id = ?`;

    const [rows] = await pool.query(sql, [username, recipeId]);
    return rows[0]?.rating_value ?? null;
}

async function getFavorite(username, recipeId) {
    const sql = `SELECT *
                 FROM favorites
                 WHERE user_name = ? AND recipe_id = ?`;

    const [rows] = await pool.query(sql, [username, recipeId]);
    return rows[0] || null;
}

function normalizeRecipeSource(source) {
    return source === "mealdb" ? "mealdb" : "spoonacular";
}

// TheMealDB cooking instructions can have inconsistent formatting, so clean it up for better display.
function parseMealDbInstructions(instructionsText) {
    if (!instructionsText) {
        return [];
    }

    let normalizedText = instructionsText
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .replace(/\t/g, " ")
        .replace(/\u00a0/g, " ")
        .trim();

    // Surface common inline step markers as individual lines before splitting.
    normalizedText = normalizedText
        .replace(/\s+(?=STEP\s*\d+\b)/gi, "\n")
        .replace(/\s+(?=Step\s*\d+\b)/g, "\n")
        .replace(/\s+(?=\d+\.\s+)/g, "\n");

    const rawSegments = normalizedText
        .split(/\n+/)
        .map((segment) => cleanMealDbInstructionSegment(segment))
        .filter(Boolean);

    const steps = [];

    for (const segment of rawSegments) {
        const lastStep = steps[steps.length - 1];

        if (isMealDbStepLabel(segment) && lastStep) {
            continue;
        }

        // Some MealDB records mix numbered steps with trailing continuation lines,
        // so attach obviously incomplete fragments to the previous instruction.
        if (isMealDbContinuation(segment) && lastStep) {
            steps[steps.length - 1] = `${lastStep} ${segment}`.trim();
            continue;
        }

        steps.push(segment);
    }

    return steps;
}

// TheMealDB instructions can have inconsistent formatting, so try to clean up common issues for better display.
function cleanMealDbInstructionSegment(segment) {
    let cleanedSegment = segment.trim();

    if (!cleanedSegment) {
        return "";
    }

    cleanedSegment = cleanedSegment
        .replace(/^(\d+\.\s*)+/, "")
        .replace(/^step\s*\d+\s*[:-]?\s*/i, "")
        .replace(/\s+/g, " ")
        .trim();

    return cleanedSegment;
}

// TheMealDB often includes "Step X" labels in instructions, 
// so identify them to avoid displaying as separate steps.
function isMealDbStepLabel(segment) {
    return /^step\s*\d+$/i.test(segment);
}

// Try to identify if TheMealDB instruction segment is likely a continuation of the previous step.
function isMealDbContinuation(segment) {
    if (!segment) {
        return false;
    }

    if (/^[a-z(]/.test(segment)) {
        return true;
    }

    if (/^(then|add|cook|stir|mix|put|pour|bring|reduce|remove|serve)\b/i.test(segment)) {
        return true;
    }

    return false;
}

function isAuthenticated(req, res, next) {
    if (!req.session.userId) {
        return res.redirect("/login");
    }

    next();
}
