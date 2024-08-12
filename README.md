# Grateful Dead Show Finder and Player

This project provides a web-based interface for searching and playing recordings of Grateful Dead shows. The site is built with modular HTML, CSS, and JavaScript to enhance maintainability and scalability.

## Project Structure

```
/project-root
|-- index.html          # The main search page for finding Grateful Dead shows
|-- player.html         # The player page for playing selected shows
|-- styles.css          # External CSS file containing styles for the entire site
|-- scripts.js          # External JavaScript file containing all interactive functionality
```

### File Descriptions

- **index.html**: This file contains the search interface for users to find shows based on different criteria such as song, taper, year, venue, etc.

- **player.html**: This file displays the player interface, where users can play the selected show, view details, and access additional information about the show.

- **styles.css**: This file contains all the styling rules for both the `index.html` and `player.html` pages, ensuring a consistent and visually appealing design.

- **scripts.js**: This file contains all the JavaScript needed for the interactivity on both the `index.html` and `player.html` pages, including AJAX calls, pagination, lazy loading, and more.

## How to Use

1. **Search for a Show**: Open the `index.html` file in a web browser. Enter search criteria, and click the "Search" button to find relevant shows.

2. **Play a Show**: Click on any show in the search results to open the player page (`player.html`). The player will load and play the show, displaying relevant metadata and additional information.

## Dependencies

The project relies on the following external libraries:

- [jQuery](https://jquery.com/) (v3.6.0)
- [jQuery UI](https://jqueryui.com/) (v1.12.1)

These libraries are included via CDN links in the HTML files.

## License

This project is open-source and available under the [MIT License](LICENSE).
