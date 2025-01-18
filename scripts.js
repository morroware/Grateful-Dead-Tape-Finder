// Global variables for search functionality
let currentPage = 1;
const resultsPerPage = 10;
let totalResults = 0;
let recentlyViewed = JSON.parse(localStorage.getItem('recentlyViewed') || '[]');

// Player state variables
let playlist = [];
let currentIndex = 0;
let isShuffled = false;
let loopMode = 'none';
let originalPlaylist = [];
let lastVolume = 1;
let playbackRate = 1;
let playerState = 'paused';
let audio, trackTitle, playPauseButton, prevButton, nextButton, trackProgress;
let currentTimeEl, totalTimeEl, playlistContainer, playIcon;

// Visualizer variables
let audioContext, analyser, dataArray, bufferLength;
let visualizerCanvas, visualizerCtx;

function updateRecentlyViewed(show) {
    recentlyViewed = recentlyViewed.filter(s => s.identifier !== show.identifier);
    recentlyViewed.unshift(show);
    if (recentlyViewed.length > 5) recentlyViewed.pop();
    localStorage.setItem('recentlyViewed', JSON.stringify(recentlyViewed));
    renderRecentlyViewed();
}

function renderRecentlyViewed() {
    const container = document.getElementById('recentlyViewed');
    if (!container || recentlyViewed.length === 0) return;
    
    container.innerHTML = `
        <div class="bg-gray-800 border border-gray-700 rounded-lg shadow-lg p-4 max-w-sm">
            <h3 class="font-semibold mb-2 text-gray-100">Recently Viewed</h3>
            ${recentlyViewed.map(show => `
                <div class="text-sm mb-2 hover:bg-gray-700 p-2 rounded cursor-pointer text-gray-300"
                     onclick="openPlayerPage('${show.identifier}')">
                    ${show.title}
                </div>
            `).join('')}
        </div>
    `;
}

function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

function showLoading() {
    const loadingEl = document.getElementById('loading');
    if (loadingEl) loadingEl.classList.remove('hidden');

    const resultsDiv = document.getElementById('results');
    if (resultsDiv) {
        resultsDiv.innerHTML = '';
        for (let i = 0; i < 3; i++) {
            resultsDiv.innerHTML += `
                <div class="show-card-skeleton">
                    <div class="skeleton-line" style="width: 50%;"></div>
                    <div class="skeleton-line" style="width: 80%;"></div>
                    <div class="skeleton-line" style="width: 60%;"></div>
                </div>
            `;
        }
    }
}

function hideLoading() {
    const loadingEl = document.getElementById('loading');
    if (loadingEl) loadingEl.classList.add('hidden');
}

function createShowCard(show) {
    const sourceStr = show.source ? show.source.toLowerCase() : '';
    const isSbd = sourceStr.includes('soundboard') || sourceStr.includes('sbd');
    const isAudience = sourceStr.includes('audience') || sourceStr.includes('aud');
    const isMatrix = sourceStr.includes('matrix');

    let tags = '';
    if (isSbd) {
        tags += `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-900 text-green-100 mr-1">SBD</span>`;
    }
    if (isAudience) {
        tags += `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-900 text-yellow-100 mr-1">AUD</span>`;
    }
    if (isMatrix) {
        tags += `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-900 text-purple-100">MATRIX</span>`;
    }

    return `
        <div class="bg-gray-800 border border-gray-700 rounded-lg shadow hover:shadow-lg transition-shadow duration-300 cursor-pointer p-6" 
             onclick="openPlayerPage('${show.identifier}')">
            <div class="flex justify-between items-start">
                <div>
                    <h3 class="text-lg font-semibold text-gray-100">${show.year}: ${show.title}</h3>
                    <div class="mt-1">${tags}</div>
                </div>
                <div class="text-sm text-gray-400">${show.downloads || 0} downloads</div>
            </div>
            <div class="mt-2 text-sm text-gray-400">
                <div>${show.venue || 'Unknown Venue'}</div>
                <div>${show.coverage || 'Unknown Location'}</div>
            </div>
        </div>
    `;
}

function updatePagination() {
    const totalPages = Math.ceil(totalResults / resultsPerPage);
    const pageInfo = document.getElementById('pageInfo');
    const prevPage = document.getElementById('prevPage');
    const nextPage = document.getElementById('nextPage');

    if (pageInfo) pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    if (prevPage) prevPage.disabled = currentPage === 1;
    if (nextPage) nextPage.disabled = currentPage === totalPages;
}

async function searchShows(page = 1) {
    const searchQueryInput = document.getElementById('searchQuery');
    const yearFromInput = document.getElementById('yearFrom');
    const yearToInput = document.getElementById('yearTo');

    const query = searchQueryInput ? searchQueryInput.value : '';
    const yearFrom = yearFromInput ? yearFromInput.value : '';
    const yearTo = yearToInput ? yearToInput.value : '';
    
    showLoading();
    currentPage = page;
    
    let baseQuery = 'collection:(GratefulDead) AND mediatype:(etree) AND creator:(Grateful Dead)';
    
    if (query) {
        baseQuery += ` AND (${query})`;
    }
    
    if (yearFrom) {
        baseQuery += ` AND year:[${yearFrom} TO ${yearTo || '*'}]`;
    } else {
        baseQuery += ' AND year:[1965 TO 1995]';
    }

    const activeFilter = document.querySelector('[data-filter].bg-blue-500');
    if (activeFilter) {
        const filterType = activeFilter.dataset.filter;
        if (filterType === 'five-star') {
            baseQuery += ' AND avg_rating:[4.5 TO 5]';
        } else if (filterType === 'soundboard') {
            baseQuery += ' AND source:(soundboard OR sbd)';
        } else if (filterType === 'aud') {
            baseQuery += ' AND source:(audience OR aud)';
        } else if (filterType === 'matrix') {
            baseQuery += ' AND (source:matrix)';
        }
    }

    try {
        const response = await fetch(`https://archive.org/advancedsearch.php?q=${encodeURIComponent(baseQuery)}&fl[]=identifier,title,year,venue,coverage,downloads,source&sort[]=downloads+desc&output=json&rows=${resultsPerPage}&page=${page}`);
        const data = await response.json();
        
        hideLoading();
        const resultsDiv = document.getElementById('results');
        
        if (data.response.docs.length === 0) {
            if (resultsDiv) resultsDiv.innerHTML = '<p class="text-center text-gray-400 my-8">No shows found. Try different search terms or filters.</p>';
            return;
        }
        
        totalResults = data.response.numFound;
        if (resultsDiv) resultsDiv.innerHTML = data.response.docs.map(createShowCard).join('');
        updatePagination();
        
    } catch (error) {
        console.error('Search error:', error);
        hideLoading();
        const resultsDiv = document.getElementById('results');
        if (resultsDiv) resultsDiv.innerHTML = '<p class="text-center text-red-500 my-8">An error occurred while searching. Please try again later.</p>';
    }
}

function changePage(delta) {
    searchShows(currentPage + delta);
}

function openPlayerPage(identifier) {
    window.location.href = `player.html?id=${identifier}`;
}

async function initializePlayer() {
    const urlParams = new URLSearchParams(window.location.search);
    const identifier = urlParams.get('id');
    
    if (!identifier) {
        const pw = document.getElementById('player-wrapper');
        if (pw) pw.innerHTML = '<p class="text-center text-red-500">No show selected. Please go back and choose a show.</p>';
        return;
    }

    try {
        const response = await fetch(`https://archive.org/metadata/${identifier}`);
        const data = await response.json();

        document.title = `Grateful Dead: ${data.metadata.title}`;
        const showTitleEl = document.getElementById('show-title');
        if (showTitleEl) showTitleEl.textContent = data.metadata.title;
        const archiveLink = document.getElementById('archive-link');
        if (archiveLink) archiveLink.href = `https://archive.org/details/${identifier}`;

        updateShowInfo(data);
        updateRecentlyViewed({identifier: identifier, title: data.metadata.title});

        const audioFiles = data.files.filter(file => file.format && file.format.toLowerCase().includes('mp3'));
        playlist = audioFiles.map(file => ({
            title: file.title || file.name,
            url: `https://archive.org/download/${identifier}/${file.name}`
        }));
        originalPlaylist = [...playlist];

        setupPlayerUI();
        loadTrack(currentIndex);
    } catch (error) {
        console.error('Error initializing player:', error);
        const pw = document.getElementById('player-wrapper');
        if (pw) pw.innerHTML = '<p class="text-center text-red-500">Error loading show. Please try again later.</p>';
    }
}

function updateShowInfo(data) {
    const showInfo = document.getElementById('show-info');
    if (showInfo) {
        showInfo.innerHTML = `
            <h2 class="text-xl font-semibold mb-4 text-gray-100">Show Details</h2>
            <p class="text-gray-300"><strong class="text-gray-100">Date:</strong> ${data.metadata.date || 'N/A'}</p>
            <p class="text-gray-300"><strong class="text-gray-100">Venue:</strong> ${data.metadata.venue || 'N/A'}</p>
            <p class="text-gray-300"><strong class="text-gray-100">Location:</strong> ${data.metadata.coverage || 'N/A'}</p>
            <p class="text-gray-300"><strong class="text-gray-100">Source:</strong> ${data.metadata.source || 'N/A'}</p>
            <p class="text-gray-300"><strong class="text-gray-100">Lineage:</strong> ${data.metadata.lineage || 'N/A'}</p>
            <p class="text-gray-300"><strong class="text-gray-100">Taper:</strong> ${data.metadata.taper || 'N/A'}</p>
        `;
    }

    const additionalInfo = document.getElementById('additional-info');
    if (additionalInfo) {
        additionalInfo.innerHTML = `
            <h2 class="text-xl font-semibold mb-4 text-gray-100">Additional Information</h2>
            ${data.metadata.description ? `<h3 class="font-semibold mt-4 text-gray-100">Description</h3><p class="text-gray-300">${data.metadata.description}</p>` : ''}
            ${data.metadata.notes ? `<h3 class="font-semibold mt-4 text-gray-100">Notes</h3><p class="text-gray-300">${data.metadata.notes}</p>` : ''}
            ${data.metadata.setlist ? `<h3 class="font-semibold mt-4 text-gray-100">Setlist</h3><p class="text-gray-300">${data.metadata.setlist}</p>` : ''}
        `;
    }
}

function setupPlayerUI() {
    const loadingPlaceholder = document.getElementById('loading-placeholder');
    const customPlayer = document.getElementById('custom-player');
    
    if (loadingPlaceholder) loadingPlaceholder.remove();
    if (customPlayer) customPlayer.classList.remove('hidden');

    // Get all player elements
    audio = document.getElementById('audioElement');
    trackTitle = document.getElementById('trackTitle');
    playPauseButton = document.getElementById('playPause');
    prevButton = document.getElementById('prevTrack');
    nextButton = document.getElementById('nextTrack');
    trackProgress = document.getElementById('trackProgress');
    currentTimeEl = document.getElementById('currentTime');
    totalTimeEl = document.getElementById('totalTime');
    playlistContainer = document.getElementById('playlistContainer');
    playIcon = document.getElementById('playIcon');

    // Additional controls
    const muteButton = document.getElementById('muteButton');
    const volumeControl = document.getElementById('volumeControl');
    const shuffleButton = document.getElementById('shuffleButton');
    const loopButton = document.getElementById('loopButton');

    // Setup event listeners
    if (playPauseButton) playPauseButton.addEventListener('click', playPauseWrapper);
    if (nextButton) nextButton.addEventListener('click', nextTrack);
    if (prevButton) prevButton.addEventListener('click', prevTrack);
    if (trackProgress) trackProgress.addEventListener('input', seekTrack);
    if (muteButton) muteButton.addEventListener('click', toggleMute);
    if (volumeControl) volumeControl.addEventListener('input', handleVolumeChange);
    if (shuffleButton) shuffleButton.addEventListener('click', toggleShuffle);
    if (loopButton) loopButton.addEventListener('click', toggleLoop);

    if (audio) {
        audio.addEventListener('timeupdate', updateProgress);
        audio.addEventListener('loadedmetadata', updateTotalTime);
        audio.addEventListener('ended', handleTrackEnd);
        audio.addEventListener('progress', updateBufferProgress);
        audio.addEventListener('playing', updatePlayingState);
        audio.addEventListener('pause', updatePausedState);
        audio.addEventListener('waiting', updateLoadingState);
    }

    renderPlaylist();
    updatePlaylistInfo();
    updatePlayerControls();
    setupKeyboardControls();
}

function initializeAudioContext() {
    if (!audioContext) {
        console.log('Initializing audio context and visualizer...');
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioContext.createMediaElementSource(audio);
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);

        source.connect(analyser);
        analyser.connect(audioContext.destination);

        visualizerCanvas = document.getElementById('visualizerCanvas');
        if (visualizerCanvas) visualizerCtx = visualizerCanvas.getContext('2d');

        if (visualizerCtx) {
            console.log('Visualizer initialized. Starting animation...');
            drawVisualizer();
        } else {
            console.warn('No visualizer context available.');
        }
    } else if (audioContext.state === 'suspended') {
        console.log('Resuming audio context...');
        audioContext.resume();
    }
}

function drawVisualizer() {
    requestAnimationFrame(drawVisualizer);
    if (!visualizerCtx || !analyser) return;

    analyser.getByteFrequencyData(dataArray);

    const width = visualizerCanvas.width = visualizerCanvas.clientWidth;
    const height = visualizerCanvas.height = visualizerCanvas.clientHeight;

    visualizerCtx.clearRect(0, 0, width, height);

    const barWidth = (width / bufferLength) * 2.5;
    let x = 0;

    // Use a bright green color so it's visible.
    visualizerCtx.fillStyle = 'rgb(0,255,0)';

    for (let i = 0; i < bufferLength; i++) {
        const barHeight = Math.min((dataArray[i] / 255.0) * height * 1.5, height);
        visualizerCtx.fillRect(x, height - barHeight, barWidth, barHeight);
        x += barWidth + 1;
    }
}

function loadTrack(index) {
    const track = playlist[index];
    if (!track) return;

    playerState = 'loading';
    updatePlayerControls();

    audio.src = track.url;
    trackTitle.textContent = track.title;
    
    const trackInfo = document.getElementById('trackInfo');
    if (trackInfo) {
        trackInfo.textContent = `Track ${currentIndex + 1} of ${playlist.length}`;
    }
    
    updateProgress();
    updateBufferProgress();
    audio.playbackRate = playbackRate;
    audio.volume = 1; // Ensure full volume for visible visualization
    audio.load();

    // Highlight the current track after loading it
    highlightCurrentTrack();
}

function renderPlaylist() {
    if (!playlistContainer) return;

    playlistContainer.innerHTML = playlist.map((track, index) => `
        <div class="py-2 px-3 flex items-center justify-between hover:bg-gray-700 transition-colors rounded-lg cursor-pointer ${
            index === currentIndex ? 'bg-gray-700' : ''
        }" onclick="selectTrack(${index})">
            <div class="flex items-center space-x-2">
                <span class="text-sm ${index === currentIndex ? 'text-blue-400' : 'text-gray-400'}">${index + 1}.</span>
                <span class="text-sm ${index === currentIndex ? 'text-white font-medium' : 'text-gray-300'}">${track.title}</span>
            </div>
            ${index === currentIndex && playerState === 'playing' 
                ? '<span class="text-blue-400">▶️</span>' 
                : ''}
        </div>
    `).join('');
    
    updatePlaylistInfo();
}

// Updated highlightCurrentTrack to explicitly manage classes
function highlightCurrentTrack() {
    if (!playlistContainer) return;

    const tracks = playlistContainer.children;

    for (let i = 0; i < tracks.length; i++) {
        const track = tracks[i];
        if (i === currentIndex) {
            // Add highlight styles for the current track
            track.classList.add('bg-gray-700'); // Background for the selected track
            const textSpan = track.querySelector('span.text-sm');
            if (textSpan) {
                textSpan.classList.add('text-white', 'font-medium'); // Bold and white text
                textSpan.classList.remove('text-gray-300'); // Remove default gray text
            }
        } else {
            // Remove highlight styles for non-selected tracks
            track.classList.remove('bg-gray-700'); // Reset background
            const textSpan = track.querySelector('span.text-sm');
            if (textSpan) {
                textSpan.classList.remove('text-white', 'font-medium'); // Reset bold and white text
                textSpan.classList.add('text-gray-300'); // Default gray text
            }
        }
    }
}


function playPauseWrapper() {
    if (!audioContext || audioContext.state === 'suspended') {
        initializeAudioContext();
    }
    playPause();
}

function playPause() {
    if (playerState === 'playing') {
        audio.pause();
        playerState = 'paused';
    } else {
        const playPromise = audio.play();
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                console.error('Playback failed:', error);
                playerState = 'paused';
                updatePlayerControls();
            });
        }
        playerState = 'playing';
    }
    updatePlayerControls();
    highlightCurrentTrack();
}

function nextTrack() {
    if (isShuffled) {
        currentIndex = Math.floor(Math.random() * playlist.length);
    } else if (currentIndex < playlist.length - 1) {
        currentIndex++;
    } else if (loopMode === 'all') {
        currentIndex = 0;
    } else {
        return;
    }

    loadTrack(currentIndex);
    audio.play();
    highlightCurrentTrack();
}

function prevTrack() {
    if (audio.currentTime > 3) {
        audio.currentTime = 0;
        return;
    }

    if (isShuffled) {
        currentIndex = Math.floor(Math.random() * playlist.length);
    } else if (currentIndex > 0) {
        currentIndex--;
    } else if (loopMode === 'all') {
        currentIndex = playlist.length - 1;
    } else {
        return;
    }

    loadTrack(currentIndex);
    audio.play();
    highlightCurrentTrack();
}


function updateProgress() {
    if (!audio.duration) return;
    
    const progress = (audio.currentTime / audio.duration) * 100;
    if (trackProgress) trackProgress.value = progress;
    const progressBar = document.getElementById('progressBar');
    if (progressBar) progressBar.style.width = `${progress}%`;
    if (currentTimeEl) currentTimeEl.textContent = formatTime(audio.currentTime);
}

function updateTotalTime() {
    if (totalTimeEl) totalTimeEl.textContent = formatTime(audio.duration);
}

function seekTrack(e) {
    const newTime = (e.target.value / 100) * audio.duration;
    if (!isNaN(newTime)) {
        audio.currentTime = newTime;
        updateProgress();
    }
}

function updateBufferProgress() {
    if (!audio.buffered.length) return;
    
    const bufferBar = document.getElementById('bufferBar');
    if (!bufferBar) return;
    
    const buffered = audio.buffered.end(audio.buffered.length - 1);
    const duration = audio.duration;
    const progress = (buffered / duration) * 100;
    bufferBar.style.width = `${progress}%`;
}

function toggleMute() {
    if (audio.volume > 0) {
        lastVolume = audio.volume;
        audio.volume = 0;
    } else {
        audio.volume = lastVolume;
    }
    updateVolumeUI();
}

function handleVolumeChange(e) {
    const volume = e.target.value / 100;
    audio.volume = volume;
    lastVolume = volume;
    updateVolumeUI();
}

function updateVolumeUI() {
    const volumeIcon = document.getElementById('volumeIcon');
    const volumeBar = document.getElementById('volumeBar');
    const volumeControl = document.getElementById('volumeControl');
    
    if (!volumeBar || !volumeControl || !volumeIcon) return;
    
    volumeBar.style.width = `${audio.volume * 100}%`;
    volumeControl.value = audio.volume * 100;
    
    if (audio.volume === 0) {
        volumeIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />`;
    } else if (audio.volume < 0.5) {
        volumeIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15zM17 14l2-2m-2 2l2 2m-2-2h.01" />`;
    } else {
        volumeIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072M18.364 5.636a9 9 0 010 12.728M12 18.012l-7-4.2V10.2l7-4.2v12.012z" />`;
    }
}

function toggleShuffle() {
    const shuffleButton = document.getElementById('shuffleButton');
    if (!shuffleButton) return;

    isShuffled = !isShuffled;
    shuffleButton.classList.toggle('text-blue-400');
    shuffleButton.title = `Shuffle ${isShuffled ? 'On' : 'Off'}`;
    
    const currentTrack = playlist[currentIndex];
    if (isShuffled) {
        playlist = shuffleArray([...playlist]);
    } else {
        playlist = [...originalPlaylist];
    }
    currentIndex = playlist.findIndex(track => track.url === currentTrack.url);
    
    renderPlaylist();
    highlightCurrentTrack();
}

function toggleLoop() {
    const loopButton = document.getElementById('loopButton');
    if (!loopButton) return;

    const modes = ['none', 'one', 'all'];
    const current = modes.indexOf(loopMode);
    loopMode = modes[(current + 1) % modes.length];
    
    loopButton.classList.toggle('text-blue-400', loopMode !== 'none');
    loopButton.title = `Loop: ${loopMode}`;
}

function handleTrackEnd() {
    if (loopMode === 'one') {
        audio.currentTime = 0;
        audio.play();
    } else if (loopMode === 'all' || isShuffled || currentIndex < playlist.length - 1) {
        nextTrack();
    } else {
        playerState = 'paused';
        updatePlayerControls();
        highlightCurrentTrack();
    }
}

function updatePlayerControls() {
    if (!playIcon) return;

    playIcon.innerHTML = playerState === 'playing'
        ? `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6" />`
        : `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3l14 9-14 9V3z" />`;
    
    if (prevButton && nextButton) {
        prevButton.disabled = currentIndex === 0 && !isShuffled && loopMode === 'none';
        nextButton.disabled = currentIndex === playlist.length - 1 && !isShuffled && loopMode === 'none';
        
        [prevButton, nextButton].forEach(button => {
            if (button.disabled) {
                button.classList.add('opacity-50', 'cursor-not-allowed');
            } else {
                button.classList.remove('opacity-50', 'cursor-not-allowed');
            }
        });
    }
}

function updatePlayingState() {
    playerState = 'playing';
    updatePlayerControls();
    highlightCurrentTrack();
}

function updatePausedState() {
    playerState = 'paused';
    updatePlayerControls();
    highlightCurrentTrack();
}

function updateLoadingState() {
    playerState = 'loading';
    updatePlayerControls();
}

function selectTrack(index) {
    // Initialize the audio context on first interaction
    if (!audioContext || audioContext.state === 'suspended') {
        initializeAudioContext();
    }

    // If the user clicks on the currently playing track, toggle play/pause
    if (index === currentIndex && playerState === 'playing') {
        playPause();
        return;
    }

    // Update the current index and load the new track
    currentIndex = index;
    loadTrack(currentIndex);

    // Automatically play the selected track
    audio.play();
    playerState = 'playing';

    // Update the UI to reflect the changes
    updatePlayerControls();
    highlightCurrentTrack();
}

function updatePlaylistInfo() {
    const playlistInfo = document.getElementById('playlistInfo');
    if (playlistInfo) playlistInfo.textContent = `${playlist.length} tracks`;
}

function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function shuffleArray(array) {
    const newArr = [...array];
    for (let i = newArr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
    }
    return newArr;
}

function setupKeyboardControls() {
    document.addEventListener('keydown', (e) => {
        const cp = document.getElementById('custom-player');
        if (!cp || cp.classList.contains('hidden')) return;
        
        switch(e.key.toLowerCase()) {
            case ' ':
            case 'k':
                e.preventDefault();
                playPauseWrapper();
                break;
            case 'arrowright':
                e.preventDefault();
                audio.currentTime = Math.min(audio.currentTime + 5, audio.duration);
                break;
            case 'arrowleft':
                e.preventDefault();
                audio.currentTime = Math.max(audio.currentTime - 5, 0);
                break;
            case 'j':
                e.preventDefault();
                audio.currentTime = Math.max(audio.currentTime - 10, 0);
                break;
            case 'l':
                e.preventDefault();
                audio.currentTime = Math.min(audio.currentTime + 10, audio.duration);
                break;
            case 'm':
                e.preventDefault();
                toggleMute();
                break;
            case 'n':
                e.preventDefault();
                nextTrack();
                break;
            case 'p':
                e.preventDefault();
                prevTrack();
                break;
        }
    });
}

// Add these new functions
function handleSearchClick() {
    const searchInput = document.getElementById('searchQuery');
    if (searchInput) {
        searchInput.blur(); // Close the keyboard on mobile
        searchShows(1);
    }
}

function handleSearchKeyPress(event) {
    if (event.key === 'Enter') {
        event.preventDefault(); // Prevent default form submission
        const searchInput = document.getElementById('searchQuery');
        if (searchInput) {
            searchInput.blur(); // Close the keyboard
            searchShows(1);
        }
    }
}

// Updated DOMContentLoaded listener
document.addEventListener('DOMContentLoaded', function() {
    const isPlayerPage = window.location.pathname.includes('player.html');
    
    if (isPlayerPage) {
        initializePlayer();
    } else {
        const searchQuery = document.getElementById('searchQuery');
        const yearFrom = document.getElementById('yearFrom');
        const yearTo = document.getElementById('yearTo');
        const filterButtons = document.querySelectorAll('[data-filter]');
        const searchButton = document.getElementById('searchButton');
        
        if (yearFrom) yearFrom.value = '1965';
        if (yearTo) yearTo.value = '1995';
        
        // Add search button click handler
        if (searchButton) {
            searchButton.addEventListener('click', handleSearchClick);
        }
        
        // Add keyboard handler for search input
        if (searchQuery) {
            searchQuery.addEventListener('keydown', handleSearchKeyPress);
        }
        
        // Year input handlers
        if (yearFrom) yearFrom.addEventListener('change', () => searchShows(1));
        if (yearTo) yearTo.addEventListener('change', () => searchShows(1));
        
        // Filter button handlers
        filterButtons.forEach(button => {
            button.addEventListener('click', function() {
                const wasActive = this.classList.contains('bg-blue-500');
                
                filterButtons.forEach(btn => {
                    btn.classList.remove('bg-blue-500', 'text-white');
                    btn.classList.add('bg-gray-700', 'text-gray-100');
                });
                
                if (!wasActive) {
                    this.classList.remove('bg-gray-700');
                    this.classList.add('bg-blue-500');
                }
                
                searchShows(1);
            });
        });
        
        // Pagination handlers
        const prevPage = document.getElementById('prevPage');
        const nextPage = document.getElementById('nextPage');
        if (prevPage) prevPage.addEventListener('click', () => changePage(-1));
        if (nextPage) nextPage.addEventListener('click', () => changePage(1));
        
        // Initial search and render
        searchShows(1);
        renderRecentlyViewed();
    }
});
