const searchInput = document.getElementById("searchInput");
const cuisineInput = document.getElementById("cuisineInput");
const dietInput = document.getElementById("dietInput");
const searchButton = document.getElementById("searchButton");
const searchResults = document.getElementById("searchResults");

// Ensure elements exist before adding event listeners
if (searchButton && searchInput && searchResults) {
    searchButton.addEventListener("click", searchRecipes);

    for (const input of [searchInput, cuisineInput, dietInput]) {
        if (!input) {
            continue;
        }

        input.addEventListener("keypress", (e) => {
            if (e.key === "Enter") {
                searchRecipes();
            }
        });
    }
}

async function searchRecipes() {
    const ingredients = searchInput.value.trim();
    const cuisine = cuisineInput?.value.trim() || "";
    const diet = dietInput?.value.trim() || "";

    if (!ingredients) {
        searchResults.innerHTML = "<p>Please enter at least one ingredient.</p>";
        return;
    }

    searchResults.innerHTML = "<p>Searching for recipes...</p>";

    try {
        // Build query parameters for API request
        const params = new URLSearchParams({
            ingredients
        });

        // Optional search criteria
        if (cuisine) {
            params.set("cuisine", cuisine);
        }

        if (diet) {
            params.set("diet", diet);
        }

        const response = await fetch(`/api/search/ingredients?${params.toString()}`);
        const data = await response.json();

        if (!response.ok) {
            searchResults.innerHTML = `<p>${data.error || "Unable to search recipes."}</p>`;
            return;
        }

        searchResults.innerHTML = "";

        if (!data || data.length === 0) {
            searchResults.innerHTML = "<p>No recipes found.</p>";
            return;
        }

        for (const recipe of data) {
            const recipeDiv = document.createElement("div");
            recipeDiv.className = "recipe";
            recipeDiv.innerHTML = `
                <h3>${recipe.title}</h3>
                <img src="${recipe.image}" alt="${recipe.title}">
                <p><strong>Ready in:</strong> ${recipe.readyInMinutes || "N/A"} minutes</p>
                <p><strong>Servings:</strong> ${recipe.servings || "N/A"}</p>
                <p><strong>Used ingredients:</strong> ${recipe.usedIngredientCount}</p>
                <p><strong>Missing ingredients:</strong> ${recipe.missedIngredientCount}</p>
                <p><strong>You have:</strong> ${formatIngredientList(recipe.usedIngredients)}</p>
                <p><strong>You still need:</strong> ${formatIngredientList(recipe.missedIngredients)}</p>
            `;
            searchResults.appendChild(recipeDiv);
        }
    }
    catch (error) {
        console.error(error);
        searchResults.innerHTML = "<p>Error fetching recipes.</p>";
    }
}

function formatIngredientList(ingredients) {
    if (!ingredients || ingredients.length === 0) {
        return "None";
    }

    return ingredients.map((ingredient) => ingredient.name).join(", ");
}
