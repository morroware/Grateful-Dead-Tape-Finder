// External JavaScript file for both player.html and index.html

$(document).ready(function() {
    const urlParams = new URLSearchParams(window.location.search);
    const identifier = urlParams.get('id');
    
    if (identifier) {
        const metadataUrl = `https://archive.org/metadata/${identifier}`;
        $.getJSON(metadataUrl, function(data) {
            const title = data.metadata.title;
            document.title = `Grateful Dead: ${title}`;
            $('#show-title').text(title);

            const archiveUrl = `https://archive.org/details/${identifier}`;
            $('#archive-link').attr('href', archiveUrl);

            // Populate show info
            const showInfo = $('#show-info');
            showInfo.append(`<h2>Show Details</h2>`);
            showInfo.append(`<p><strong>Date:</strong> ${data.metadata.date || 'N/A'}</p>`);
            showInfo.append(`<p><strong>Venue:</strong> ${data.metadata.venue || 'N/A'}</p>`);
            showInfo.append(`<p><strong>Location:</strong> ${data.metadata.coverage || 'N/A'}</p>`);
            showInfo.append(`<p><strong>Source:</strong> ${data.metadata.source || 'N/A'}</p>`);
            showInfo.append(`<p><strong>Lineage:</strong> ${data.metadata.lineage || 'N/A'}</p>`);
            showInfo.append(`<p><strong>Taper:</strong> ${data.metadata.taper || 'N/A'}</p>`);

            // Populate additional info
            const additionalInfo = $('#additional-info');
            additionalInfo.append(`<h2>Additional Information</h2>`);
            if (data.metadata.description) {
                additionalInfo.append(`<h3>Description</h3><p>${data.metadata.description}</p>`);
            }
            if (data.metadata.notes) {
                additionalInfo.append(`<h3>Notes</h3><p>${data.metadata.notes}</p>`);
            }
            if (data.metadata.setlist) {
                additionalInfo.append(`<h3>Setlist</h3><p>${data.metadata.setlist}</p>`);
            }

            // Lazy load the iframe
            const iframe = document.createElement('iframe');
            iframe.src = `https://archive.org/embed/${identifier}?playlist=1&list_height=350`;
            iframe.allowFullscreen = true;

            // Use Intersection Observer to load iframe when it's in view
            const observer = new IntersectionObserver((entries, observer) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        $('#loading-placeholder').replaceWith(iframe);
                        observer.disconnect();
                    }
                });
            }, { threshold: 0.1 });

            observer.observe(document.getElementById('player-wrapper'));
        });
    } else {
        $('#player-wrapper').html('<p>No show selected. Please go back and choose a show.</p>');
    }
});

// Additional functions for handling search and pagination on index.html

let currentPage = 1;
const resultsPerPage = 10;
let totalResults = 0;

function searchShows(page = 1) {
    const query = $('#searchQuery').val();
    const yearFrom = $('#yearFrom').val();
    const yearTo = $('#yearTo').val();
    const venue = $('#venue').val();
    const sortOrder = $('#sortOrder').val();

    if (!query && yearFrom === "1965" && yearTo === "1995" && !venue) {
        alert('Please enter at least one search term or adjust the year range');
        return;
    }
    
    $('#loading').show();
    $('#results').empty();

    let baseQuery = 'collection:(GratefulDead) AND mediatype:(etree) AND creator:(Grateful Dead)';
    if (query) baseQuery += ` AND (${query})`;
    if (yearFrom) baseQuery += ` AND year:[${yearFrom} TO ${yearTo || '*'}]`;
    if (venue) baseQuery += ` AND venue:(${venue})`;

    const url = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(baseQuery)}&fl[]=identifier,title,year,venue,coverage&sort[]=${sortOrder}&output=json&rows=${resultsPerPage}&page=${page}`;

    $.getJSON(url, function(data) {
        const results = data.response.docs;
        totalResults = data.response.numFound;
        currentPage = page;
        updatePagination();

        $('#loading').hide();
        if (results.length === 0) {
            $('#results').html('<p>No shows found. Try different search terms.</p>');
        } else {
            results.forEach(show => {
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
        $('#loading').hide();
        $('#results').html('<p>Error occurred while searching. Please try again later.</p>');
    });
}

function updatePagination() {
    const totalPages = Math.ceil(totalResults / resultsPerPage);
    $('#pageInfo').text(`Page ${currentPage} of ${totalPages}`);
    $('#prevPage').prop('disabled', currentPage === 1);
    $('#nextPage').prop('disabled', currentPage === totalPages);
}

function changePage(delta) {
    searchShows(currentPage + delta);
}

function openPlayerPage(identifier) {
    window.open(`player.html?id=${identifier}`, '_blank');
}

$(document).ready(function() {
    const baseQuery = 'collection:(GratefulDead) AND mediatype:(etree) AND creator:(Grateful Dead)';

    // Detect mobile devices
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    // Set autocomplete only if not on mobile
    if (!isMobile) {
        $('#searchQuery').autocomplete({
            source: function(request, response) {
                $.getJSON(`https://archive.org/advancedsearch.php?q=${encodeURIComponent(baseQuery)} AND ${request.term}&fl[]=title&output=json`, function(data) {
                    response(data.response.docs.map(item => item.title));
                });
            },
            minLength: 2,
            position: { my : "left top", at: "left bottom" },
            appendTo: ".search-container"
        });

        $('#venue').autocomplete({
            source: function(request, response) {
                $.getJSON(`https://archive.org/advancedsearch.php?q=${encodeURIComponent(baseQuery)} AND ${request.term}&fl[]=venue&output=json`, function(data) {
                    response(Array.from(new Set(data.response.docs.map(item => item.venue).filter(Boolean))));
                });
            },
            minLength: 2,
            position: { my : "left top", at: "left bottom" },
            appendTo: ".search-container"
        });
    }

    $('#yearFrom, #yearTo').attr({
        'min': 1965,
        'max': 1995
    });

    $('#yearFrom').val(1965);
    $('#yearTo').val(1995);
});
