# Grateful Dead Show Finder and Player

This project is a web application that allows users to search for and play Grateful Dead shows from the Internet Archive. It includes a search interface with filtering options and an embedded player for listening to selected shows.

## Features

- **Search Interface**: Users can search for Grateful Dead shows using keywords, filter by year range, venue, and sort by various criteria.
- **Embedded Player**: Selected shows can be played directly within the application using an embedded player from the Internet Archive.
- **Responsive Design**: The interface is optimized for both desktop and mobile devices, with special handling to disable autocomplete on mobile for better usability.

## File Structure

- **index.html**: The main page where users can search for Grateful Dead shows.
- **player.html**: The player page that displays show details and allows users to play selected shows.

## Usage

1. **Search for Shows**:
   - Enter a search query in the search bar (e.g., song name, taper name, venue).
   - Use the filters to specify a year range, venue, or sort order.
   - Click the "Search" button to display results.

2. **View and Play a Show**:
   - Click on a show from the search results to open it in the player page.
   - The player page will display detailed information about the show and an embedded player for listening.

## Technologies Used

- **HTML5**: Provides the structure of the web pages.
- **CSS3**: Used for styling and ensuring responsive design.
- **JavaScript (jQuery)**: Handles dynamic content loading, search functionality, and mobile-specific behaviors.
- **Internet Archive API**: Retrieves show data and provides the embed player.

## Installation

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/your-username/grateful-dead-show-finder.git
     ```

2. **Open the Project**:
   - Navigate to the project directory and open \`index.html\` in your web browser.

## Customization

- **Mobile-Specific Behaviors**: The search input field disables autocomplete on mobile devices to improve the user experience.
- **Loading and Error Handling**: The player page includes custom loading animations and fallback messages in case the embedded player fails to load.

## Contributing

Contributions are welcome! Please fork the repository and create a new branch for your feature or bug fix. Submit a pull request once your changes are ready.

## License

This project is licensed under the MIT License. See the LICENSE file for more information.
