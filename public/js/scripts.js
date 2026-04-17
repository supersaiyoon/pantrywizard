const searchInput = document.getElementById("searchInput");
const searchButton = document.getElementById("searchButton");
const searchResults = document.getElementById("searchResults");

// Ensure elements exist before adding event listeners
if (searchButton && searchInput && searchResults) {
    searchButton.addEventListener("click", searchRecipes);

    // Trigger search on Enter key press
    searchInput.addEventListener("keypress", (event) => {
        if (event.key === "Enter") {
            searchRecipes();
        }
    });
}

async function searchRecipes() {
    const ingredients = searchInput.value.trim();

    // Get selected cuisines and diets from checkboxes AFTER user clicks search
    const cuisineCheckboxes = document.querySelectorAll("input[name='cuisine']:checked");
    const dietCheckboxes = document.querySelectorAll("input[name='diet']:checked");
    
    const cuisines = [];
    const diets = [];

    for (let checkbox of cuisineCheckboxes) {
        cuisines.push(checkbox.value);
    }

    for (let checkbox of dietCheckboxes) {
        diets.push(checkbox.value);
    }

    console.log("Searching with ingredients:", ingredients);
    console.log("Selected cuisines:", cuisines);
    console.log("Selected diets:", diets);

    if (!ingredients) {
        searchResults.innerHTML = "<p>Please enter at least one ingredient.</p>";
        return;
    }

    searchResults.innerHTML = "<p>Searching for recipes...</p>";

    try {
        // Build query parameters for API request
        const params = new URLSearchParams({ingredients});

        // Optional search criteria
        if (cuisines.length > 0) {
            params.set("cuisine", cuisines.join(","));
        }

        if (diets.length > 0) {
            params.set("diet", diets.join(","));
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
                <p><strong>Instructions:</strong></p>
                ${formatInstructions(recipe.analyzedInstructions)}
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

function formatInstructions(analyzedInstructions) {
    if (!analyzedInstructions || analyzedInstructions.length === 0) {
        return "<p>No instructions available.</p>";
    }

    const firstInstructionSet = analyzedInstructions[0];

    if (!firstInstructionSet.steps || firstInstructionSet.steps.length === 0) {
        return "<p>No instructions available.</p>";
    }

    let instructionHtml = "<ol>";

    for (let step of firstInstructionSet.steps) {
        instructionHtml += `<li>${step.step}</li>`;
    }

    instructionHtml += "</ol>";
    return instructionHtml;
}
