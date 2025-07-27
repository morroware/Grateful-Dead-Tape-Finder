# Live Music Archive Finder & Player

A modern, feature-rich web interface for searching and playing the vast collection of live concert recordings available on the Internet Archive's etree collection. Originally built for Grateful Dead shows, it has been expanded to support an extensive library of bands from the jam, bluegrass, and rock scenes.

The application is built with vanilla JavaScript (ES6+), HTML5, and Tailwind CSS, focusing on a clean, responsive, and intuitive user experience.

## ✨ Features

- **Extensive Band Library**: Instantly search the collections of dozens of bands, including the Grateful Dead and its side projects, Billy Strings, Goose, Ween, King Gizzard, and many more.

- **Advanced Search & Filtering**: Narrow down results with keyword search, specific year ranges, and one-click filters for recording types like Soundboard (SBD), Audience (AUD), Matrix, and top-rated shows.

- **Modern Audio Player**: A sleek player page featuring a dynamic, colorful audio visualizer powered by the Web Audio API.

- **Full Playback Controls**: The player includes shuffle, repeat (single track or full playlist), and volume controls.

- **Keyboard Shortcuts**: Control playback with your keyboard (e.g., Spacebar for play/pause, arrow keys to seek, 'N' for next track).

- **Persistent History**: Your last selected band and a list of your 5 most recently viewed shows are saved in your browser for quick access.

- **Shareable URLs**: The URL automatically updates as you search, allowing you to share and bookmark links to specific search queries or even a particular track within a show.

## 🚀 Getting Started

1. **Clone the repository**
   ```bash
   git clone(https://github.com/morroware/Grateful-Dead-Tape-Finder/)
   cd Grateful-Dead-Tape-Finder
   ```

2. **Open the application**
   Simply open `index.html` in your web browser - no build process or server required!

## 🎵 How to Use

### Search for a Show
1. Open `index.html` in your web browser
2. Use the Band Selector dropdown to choose an artist
3. Optionally add keywords, adjust the year range, or click filter buttons to refine your search
4. Results will appear automatically as you type and filter

### Play a Show
1. Click any show card in the search results
2. You'll be taken to the `player.html` page where the show's playlist will load
3. Playback begins automatically

### Control Playback
Use the on-screen controls or these keyboard shortcuts:
- **Spacebar**: Play/Pause
- **Arrow Keys**: Seek forward/backward
- **N**: Next track
- **P**: Previous track
- **S**: Shuffle toggle
- **R**: Repeat mode toggle

## 📂 Project Structure

```
/project-root
├── index.html      # Main search page for finding shows
├── player.html     # Audio player page for listening to selected shows
├── styles.css      # Custom CSS with glassmorphism theme and responsive design
└── scripts.js      # Application logic, API interaction, and player functionality
```

### File Descriptions

- **`index.html`**: The main entry point containing the comprehensive search interface. Users can select a band, define a year range, enter keywords, and apply filters to find concert recordings.

- **`player.html`**: A dedicated page that houses the audio player. It dynamically loads the selected show's playlist, displays detailed metadata, and provides a rich listening experience with an audio visualizer.

- **`styles.css`**: Contains all styling rules, utilizing a dark theme with modern fonts and a semi-transparent "glass card" aesthetic for UI elements. Fully responsive for both desktop and mobile use.

- **`scripts.js`**: A single, comprehensive vanilla JavaScript file that drives the entire application. Handles all API calls to the Internet Archive, manages search and player state, controls audio playback, and renders dynamic UI components.

## 🛠️ Technologies Used

This project is built with modern web technologies and has minimal dependencies:

- **Tailwind CSS (v3)**: Used for all styling, included via CDN
- **Vanilla JavaScript (ES6+)**: All application logic written in modern, dependency-free JavaScript
- **Web Audio API**: Powers the real-time audio visualizer
- **Fetch API**: Handles all asynchronous requests to the Internet Archive API
- **HTML5 & CSS3**: Utilizes modern markup and styling features like CSS variables and `backdrop-filter` for the glass effect

## 🎯 Browser Compatibility

- Modern browsers with ES6+ support
- Web Audio API support required for visualizer functionality
- Responsive design works on desktop, tablet, and mobile devices

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

## 📄 License

Public Domain. If you like it, use it. Credit would be nice, but not required.

## 🙏 Acknowledgments

- Thanks to the Internet Archive for maintaining the incredible etree collection
- Built for the live music community and tape traders everywhere

---

*Enjoy exploring decades of live music history!* 🎸


