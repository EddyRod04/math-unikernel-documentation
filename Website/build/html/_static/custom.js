document.addEventListener("DOMContentLoaded", function() {
    // Select the search input field
    const searchInput = document.querySelector("input[name='q']");
    
    // Change the placeholder text if the input exists
    if (searchInput) {
        searchInput.placeholder = "Search";
    }
});