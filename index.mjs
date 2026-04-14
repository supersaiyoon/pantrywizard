/* ====================
   SETUP & CONFIGURATION
   ==================== */

import express, { response } from "express";
import mysql from "mysql2/promise";

const { query, body, validationResult } = await import("express-validator");
const app = express();

//for render
const port = process.env.PORT || 4000;
import "dotenv/config";
import config from "./config.mjs";

app.set("view engine", "ejs");
app.use(express.static("public"));

//for Express to get values using POST method
app.use(express.urlencoded({ extended: true }));

//setting up database connection pool
const pool = mysql.createPool(config);

/* ====================
   ROUTES
   ==================== */

app.get("/", (req, res) => {
    res.render("index");
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
    console.log(`Example app listening on port http://localhost:${port}`);
});
