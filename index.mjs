// =====================
//  IMPORTS
// =====================

import express, { response } from "express";
import mysql from "mysql2/promise";


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
    res.render("search");
});


// =====================
// API ENDPOINTS
// =====================

app.get(
    "/api/search/ingredients",
    [
        query("ingredients")
            .trim()
            .notEmpty()
            .withMessage("Please enter at least one ingredient.")
    ],
    async (req, res) => {
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        if (!spoonacularApiKey) {
            return res.status(500).json({
                error: "Spoonacular API key is not configured."
            });
        }

        try {
            const ingredients = req.query.ingredients
                .split(",")
                .map((ingredient) => ingredient.trim())
                .filter(Boolean)
                .join(",");

            const apiUrl = new URL("https://api.spoonacular.com/recipes/findByIngredients");
            apiUrl.searchParams.set("apiKey", spoonacularApiKey);
            apiUrl.searchParams.set("ingredients", ingredients);
            apiUrl.searchParams.set("number", "10");
            apiUrl.searchParams.set("ranking", "1");
            apiUrl.searchParams.set("ignorePantry", "true");

            const response = await fetch(apiUrl);

            if (!response.ok) {
                const errorText = await response.text();
                console.error("Spoonacular API error:", errorText);

                return res.status(response.status).json({
                    error: "Failed to fetch ingredient-based recipes."
                });
            }

            const recipes = await response.json();
            res.json({ recipes });
        } catch (err) {
            console.error("Ingredient search error:", err);
            res.status(500).json({ error: "Failed to fetch recipes." });
        }
    }
);

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
    console.log(`Example app listening on port http://localhost:${port}`);
});
