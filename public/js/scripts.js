const searchInput = document.getElementById("searchInput");
const searchButton = document.getElementById("searchButton");
const searchResults = document.getElementById("searchResults");

// Ensure elements exist before adding event listeners
if (searchButton && searchInput && searchResults) {
    searchButton.addEventListener("click", searchRecipes);

    searchInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            searchRecipes();
        }
    });
}

async function searchRecipes() {
    const ingredients = searchInput.value.trim();

    if (!ingredients) {
        searchResults.innerHTML = "<p>Please enter at least one ingredient.</p>";
        return;
    }

    searchResults.innerHTML = "<p>Searching for recipes...</p>";

    try {
        const response = await fetch(
            `/api/search/ingredients?ingredients=${encodeURIComponent(ingredients)}`
        );
        const data = await response.json();

        if (!response.ok) {
            searchResults.innerHTML = `<p>${data.error || "Unable to search recipes."}</p>`;
            return;
        }

        searchResults.innerHTML = "";

        if (!data.recipes || data.recipes.length === 0) {
            searchResults.innerHTML = "<p>No recipes found.</p>";
            return;
        }

        data.recipes.forEach((recipe) => {
            const recipeDiv = document.createElement("div");
            recipeDiv.className = "recipe";
            recipeDiv.innerHTML = `
                <h3>${recipe.title}</h3>
                <img src="${recipe.image}" alt="${recipe.title}">
                <p><strong>Used ingredients:</strong> ${recipe.usedIngredientCount}</p>
                <p><strong>Missing ingredients:</strong> ${recipe.missedIngredientCount}</p>
                <p><strong>You have:</strong> ${formatIngredientList(recipe.usedIngredients)}</p>
                <p><strong>You still need:</strong> ${formatIngredientList(recipe.missedIngredients)}</p>
            `;
            searchResults.appendChild(recipeDiv);
        });
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
