const searchInput = document.getElementById("searchInput");
const searchButton = document.getElementById("searchButton");
const searchResults = document.getElementById("searchResults");

window.addEventListener("DOMContentLoaded", () => {
    if (searchInput) {
        const savedIngredients = localStorage.getItem("lastIngredients");
        if (savedIngredients) {
            searchInput.value = savedIngredients;
        }
    }
});

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
    localStorage.setItem("lastIngredients", ingredients);

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
        const params = new URLSearchParams({ ingredients });

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
                <div class="recipe-header">
                    <h3>${recipe.title}</h3>
                    <span class="source-badge">${recipe.source || "Recipe"}</span>
                </div>
                <img src="${recipe.image}" alt="${recipe.title}">
                ${formatRecipeMeta(recipe)}
                ${formatSourceDetails(recipe)}
                <p><strong>Instructions:</strong></p>
                ${formatInstructions(recipe)}

                <a href="/recipe/${recipe.id}?source=${encodeURIComponent(recipe.sourceKey || "spoonacular")}" class="btn btn-secondary">
                    View Details
                </a>

                <form method="POST" action="/favorites/add">
                    <input type="hidden" name="recipe_id" value="${recipe.id}">
                    <input type="hidden" name="recipe_title" value="${recipe.title}">
                    <input type="hidden" name="image_url" value="${recipe.image || '/img/placeholder.jpg'}">
                    <input type="hidden" name="meal_type" value="${recipe.category || ''}">
                    <input type="hidden" name="diet_type" value="">

                    <label for="notes-${recipe.id}">Notes</label>
                    <textarea name="notes" id="notes-${recipe.id}" rows="3" cols="30" placeholder="Add a note"></textarea>

                    <button type="submit" class="btn btn-primary">Add to Favorites</button>
                </form>
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

function formatRecipeMeta(recipe) {
    const sections = [];

    if (recipe.readyInMinutes != null) {
        sections.push(`<p><strong>Ready in:</strong> ${recipe.readyInMinutes} minutes</p>`);
    }

    if (recipe.servings != null) {
        sections.push(`<p><strong>Servings:</strong> ${recipe.servings}</p>`);
    }

    if (recipe.usedIngredientCount != null) {
        sections.push(`<p><strong>Used ingredients:</strong> ${recipe.usedIngredientCount}</p>`);
    }

    if (recipe.missedIngredientCount != null) {
        sections.push(`<p><strong>Missing ingredients:</strong> ${recipe.missedIngredientCount}</p>`);
    }

    if (recipe.usedIngredients?.length) {
        sections.push(`<p><strong>You have:</strong> ${formatIngredientList(recipe.usedIngredients)}</p>`);
    }

    if (recipe.missedIngredients?.length) {
        sections.push(`<p><strong>You still need:</strong> ${formatIngredientList(recipe.missedIngredients)}</p>`);
    }

    if (recipe.category) {
        sections.push(`<p><strong>Category:</strong> ${recipe.category}</p>`);
    }

    if (recipe.area) {
        sections.push(`<p><strong>Region:</strong> ${recipe.area}</p>`);
    }

    return sections.join("");
}

function formatSourceDetails(recipe) {
    if (!recipe.sourceDetails) {
        return "";
    }

    return `<p class="source-details">${recipe.sourceDetails}</p>`;
}

function formatInstructions(recipe) {
    const analyzedInstructions = recipe.analyzedInstructions;

    if (!analyzedInstructions || analyzedInstructions.length === 0) {
        if (recipe.instructionsText) {
            return `<p>${recipe.instructionsText}</p>`;
        }

        return "<p>No instructions available.</p>";
    }

    const firstInstructionSet = analyzedInstructions[0];

    if (!firstInstructionSet.steps || firstInstructionSet.steps.length === 0) {
        if (recipe.instructionsText) {
            return `<p>${recipe.instructionsText}</p>`;
        }

        return "<p>No instructions available.</p>";
    }

    let instructionHtml = "<ol>";

    for (let step of firstInstructionSet.steps) {
        instructionHtml += `<li>${step.step}</li>`;
    }

    instructionHtml += "</ol>";
    return instructionHtml;
}
