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

const { query, body, validationResult } = await import("express-validator");
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

app.get("/favorites", (req, res) => {
    res.render("favorites");
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

app.post(
    "/register",
    [
        body("username")
            .trim()
            .notEmpty()
            .withMessage("Username is required.")
            .isLength({ min: 3, max: 50 })
            .withMessage("Username must be between 3 and 50 characters."),
        body("password")
            .notEmpty()
            .withMessage("Password is required.")
            .isLength({ min: 8 })
            .withMessage("Password must be at least 8 characters long.")
    ],
    async (req, res) => {
        const errors = validationResult(req);
        const username = req.body.username || "";
        const password = req.body.password || "";

        if (!errors.isEmpty()) {
            return res.status(400).render("register", {
                errors: errors.array(),
                successMessage: "",
                formData: { username }
            });
        }

        try {
            const existingUser = await findUserByUsername(username);

            if (existingUser) {
                return res.status(400).render("register", {
                    errors: [{ msg: "That username is already taken." }],
                    successMessage: "",
                    formData: { username }
                });
            }

            const passwordHash = await bcrypt.hash(password, saltRounds);
            await createUser(username, passwordHash);

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
    }
);

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

app.post(
    "/login",
    [
        body("username")
            .trim()
            .notEmpty()
            .withMessage("Username is required."),
        body("password")
            .notEmpty()
            .withMessage("Password is required.")
    ],
    async (req, res) => {
        const errors = validationResult(req);
        const username = req.body.username || "";
        const password = req.body.password || "";

        if (!errors.isEmpty()) {
            return res.status(400).render("login", {
                errors: errors.array(),
                formData: { username }
            });
        }

        try {
            const user = await findUserByUsername(username);

            if (!user) {
                return res.status(401).render("login", {
                    errors: [{ msg: "Invalid username or password." }],
                    formData: { username }
                });
            }

            const passwordMatches = await bcrypt.compare(password, user.password_hash);

            if (!passwordMatches) {
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
    }
);

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

app.listen(port, () => {
    console.log(`Server listening on port http://localhost:${port}`);
});

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
        sourceDetails: hasFilters
            ? "Single-ingredient match from TheMealDB. Cuisine and diet filters do not apply."
            : "Single-ingredient match from TheMealDB.",
        filtersApplied: false,
        category: meal.strCategory || null,
        area: meal.strArea || null,
        usedIngredients: [],
        missedIngredients: [],
        usedIngredientCount: null,
        missedIngredientCount: null,
        analyzedInstructions: steps.length > 0 ? [{ steps }] : [],
        instructionsText: instructions
    };
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

function normalizeUsername(username) {
    return username.trim().toLowerCase();
}

async function findUserByUsername(username) {
    const normalizedUsername = normalizeUsername(username);
    const [rows] = await pool.query(
        `SELECT id, username, password_hash, created_at
         FROM users
         WHERE username = ?`,
        [normalizedUsername]
    );

    return rows[0] || null;
}

async function createUser(username, passwordHash) {
    const normalizedUsername = normalizeUsername(username);
    const [result] = await pool.query(
        `INSERT INTO users (username, password_hash)
         VALUES (?, ?)`,
        [normalizedUsername, passwordHash]
    );

    return {
        id: result.insertId,
        username: normalizedUsername
    };
}
