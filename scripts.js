$(document).ready(function() {
    // Parse URL parameters to get the 'id' parameter (identifier of the show)
    const urlParams = new URLSearchParams(window.location.search);
    const identifier = urlParams.get('id');
    
    if (identifier) {
        // Lazy load the iframe for the media player
        // This creates an iframe element but doesn't load it until the user scrolls it into view

        const iframe = document.createElement('iframe');
        iframe.src = `https://archive.org/embed/${identifier}?playlist=1&list_height=350`; // Set the source to the correct media URL
        iframe.allowFullscreen = true; // Allow the iframe to enter fullscreen mode

        // Intersection Observer is used to delay the loading of the iframe until it's about to come into the viewport
        const observer = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) { // Check if the iframe is within the viewport
                    $('#loading-placeholder').replaceWith(iframe); // Replace the placeholder with the actual iframe
                    observer.disconnect(); // Stop observing once the iframe has loaded
                }
            });
        }, { threshold: 0.1 }); // Trigger the load when 10% of the element is visible

        observer.observe(document.getElementById('player-wrapper')); // Start observing the player-wrapper element

        // Construct the URL to fetch metadata for the specific show
        const metadataUrl = `https://archive.org/metadata/${identifier}`;
        
        // Make an AJAX request to get the metadata JSON from the Internet Archive
        $.getJSON(metadataUrl, function(data) {
            const title = data.metadata.title; // Extract the title from the metadata
            document.title = `Grateful Dead: ${title}`; // Set the document title to include the show title
            $('#show-title').text(title); // Set the show title in the HTML

            const archiveUrl = `https://archive.org/details/${identifier}`;
            $('#archive-link').attr('href', archiveUrl); // Set the link to the full show details on archive.org

            // Populate the show details section with metadata
            const showInfo = $('#show-info');
            showInfo.append(`<h2>Show Details</h2>`); // Add a header for the show details
            showInfo.append(`<p><strong>Date:</strong> ${data.metadata.date || 'N/A'}</p>`); // Show date
            showInfo.append(`<p><strong>Venue:</strong> ${data.metadata.venue || 'N/A'}</p>`); // Show venue
            showInfo.append(`<p><strong>Location:</strong> ${data.metadata.coverage || 'N/A'}</p>`); // Location of the show
            showInfo.append(`<p><strong>Source:</strong> ${data.metadata.source || 'N/A'}</p>`); // Audio source
            showInfo.append(`<p><strong>Lineage:</strong> ${data.metadata.lineage || 'N/A'}</p>`); // Lineage of the recording
            showInfo.append(`<p><strong>Taper:</strong> ${data.metadata.taper || 'N/A'}</p>`); // Name of the taper

            // Populate additional information (description, notes, setlist) if available
            const additionalInfo = $('#additional-info');
            additionalInfo.append(`<h2>Additional Information</h2>`); // Header for additional info
            if (data.metadata.description) {
                additionalInfo.append(`<h3>Description</h3><p>${data.metadata.description}</p>`); // Description of the show
            }
            if (data.metadata.notes) {
                additionalInfo.append(`<h3>Notes</h3><p>${data.metadata.notes}</p>`); // Any notes related to the show
            }
            if (data.metadata.setlist) {
                additionalInfo.append(`<h3>Setlist</h3><p>${data.metadata.setlist}</p>`); // Setlist for the show
            }
        });
    } else {
        // If no identifier is provided, display an error message
        $('#player-wrapper').html('<p>No show selected. Please go back and choose a show.</p>');
    }
});

// Additional functions for handling search and pagination on index.html

let currentPage = 1; // Track the current page for pagination
const resultsPerPage = 10; // Number of results to display per page
let totalResults = 0; // Total number of search results

function searchShows(page = 1) {
    // Fetch search parameters from the form
    const query = $('#searchQuery').val();
    const yearFrom = $('#yearFrom').val();
    const yearTo = $('#yearTo').val();
    const venue = $('#venue').val();
    const sortOrder = $('#sortOrder').val();

    // Validate that at least one search criterion is provided
    if (!query && yearFrom === "1965" && yearTo === "1995" && !venue) {
        alert('Please enter at least one search term or adjust the year range');
        return;
    }
    
    // Show a loading spinner while the results are being fetched
    $('#loading').show();
    $('#results').empty(); // Clear any previous results

    // Construct the search query for the Internet Archive's API
    let baseQuery = 'collection:(GratefulDead) AND mediatype:(etree) AND creator:(Grateful Dead)';
    if (query) baseQuery += ` AND (${query})`; // Add text search
    if (yearFrom) baseQuery += ` AND year:[${yearFrom} TO ${yearTo || '*'}]`; // Filter by year range
    if (venue) baseQuery += ` AND venue:(${venue})`; // Filter by venue

    // Construct the full URL for the search request
    const url = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(baseQuery)}&fl[]=identifier,title,year,venue,coverage&sort[]=${sortOrder}&output=json&rows=${resultsPerPage}&page=${page}`;

    // Perform the search via AJAX
    $.getJSON(url, function(data) {
        const results = data.response.docs; // Extract the list of shows
        totalResults = data.response.numFound; // Total number of results
        currentPage = page; // Update the current page
        updatePagination(); // Update pagination controls

        $('#loading').hide(); // Hide the loading spinner
        if (results.length === 0) {
            $('#results').html('<p>No shows found. Try different search terms.</p>'); // Show message if no results
        } else {
            results.forEach(show => {
                // Display each show in the results list
                $('#results').append(`
                    <div class="show" onclick="openPlayerPage('${show.identifier}')">
                        <strong>${show.year}: ${show.title}</strong>
                        <div class="show-details">
                            Venue: ${show.venue || 'N/A'}
                            Coverage: ${show.coverage || 'N/A'}
                        </div>
                    </div>
                `);
            });
        }
    }).fail(function() {
        // Handle errors during the search request
        $('#loading').hide(); // Hide the loading spinner
        $('#results').html('<p>Error occurred while searching. Please try again later.</p>'); // Show error message
    });
}

function updatePagination() {
    // Calculate total pages and update the pagination display
    const totalPages = Math.ceil(totalResults / resultsPerPage);
    $('#pageInfo').text(`Page ${currentPage} of ${totalPages}`); // Show current page info
    $('#prevPage').prop('disabled', currentPage === 1); // Disable previous page button on first page
    $('#nextPage').prop('disabled', currentPage === totalPages); // Disable next page button on last page
}

function changePage(delta) {
    // Change the page by the given delta (+1 for next, -1 for previous)
    searchShows(currentPage + delta);
}

function openPlayerPage(identifier) {
    // Open the player page for the selected show in a new tab
    window.open(`player.html?id=${identifier}`, '_blank');
}

$(document).ready(function() {
    const baseQuery = 'collection:(GratefulDead) AND mediatype:(etree) AND creator:(Grateful Dead)';

    // Detect mobile devices using a simple regex check on the user agent
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    // Only set up autocomplete if the user is not on a mobile device
    if (!isMobile) {
        // Autocomplete for the search query input
        $('#searchQuery').autocomplete({
            source: function(request, response) {
                // Perform a search to get autocomplete suggestions based on the current input
                $.getJSON(`https://archive.org/advancedsearch.php?q=${encodeURIComponent(baseQuery)} AND ${request.term}&fl[]=title&output=json`, function(data) {
                    response(data.response.docs.map(item => item.title)); // Return a list of titles
                });
            },
            minLength: 2, // Minimum characters required before triggering autocomplete
            position: { my : "left top", at: "left bottom" }, // Position the autocomplete dropdown
            appendTo: ".search-container" // Ensure the dropdown is within the search container
        });

        // Autocomplete for the venue input
        $('#venue').autocomplete({
            source: function(request, response) {
                // Perform a search to get venue suggestions based on the current input
                $.getJSON(`https://archive.org/advancedsearch.php?q=${encodeURIComponent(baseQuery)} AND ${request.term}&fl[]=venue&output=json`, function(data) {
                    response(Array.from(new Set(data.response.docs.map(item => item.venue).filter(Boolean)))); // Return a list of unique venues
                });
            },
            minLength: 2, // Minimum characters required before triggering autocomplete
            position: { my : "left top", at: "left bottom" }, // Position the autocomplete dropdown
            appendTo: ".search-container" // Ensure the dropdown is within the search container
        });
    }

    // Set up the year range inputs with minimum and maximum values
    $('#yearFrom, #yearTo').attr({
        'min': 1965, // Earliest possible year
        'max': 1995  // Latest possible year
    });

    // Set default year range values
    $('#yearFrom').val(1965);
    $('#yearTo').val(1995);
});
