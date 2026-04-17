// =====================
//  IMPORTS
// =====================

import express from "express";
import mysql from "mysql2/promise";
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
const theMealDbApiKey = process.env.THEMEALDB_API_KEY;

// API base URLs
const spoonacularBaseUrl = "https://api.spoonacular.com/recipes";
const theMealDbSearchBaseUrl = `https://www.themealdb.com/api/json/v1/${theMealDbApiKey}`;

//for Express to get values using POST method
app.use(express.urlencoded({ extended: true }));

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
                usedIngredients: usedIngredients,
                missedIngredients: missedIngredients,
                analyzedInstructions: analyzedInstructions,
                usedIngredientCount: usedIngredientCount,
                missedIngredientCount: missedIngredientCount
            };

            recipes.push(newRecipe);
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
