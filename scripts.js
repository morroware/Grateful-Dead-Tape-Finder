// scripts.js

// ---_> GLOBAL VARIABLES <---

// --- Search & General UI ---
let currentPage = 1;
const resultsPerPage = 10;
let totalResults = 0;
// Safely initialize `recentlyViewed` from localStorage.
let recentlyViewed = JSON.parse(localStorage.getItem('recentlyViewed') || '[]');

// --- Player State ---
let playlist = [];          // The current list of tracks (can be shuffled).
let originalPlaylist = [];  // An unmodified copy of the playlist to restore from shuffle.
let currentIndex = 0;       // Index of the currently loaded track in the `playlist` array.
let isShuffled = false;     // Flag for shuffle mode.
let loopMode = 'none';      // 'none', 'one' (loop current track), or 'all' (loop playlist).
let lastVolume = 1;         // Stores the volume level before muting.
let playbackRate = 1;       // Playback speed.
let playerState = 'paused'; // 'paused', 'playing', or 'loading'.

// --- DOM Element References (Player) ---
let audio, trackTitle, playPauseButton, prevButton, nextButton, trackProgress;
let currentTimeEl, totalTimeEl, playlistContainer, playIcon;

// --- Web Audio API for Visualizer ---
let audioContext, analyser, dataArray, bufferLength;
let visualizerCanvas, visualizerCtx;


// ---_> INITIALIZATION & SETUP <---

/**
 * Self-executing function to safely initialize the `recentlyViewed` array from localStorage.
 * Handles potential JSON parsing errors by resetting the data.
 */
(function() {
    try {
        const raw = localStorage.getItem('recentlyViewed') || '[]';
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            recentlyViewed = parsed;
        } else {
            throw new Error('Data is not an array');
        }
    } catch {
        console.error('Invalid `recentlyViewed` data in localStorage; resetting.');
        localStorage.removeItem('recentlyViewed');
        recentlyViewed = [];
    }
})();

/**
 * Main entry point, executed when the DOM is fully loaded.
 * Determines whether to initialize the search page or the player page based on the URL.
 */
document.addEventListener('DOMContentLoaded', function() {
    const isPlayerPage = window.location.pathname.includes('player.html');

    if (isPlayerPage) {
        // --- Player Page Initialization ---
        try {
            // Reset player state variables to prevent issues when navigating between shows.
            playlist = [];
            currentIndex = 0;
            isShuffled = false;
            loopMode = 'none';
            playerState = 'paused';
            initializePlayer();
        } catch (error) {
            console.error('Fatal error initializing player page:', error);
            const pw = document.getElementById('player-wrapper');
            if (pw) {
                pw.innerHTML = `
                    <div class="bg-red-800 text-white p-4 rounded-lg">
                        <h3 class="font-bold">Error Loading Player</h3>
                        <p class="mt-2">${error.message || 'Unknown error'}</p>
                        <a href="index.html" class="underline text-blue-300">Return to Search</a>
                    </div>`;
            }
        }
    } else {
        // --- Search Page Initialization ---
        setupSearchPageListeners();
        // Load the previously selected band from localStorage, if available.
        const bandSelector = document.getElementById('bandSelector');
        if (bandSelector) {
            const savedBand = localStorage.getItem('selectedBand');
            if (savedBand) {
                bandSelector.value = savedBand;
            }
            // Add listener to save band selection for persistence.
            bandSelector.addEventListener('change', function() {
                localStorage.setItem('selectedBand', this.value);
                currentPage = 1; // Reset to page 1 when band changes.
                searchShows(1);
            });
        }
        // Initial search and rendering.
        searchShows(1);
        renderRecentlyViewed();
    }
});

/**
 * Attaches all necessary event listeners for the search page controls.
 */
function setupSearchPageListeners() {
    const searchButton = document.getElementById('searchButton');
    const searchQuery = document.getElementById('searchQuery');
    const yearFrom = document.getElementById('yearFrom');
    const yearTo = document.getElementById('yearTo');
    const bandSelector = document.getElementById('bandSelector');
    const filterButtons = document.querySelectorAll('[data-filter]');
    const prevPage = document.getElementById('prevPage');
    const nextPage = document.getElementById('nextPage');

    // Set default year range values.
    if (yearFrom) yearFrom.value = '1965';
    if (yearTo) yearTo.value = '2025';

    if (searchButton) searchButton.addEventListener('click', handleSearchClick);
    if (searchQuery) searchQuery.addEventListener('keydown', handleSearchKeyPress);
    if (yearFrom) yearFrom.addEventListener('change', () => searchShows(1));
    if (yearTo) yearTo.addEventListener('change', () => searchShows(1));
    if (bandSelector) bandSelector.addEventListener('change', () => searchShows(1));
    if (prevPage) prevPage.addEventListener('click', () => changePage(-1));
    if (nextPage) nextPage.addEventListener('click', () => changePage(1));

    // Add listeners for filter buttons (SBD, AUD, etc.).
    filterButtons.forEach(button => {
        button.addEventListener('click', function() {
            const wasActive = this.classList.contains('bg-blue-500');
            // Deactivate all other buttons.
            filterButtons.forEach(btn => {
                btn.classList.remove('bg-blue-500', 'text-white');
                btn.classList.add('bg-gray-700', 'text-gray-100');
            });
            // Toggle the clicked button.
            if (!wasActive) {
                this.classList.remove('bg-gray-700');
                this.classList.add('bg-blue-500', 'text-white');
            }
            searchShows(1);
        });
    });
}


// ---_> SEARCH PAGE LOGIC <---

/**
 * Fetches show data from the Internet Archive API based on user inputs.
 * @param {number} [page=1] - The page number of results to fetch.
 */
async function searchShows(page = 1) {
    const searchQueryInput = document.getElementById('searchQuery');
    const yearFromInput = document.getElementById('yearFrom');
    const yearToInput = document.getElementById('yearTo');
    const bandSelector = document.getElementById('bandSelector');

    const query = searchQueryInput ? searchQueryInput.value : '';
    const yearFrom = yearFromInput ? yearFromInput.value : '';
    const yearTo = yearToInput ? yearToInput.value : '';
    const band = bandSelector ? bandSelector.value : 'GratefulDead';
    
    showLoading();
    currentPage = page;
    
    // Construct the base query and title based on the selected band.
    let baseQuery = '';
    let bandTitle = '';
    
    // This switch statement maps the dropdown value to a specific Archive.org collection query.
    switch(band) {
        // Dead Family
        case 'GratefulDead':
            baseQuery = 'collection:(GratefulDead) AND mediatype:(etree) AND creator:(Grateful Dead)';
            bandTitle = 'Grateful Dead';
            break;
        case 'PhilLesh':
            baseQuery = 'collection:(PhilLeshandFriends) AND mediatype:(etree)';
            bandTitle = 'Phil Lesh & Friends';
            break;
        case 'JerryGarciaBand':
            baseQuery = 'collection:(etree) AND creator:("Jerry Garcia Band" OR "JGB")';
            bandTitle = 'Jerry Garcia Band';
            break;
        case 'RatDog':
            baseQuery = 'collection:(etree) AND creator:("Ratdog" OR "Bob Weir and Ratdog")';
            bandTitle = 'Ratdog';
            break;
        case 'BobWeir':
            baseQuery = 'collection:(etree) AND creator:("Bob Weir") -creator:("Bob Weir and Ratdog")';
            bandTitle = 'Bob Weir';
            break;
        case 'DeadAndCompany':
            baseQuery = 'collection:(etree) AND creator:("Dead and Company" OR "Dead & Company")';
            bandTitle = 'Dead & Company';
            break;
        case 'TheDead':
            baseQuery = 'collection:(TheDead) AND mediatype:(etree)';
            bandTitle = 'The Dead';
            break;
       case 'Other':
            if (query) {
                baseQuery = `${query} AND mediatype:"etree"`;
            } else {
                baseQuery = `mediatype:"etree"`;
            }
            bandTitle = 'Custom Search';
            break;
        case 'MelvinSeals':
            baseQuery = 'collection:(MelvinSeals) AND mediatype:(etree)';
            bandTitle = 'Melvin Seals';
            break;
        case 'Furthur':
            baseQuery = 'collection:(Furthur) AND mediatype:(etree)';
            bandTitle = 'Furthur';
            break;
        case 'JohnKadlecik':
            baseQuery = 'collection:(JohnKadlecik) AND mediatype:(etree)';
            bandTitle = 'John Kadlecik';
            break;
        case 'DarkStar':
            baseQuery = 'collection:(DarkStarOrchestra) AND mediatype:(etree)';
            bandTitle = 'Dark Star Orchestra';
            break;
        case 'JRAD':
            baseQuery = 'collection:(JoeRussosAlmostDead) AND mediatype:(etree)';
            bandTitle = 'Joe Russo\'s Almost Dead';
            break;
        case 'BillyAndTheKids':
            baseQuery = 'collection:(BillyAndTheKids) AND mediatype:(etree)';
            bandTitle = 'Billy and the Kids';
            break;
        case 'JerrysMiddleFinger':
            baseQuery = 'collection:(JerrysMiddleFinger) AND mediatype:(etree)';
            bandTitle = 'Jerry\'s Middle Finger';
            break;
        case 'RobertHunter':
            baseQuery = 'collection:(RobertHunter) AND mediatype:(etree)';
            bandTitle = 'Robert Hunter';
            break;
        case 'MickeyHartBand':
            baseQuery = 'collection:(MickeyHartBand) AND mediatype:(etree)';
            bandTitle = 'Mickey Hart Band';
            break;
        case 'BillKreutzmannProjects':
            baseQuery = 'collection:(BillKreutzmannProjects) AND mediatype:(etree)';
            bandTitle = 'Bill Kreutzmann Projects';
            break;
        case 'StuAllenandMarsHotel':
            baseQuery = 'collection:(StuAllenandMarsHotel) AND mediatype:(etree)';
            bandTitle = 'Stu Allen and Mars Hotel';
            break;
        case '7Walkers':
            baseQuery = 'collection:(7Walkers) AND mediatype:(etree)';
            bandTitle = '7 Walkers';
            break;
        case 'DavidNelsonBand':
            baseQuery = 'collection:(DavidNelsonBand) AND mediatype:(etree)';
            bandTitle = 'David Nelson Band';
            break;
        case 'MarkKaran':
            baseQuery = 'collection:(MarkKaran) AND mediatype:(etree)';
            bandTitle = 'Mark Karan';
            break;
        case 'OteilAndFriends':
            baseQuery = 'collection:(OteilAndFriends) AND mediatype:(etree)';
            bandTitle = 'Oteil and Friends';
            break;
        case 'GhostLightBand':
            baseQuery = 'collection:(GhostLightBand) AND mediatype:(etree)';
            bandTitle = 'Ghost Light Band';
            break;
            
        // Jam Bands
        case 'DiscoBiscuits':
            baseQuery = 'collection:(DiscoBiscuits) AND mediatype:(etree)';
            bandTitle = 'Disco Biscuits';
            break;
        case 'DiscoBiscuitsSideProjects':
            baseQuery = 'collection:(DiscoBiscuitsSideProjects) AND mediatype:(etree)';
            bandTitle = 'Disco Biscuits Side Projects';
            break;
        case 'StringCheese':
            baseQuery = 'collection:(StringCheeseIncident) AND mediatype:(etree)';
            bandTitle = 'String Cheese Incident';
            break;
        case 'SoundTribeSector9':
            baseQuery = 'collection:(SoundTribeSector9) AND mediatype:(etree)';
            bandTitle = 'Sound Tribe Sector 9';
            break;
        case 'moe':
            baseQuery = 'collection:(moe) AND mediatype:(etree)';
            bandTitle = 'moe.';
            break;
        case 'UmphreysMcGee':
            baseQuery = 'collection:(UmphreysMcGee) AND mediatype:(etree)';
            bandTitle = 'Umphrey\'s McGee';
            break;
        case 'Goose':
            baseQuery = 'collection:(GooseBand) AND mediatype:(etree)';
            bandTitle = 'Goose';
            break;
        case 'WidespreadPanic':
            baseQuery = 'mediatype:(etree) AND (title:"Widespread Panic" OR creator:"Widespread Panic" OR description:"Widespread Panic")';
            bandTitle = 'Widespread Panic';
            break;
        case 'MaxCreek':
            baseQuery = 'collection:(MaxCreek) AND mediatype:(etree)';
            bandTitle = 'Max Creek';
            break;
        case 'MMW':
            baseQuery = 'mediatype:(etree) AND (title:"Medeski Martin" OR creator:"Medeski Martin" OR identifier:mmw OR identifier:medeski)';
            bandTitle = 'Medeski Martin & Wood';
            break;
        case 'Ween':
            baseQuery = 'collection:(Ween) AND mediatype:(etree)';
            bandTitle = 'Ween';
            break;
        case 'KingGizzard':
            baseQuery = 'collection:(KingGizzardAndTheLizardWizard) AND mediatype:(etree)';
            bandTitle = 'King Gizzard & The Lizard Wizard';
            break;
        case 'NMAS':
            baseQuery = 'collection:(NorthMississippiAllstars) AND mediatype:(etree)';
            bandTitle = 'North Mississippi Allstars';
            break;
        case 'NRPS':
            baseQuery = 'collection:(NewRidersofthePurpleSage) AND mediatype:(etree)';
            bandTitle = 'New Riders of the Purple Sage';
            break;
        case 'LittleFeat':
            baseQuery = 'collection:(LittleFeat) AND mediatype:(etree)';
            bandTitle = 'Little Feat';
            break;
        case 'InfamousStringdusters':
            baseQuery = 'collection:(InfamousStringdusters) AND mediatype:(etree)';
            bandTitle = 'Infamous Stringdusters';
            break;
        case 'Zero':
            baseQuery = 'collection:(Zero) AND mediatype:(etree)';
            bandTitle = 'Zero';
            break;
        case 'Twiddle':
            baseQuery = 'collection:(Twiddle) AND mediatype:(etree)';
            bandTitle = 'Twiddle';
            break;
        case 'PerpetualGroove':
            baseQuery = 'collection:(PerpetualGroove) AND mediatype:(etree)';
            bandTitle = 'Perpetual Groove';
            break;
        case 'Strangefolk':
            baseQuery = 'collection:(Strangefolk) AND mediatype:(etree)';
            bandTitle = 'Strangefolk';
            break;
        case 'Cabinet':
            baseQuery = 'collection:(Cabinet) AND mediatype:(etree)';
            bandTitle = 'Cabinet';
            break;
        case 'SteveKimock':
            baseQuery = 'collection:(SteveKimock) AND mediatype:(etree)';
            bandTitle = 'Steve Kimock';
            break;
        case 'SteveKimockBand':
            baseQuery = 'collection:(SteveKimockBand) AND mediatype:(etree)';
            bandTitle = 'Steve Kimock Band';
            break;
        case 'BuiltToSpill':
            baseQuery = 'collection:(BuiltToSpill) AND mediatype:(etree)';
            bandTitle = 'Built To Spill';
            break;
        case 'WarrenZevon':
            baseQuery = 'collection:(WarrenZevon) AND mediatype:(etree)';
            bandTitle = 'Warren Zevon';
            break;
        case 'JackieGreene':
            baseQuery = 'collection:(JackieGreene) AND mediatype:(etree)';
            bandTitle = 'Jackie Greene';
            break;
        case 'PinkTalkingFish':
            baseQuery = 'collection:(PinkTalkingFish) AND mediatype:(etree)';
            bandTitle = 'Pink Talking Fish';
            break;
        case 'BelaFleckandtheFlecktones':
            baseQuery = 'collection:(BelaFleckandtheFlecktones) AND mediatype:(etree)';
            bandTitle = 'Bela Fleck and the Flecktones';
            break;
        case 'Lotus':
            baseQuery = 'collection:(Lotus) AND mediatype:(etree)';
            bandTitle = 'Lotus';
            break;
        case '311':
            baseQuery = 'collection:(311) AND mediatype:(etree)';
            bandTitle = '311';
            break;
        case 'OfARevolution':
            baseQuery = 'collection:(OfARevolution) AND mediatype:(etree)';
            bandTitle = 'O.A.R.';
            break;
        case 'Dopapod':
            baseQuery = 'collection:(Dopapod) AND mediatype:(etree)';
            bandTitle = 'Dopapod';
            break;
        case 'CamperVanBeethoven':
            baseQuery = 'collection:(CamperVanBeethoven) AND mediatype:(etree)';
            bandTitle = 'Camper Van Beethoven';
            break;
        case 'Spafford':
            baseQuery = 'collection:(Spafford) AND mediatype:(etree)';
            bandTitle = 'Spafford';
            break;
        case 'MarcusKingBand':
            baseQuery = 'collection:(MarcusKingBand) AND mediatype:(etree)';
            bandTitle = 'Marcus King Band';
            break;
        case 'JackJohnson':
            baseQuery = 'collection:(JackJohnson) AND mediatype:(etree)';
            bandTitle = 'Jack Johnson';
            break;
        case 'MeatPuppets':
            baseQuery = 'collection:(MeatPuppets) AND mediatype:(etree)';
            bandTitle = 'Meat Puppets';
            break;
        case 'PigeonsPlayingPingPong':
            baseQuery = 'collection:(PigeonsPlayingPingPong) AND mediatype:(etree)';
            bandTitle = 'Pigeons Playing Ping Pong';
            break;
        case 'Matisyahu':
            baseQuery = 'collection:(Matisyahu) AND mediatype:(etree)';
            bandTitle = 'Matisyahu';
            break;
        case 'MarcoBenevento':
            baseQuery = 'collection:(MarcoBenevento) AND mediatype:(etree)';
            bandTitle = 'Marco Benevento';
            break;
        case 'EggyMusic':
            baseQuery = 'collection:(EggyMusic) AND mediatype:(etree)';
            bandTitle = 'Eggy';
            break;
        case 'GreyboyAllstars':
            baseQuery = 'collection:(GreyboyAllstars) AND mediatype:(etree)';
            bandTitle = 'Greyboy Allstars';
            break;
        case 'Soulive':
            baseQuery = 'collection:(Soulive) AND mediatype:(etree)';
            bandTitle = 'Soulive';
            break;
        case 'Dumpstaphunk':
            baseQuery = 'collection:(Dumpstaphunk) AND mediatype:(etree)';
            bandTitle = 'Dumpstaphunk';
            break;
        case 'MichaelFrantiandSpearhead':
            baseQuery = 'collection:(MichaelFrantiandSpearhead) AND mediatype:(etree)';
            bandTitle = 'Michael Franti and Spearhead';
            break;
        case 'KungFuband':
            baseQuery = 'collection:(KungFuband) AND mediatype:(etree)';
            bandTitle = 'Kung Fu';
            break;
        case 'Vulfpeck':
            baseQuery = 'collection:(Vulfpeck) AND mediatype:(etree)';
            bandTitle = 'Vulfpeck';
            break;
        case 'JJGreyandMOFRO':
            baseQuery = 'collection:(JJGreyandMOFRO) AND mediatype:(etree)';
            bandTitle = 'JJ Grey and MOFRO';
            break;
        case 'TheMotet':
            baseQuery = 'collection:(TheMotet) AND mediatype:(etree)';
            bandTitle = 'The Motet';
            break;
        case 'AquariumRescueUnit':
            baseQuery = 'collection:(AquariumRescueUnit) AND mediatype:(etree)';
            bandTitle = 'Aquarium Rescue Unit';
            break;
        case 'DerekTrucksBand':
            baseQuery = 'collection:(DerekTrucksBand) AND mediatype:(etree)';
            bandTitle = 'Derek Trucks Band';
            break;
        case 'RyanMontbleau':
            baseQuery = 'collection:(RyanMontbleau) AND mediatype:(etree)';
            bandTitle = 'Ryan Montbleau';
            break;
        case 'TheNational':
            baseQuery = 'collection:(TheNational) AND mediatype:(etree)';
            bandTitle = 'The National';
            break;
        case 'JasonMraz':
            baseQuery = 'collection:(JasonMraz) AND mediatype:(etree)';
            bandTitle = 'Jason Mraz';
            break;
        case 'JeffersonStarship':
            baseQuery = 'collection:(JeffersonStarship) AND mediatype:(etree)';
            bandTitle = 'Jefferson Starship';
            break;
        case 'GalacticFunk':
            baseQuery = 'collection:(GalacticFunk) AND mediatype:(etree)';
            bandTitle = 'Galactic Funk';
            break;
        case 'HollyBowling':
            baseQuery = 'collection:(HollyBowling) AND mediatype:(etree)';
            bandTitle = 'Holly Bowling';
            break;
        case 'G.LoveandSpecialSauce':
            baseQuery = 'collection:(G.LoveandSpecialSauce) AND mediatype:(etree)';
            bandTitle = 'G. Love and Special Sauce';
            break;
        case 'DeepBananaBlackout':
            baseQuery = 'collection:(DeepBananaBlackout) AND mediatype:(etree)';
            bandTitle = 'Deep Banana Blackout';
            break;
        case 'Blackberry_Smoke':
            baseQuery = 'collection:(Blackberry_Smoke) AND mediatype:(etree)';
            bandTitle = 'Blackberry Smoke';
            break;
        case 'TheNewDeal':
            baseQuery = 'collection:(TheNewDeal) AND mediatype:(etree)';
            bandTitle = 'The New Deal';
            break;
        case 'LarryKeel':
            baseQuery = 'collection:(LarryKeel) AND mediatype:(etree)';
            bandTitle = 'Larry Keel';
            break;
        case 'JeffAustinBand':
            baseQuery = 'collection:(JeffAustinBand) AND mediatype:(etree)';
            bandTitle = 'Jeff Austin Band';
            break;
        case 'Turkuaz':
            baseQuery = 'collection:(Turkuaz) AND mediatype:(etree)';
            bandTitle = 'Turkuaz';
            break;
        case 'CirclesAroundTheSun':
            baseQuery = 'collection:(CirclesAroundTheSun) AND mediatype:(etree)';
            bandTitle = 'Circles Around The Sun';
            break;
        case 'Particle':
            baseQuery = 'collection:(Particle) AND mediatype:(etree)';
            bandTitle = 'Particle';
            break;
        case 'Fishbone':
            baseQuery = 'collection:(Fishbone) AND mediatype:(etree)';
            bandTitle = 'Fishbone';
            break;
        case 'AnimalCollective':
            baseQuery = 'collection:(AnimalCollective) AND mediatype:(etree)';
            bandTitle = 'Animal Collective';
            break;
        case 'SpinDoctors':
            baseQuery = 'collection:(SpinDoctors) AND mediatype:(etree)';
            bandTitle = 'Spin Doctors';
            break;
        case 'RobertRandolphandtheFamilyBand':
            baseQuery = 'collection:(RobertRandolphandtheFamilyBand) AND mediatype:(etree)';
            bandTitle = 'Robert Randolph and the Family Band';
            break;
        case 'TheGourds':
            baseQuery = 'collection:(TheGourds) AND mediatype:(etree)';
            bandTitle = 'The Gourds';
            break;
        case 'Spoon':
            baseQuery = 'collection:(Spoon) AND mediatype:(etree)';
            bandTitle = 'Spoon';
            break;
        case 'MartinSexton':
            baseQuery = 'collection:(MartinSexton) AND mediatype:(etree)';
            bandTitle = 'Martin Sexton';
            break;
        case 'TenaciousD':
            baseQuery = 'collection:(TenaciousD) AND mediatype:(etree)';
            bandTitle = 'Tenacious D';
            break;
        case 'EricKrasno':
            baseQuery = 'collection:(EricKrasno) AND mediatype:(etree)';
            bandTitle = 'Eric Krasno';
            break;
        case 'BlindMelon':
            baseQuery = 'collection:(BlindMelon) AND mediatype:(etree)';
            bandTitle = 'Blind Melon';
            break;
        case 'RustedRoot':
            baseQuery = 'collection:(RustedRoot) AND mediatype:(etree)';
            bandTitle = 'Rusted Root';
            break;
        case 'Dispatch':
            baseQuery = 'collection:(Dispatch) AND mediatype:(etree)';
            bandTitle = 'Dispatch';
            break;
        case 'Buckethead':
            baseQuery = 'collection:(Buckethead) AND mediatype:(etree)';
            bandTitle = 'Buckethead';
            break;
        case 'MichalaDavis':
            baseQuery = 'collection:(MikaelaDavis) AND mediatype:(etree)';
            bandTitle = 'Mikaela Davis';
            break;
            
        // Bluegrass/Acoustic
        case 'BillyStrings':
            baseQuery = 'collection:(BillyStrings) AND mediatype:(etree)';
            bandTitle = 'Billy Strings';
            break;
        case 'GreenskyBluegrass':
            baseQuery = 'collection:(GreenskyBluegrass) AND mediatype:(etree)';
            bandTitle = 'Greensky Bluegrass';
            break;
        case 'YonderMountain':
            baseQuery = 'collection:(YonderMountainStringBand) AND mediatype:(etree)';
            bandTitle = 'Yonder Mountain String Band';
            break;
        case 'LeftoverSalmon':
            baseQuery = 'collection:(LeftoverSalmon) AND mediatype:(etree)';
            bandTitle = 'Leftover Salmon';
            break;
        case 'DelMcCouryBand':
            baseQuery = 'collection:(DelMcCouryBand) AND mediatype:(etree)';
            bandTitle = 'Del McCoury Band';
            break;
        case 'HotButteredRum':
            baseQuery = 'collection:(HotButteredRum) AND mediatype:(etree)';
            bandTitle = 'Hot Buttered Rum';
            break;
        case 'RumpkeMountainBoys':
            baseQuery = 'collection:(RumpkeMountainBoys) AND mediatype:(etree)';
            bandTitle = 'Rumpke Mountain Boys';
            break;
        case 'KitchenDwellers':
            baseQuery = 'collection:(KitchenDwellers) AND mediatype:(etree)';
            bandTitle = 'Kitchen Dwellers';
            break;
        case 'SteepCanyonRangers':
            baseQuery = 'collection:(SteepCanyonRangers) AND mediatype:(etree)';
            bandTitle = 'Steep Canyon Rangers';
            break;
        case 'TrampledbyTurtles':
            baseQuery = 'collection:(TrampledbyTurtles) AND mediatype:(etree)';
            bandTitle = 'Trampled by Turtles';
            break;
        
        // Other/Funk/Rock
        case 'Lettuce':
            baseQuery = 'collection:(Lettuce) AND mediatype:(etree)';
            bandTitle = 'Lettuce';
            break;
        case 'GracePotterandtheNocturnals':
            baseQuery = 'collection:(GracePotterandtheNocturnals) AND mediatype:(etree)';
            bandTitle = 'Grace Potter and the Nocturnals';
            break;
            
        default:
            baseQuery = 'collection:(GratefulDead) AND mediatype:(etree) AND creator:(Grateful Dead)';
            bandTitle = 'Grateful Dead';
    }
    
    // Update the page title and header to reflect the current search.
    updatePageTitles(bandTitle);
    
    // Append additional filters to the query.
    if (band !== 'Other' && query) {
        baseQuery += ` AND (${query})`;
    }
    if (yearFrom) {
        baseQuery += ` AND year:[${yearFrom} TO ${yearTo || '2025'}]`;
    }

    const activeFilter = document.querySelector('[data-filter].bg-blue-500');
    if (activeFilter) {
        const f = activeFilter.dataset.filter;
        if (f === 'five-star')   baseQuery += ' AND avg_rating:[4.5 TO 5]';
        else if (f === 'soundboard') baseQuery += ' AND source:(soundboard OR sbd)';
        else if (f === 'aud')         baseQuery += ' AND source:(audience OR aud)';
        else if (f === 'matrix')      baseQuery += ' AND (source:matrix)';
    }

    console.log('Archive API Query:', baseQuery);

    // Perform the API request.
    try {
        const resp = await fetch(`https://archive.org/advancedsearch.php?` +
            `q=${encodeURIComponent(baseQuery)}` +
            `&fl[]=identifier,title,year,venue,coverage,downloads,source` +
            `&sort[]=downloads+desc&output=json` +
            `&rows=${resultsPerPage}&page=${page}`);
        const data = await resp.json();
        
        hideLoading();
        const resultsDiv = document.getElementById('results');
        
        if (!data.response.docs.length) {
            if (resultsDiv) resultsDiv.innerHTML = `<p class="text-center text-gray-400 my-8">No shows found for ${bandTitle}.</p>`;
            totalResults = 0;
        } else {
            totalResults = data.response.numFound;
            if (resultsDiv) resultsDiv.innerHTML = data.response.docs.map(createShowCard).join('');
        }
        updatePagination();
    } catch (error) {
        console.error('Search error:', error);
        hideLoading();
        const resultsDiv = document.getElementById('results');
        if (resultsDiv) resultsDiv.innerHTML = `<p class="text-center text-red-500 my-8">An error occurred while searching. Please try again later.</p>`;
    }
}

/**
 * Creates the HTML string for a single show card in the search results.
 * @param {object} show - The show data object from the API.
 * @returns {string} The HTML string for the show card.
 */
function createShowCard(show) {
    const src = show.source ? show.source.toLowerCase() : '';
    const isSbd = src.includes('soundboard') || src.includes('sbd');
    const isAud = src.includes('audience')   || src.includes('aud');
    const isMx  = src.includes('matrix');
    let tags = '';
    if (isSbd) tags += `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-900 text-green-100 mr-1">SBD</span>`;
    if (isAud) tags += `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-900 text-yellow-100 mr-1">AUD</span>`;
    if (isMx)  tags += `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-900 text-purple-100">MATRIX</span>`;
    
    return `
        <div class="glass-card p-6 mb-4 cursor-pointer transition-transform transform hover:scale-105"
             onclick="openPlayerPage('${show.identifier}')">
            <div class="flex justify-between items-start">
                <div>
                    <h3 class="text-lg font-semibold text-gray-100">${show.title}</h3>
                    <div class="mt-1">${tags || '&nbsp;'}</div>
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

/**
 * Updates the pagination controls (page info, prev/next buttons).
 */
function updatePagination() {
    const totalPages = Math.ceil(totalResults / resultsPerPage);
    const pageInfo = document.getElementById('pageInfo');
    const prevPage = document.getElementById('prevPage');
    const nextPage = document.getElementById('nextPage');

    if (pageInfo) pageInfo.textContent = `Page ${currentPage} of ${totalPages > 0 ? totalPages : 1}`;
    if (prevPage) prevPage.disabled = currentPage === 1;
    if (nextPage) nextPage.disabled = currentPage >= totalPages;
}


// ---_> PLAYER PAGE LOGIC <---

/**
 * Initializes the player by fetching show metadata from Archive.org.
 */
async function initializePlayer() {
    const params = new URLSearchParams(window.location.search);
    const identifier = params.get('id');

    if (!identifier) {
        document.getElementById('player-wrapper').innerHTML = `<p class="text-center text-red-500">No show ID provided. Please return to the search page.</p>`;
        return;
    }

    document.getElementById('show-title').textContent = 'Loading Show Details...';

    try {
        const resp = await fetch(`https://archive.org/metadata/${identifier}`);
        if (!resp.ok) throw new Error(`Failed to fetch metadata (Status ${resp.status})`);
        const data = await resp.json();

        // Dynamically determine the band name for the page title.
        let bandName = data.metadata.creator || 'Unknown Artist';
        document.title = `${bandName}: ${data.metadata.title || 'Show Player'}`;
        document.getElementById('show-title').textContent = data.metadata.title || 'Unknown Show';
        document.getElementById('archive-link').href = `https://archive.org/details/${identifier}`;

        updateShowInfo(data);
        updateRecentlyViewed({ identifier, title: data.metadata.title });

        // Filter for playable MP3 files and create the playlist.
        const audioFiles = data.files.filter(f => f.format && f.format.toLowerCase().includes('mp3') && f.name);
        if (!audioFiles.length) throw new Error('No playable MP3 files found for this show.');
        
        playlist = audioFiles.map(f => ({
            title: f.title || f.name.replace(/_/g, ' ').replace(/\.mp3/i, ''),
            url: `https://archive.org/download/${identifier}/${encodeURIComponent(f.name)}`
        }));
        originalPlaylist = [...playlist];

        // If `window.currentIndex` was set by the inline script, use it. Otherwise, start at 0.
        currentIndex = window.currentIndex && window.currentIndex < playlist.length ? window.currentIndex : 0;
        
        // Setup the player UI and load the first track.
        setupPlayerUI();
        initializeAudioContext();
        loadTrack(currentIndex);

    } catch (error) {
        console.error('Error initializing player:', error);
        document.getElementById('player-wrapper').innerHTML = `
            <div class="bg-red-800 text-white p-4 rounded-lg">
                <h3 class="font-bold">Error Loading Player</h3>
                <p class="mt-2">${error.message}</p>
                <a href="index.html" class="underline text-blue-300 mt-2 inline-block">Return to Search</a>
            </div>`;
    }
}


/**
 * Populates the UI with detailed information about the show.
 * @param {object} data - The metadata object from the API.
 */
function updateShowInfo(data) {
    const si = document.getElementById('show-info');
    if (si) {
        si.innerHTML = `
            <h2 class="text-xl font-semibold mb-4 text-gray-100">Show Details</h2>
            <p class="text-gray-300"><strong>Date:</strong> ${data.metadata.date || 'N/A'}</p>
            <p class="text-gray-300"><strong>Venue:</strong> ${data.metadata.venue || 'N/A'}</p>
            <p class="text-gray-300"><strong>Location:</strong> ${data.metadata.coverage || 'N/A'}</p>
            <p class="text-gray-300"><strong>Source:</strong> ${data.metadata.source || 'N/A'}</p>
            <p class="text-gray-300"><strong>Lineage:</strong> ${data.metadata.lineage || 'N/A'}</p>
            <p class="text-gray-300"><strong>Taper:</strong> ${data.metadata.taper || 'N/A'}</p>
        `;
    }
    const ai = document.getElementById('additional-info');
    if (ai) {
        // Build description from available metadata fields.
        let descriptionHTML = '<h2 class="text-xl font-semibold mb-4 text-gray-100">Additional Information</h2>';
        if (data.metadata.description) descriptionHTML += `<p class="text-gray-300 mb-2">${data.metadata.description}</p>`;
        if (data.metadata.notes) descriptionHTML += `<p class="text-gray-300 mb-2">${data.metadata.notes}</p>`;
        if (data.metadata.setlist) descriptionHTML += `<div class="text-gray-300">${data.metadata.setlist.replace(/\n/g, '<br>')}</div>`;
        ai.innerHTML = descriptionHTML;
    }
}


/**
 * Sets up the player UI, removes placeholders, and attaches event listeners.
 */
function setupPlayerUI() {
    document.getElementById('loading-placeholder').remove();
    document.getElementById('custom-player').classList.remove('hidden');

    // Assign DOM elements to global variables.
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

    // Attach event listeners for player controls.
    playPauseButton.addEventListener('click', playPauseWrapper);
    nextButton.addEventListener('click', nextTrack);
    prevButton.addEventListener('click', prevTrack);
    trackProgress.addEventListener('input', seekTrack);
    document.getElementById('muteButton').addEventListener('click', toggleMute);
    document.getElementById('volumeControl').addEventListener('input', handleVolumeChange);
    document.getElementById('shuffleButton').addEventListener('click', toggleShuffle);
    document.getElementById('loopButton').addEventListener('click', toggleLoop);

    // Attach listeners to the audio element for state changes.
    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('loadedmetadata', updateTotalTime);
    audio.addEventListener('ended', handleTrackEnd);
    audio.addEventListener('progress', updateBufferProgress);
    audio.addEventListener('playing', () => { playerState = 'playing'; updatePlayerControls(); });
    audio.addEventListener('pause', () => { playerState = 'paused'; updatePlayerControls(); });
    audio.addEventListener('waiting', () => { playerState = 'loading'; updatePlayerControls(); });
    audio.addEventListener('error', e => {
        console.error('Audio element error:', e);
        const code = audio.error ? audio.error.code : 'Unknown';
        showPlayerError(`Audio error code: ${code}. The file may be corrupt or unavailable.`);
    });

    renderPlaylist();
    updatePlaylistInfo();
    updatePlayerControls();
    setupKeyboardControls();
}


/**
 * Loads a specific track into the audio element.
 * @param {number} index - The index of the track to load from the playlist.
 */
function loadTrack(index) {
    const track = playlist[index];
    if (!track || !track.url) {
        showPlayerError('Cannot load track: invalid data.');
        return;
    }
    currentIndex = index;
    playerState = 'loading';
    updatePlayerControls();

    audio.src = track.url;
    trackTitle.textContent = track.title;
    document.getElementById('trackInfo').textContent = `Track ${index + 1} of ${playlist.length}`;

    audio.load(); // Important: call load() after changing src.
    highlightCurrentTrack();
}


// ---_> PLAYER CONTROLS & ACTIONS <---

/**
 * Toggles play/pause state. Wrapper function to handle AudioContext resuming.
 */
function playPauseWrapper() {
    // The Web Audio API requires a user interaction to start the AudioContext.
    if (!audioContext || audioContext.state === 'suspended') {
        initializeAudioContext();
    }
    playPause();
}

/**
 * Core play/pause logic.
 */
function playPause() {
    if (playerState === 'playing') {
        audio.pause();
    } else {
        const playPromise = audio.play();
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                console.error('Playback error:', error);
                // Handle autoplay restrictions or other playback failures.
                showPlayerError(`Playback failed. You may need to click play manually. (${error.name})`);
            });
        }
    }
}

/**
 * Loads and plays the next track in the playlist.
 */
function nextTrack() {
    // Cancel any current load to prevent race conditions.
    audio.pause();
    audio.removeAttribute('src'); 
    audio.load();

    let nextIndex;
    if (isShuffled) {
        nextIndex = Math.floor(Math.random() * playlist.length);
    } else {
        nextIndex = currentIndex + 1;
    }

    if (nextIndex >= playlist.length) {
        if (loopMode === 'all') {
            nextIndex = 0; // Loop back to the start.
        } else {
            return; // End of playlist.
        }
    }
    
    loadTrack(nextIndex);
    audio.play().catch(err => {
        if (err.name !== 'AbortError') showPlayerError(`Next track failed: ${err.message}`);
    });
}

/**
 * Loads and plays the previous track in the playlist.
 */
function prevTrack() {
    // If more than 3 seconds into the track, just rewind it.
    if (audio.currentTime > 3) {
        audio.currentTime = 0;
        return;
    }
    
    audio.pause();
    audio.removeAttribute('src');
    audio.load();

    let prevIndex;
    if (isShuffled) {
        prevIndex = Math.floor(Math.random() * playlist.length);
    } else {
        prevIndex = currentIndex - 1;
    }
    
    if (prevIndex < 0) {
        if (loopMode === 'all') {
            prevIndex = playlist.length - 1; // Loop to the end.
        } else {
            return; // Start of playlist.
        }
    }

    loadTrack(prevIndex);
    audio.play().catch(err => {
        if (err.name !== 'AbortError') showPlayerError(`Prev track failed: ${err.message}`);
    });
}

/**
 * Handles what happens when a track finishes playing.
 */
function handleTrackEnd() {
    if (loopMode === 'one') {
        audio.currentTime = 0;
        audio.play();
    } else {
        nextTrack();
    }
}

/**
 * Allows the user to seek to a specific position in the track.
 * @param {Event} e - The input event from the progress bar.
 */
function seekTrack(e) {
    const newTime = (e.target.value / 100) * audio.duration;
    if (isFinite(newTime)) {
        audio.currentTime = newTime;
    }
}

/**
 * Toggles the shuffle mode on and off.
 */
function toggleShuffle() {
    isShuffled = !isShuffled;
    document.getElementById('shuffleButton').classList.toggle('text-blue-400', isShuffled);
    document.getElementById('shuffleButton').title = `Shuffle: ${isShuffled ? 'On' : 'Off'}`;

    const currentTrack = playlist[currentIndex];
    if (isShuffled) {
        // Shuffle the playlist and find the new index of the current track.
        playlist = shuffleArray([...originalPlaylist]);
        currentIndex = playlist.findIndex(t => t.url === currentTrack.url);
    } else {
        // Restore the original order.
        playlist = [...originalPlaylist];
        currentIndex = playlist.findIndex(t => t.url === currentTrack.url);
    }
    renderPlaylist();
    highlightCurrentTrack();
}

/**
 * Cycles through the loop modes: 'none' -> 'one' -> 'all'.
 */
function toggleLoop() {
    const modes = ['none', 'one', 'all'];
    const currentModeIndex = modes.indexOf(loopMode);
    loopMode = modes[(currentModeIndex + 1) % modes.length];
    
    const loopButton = document.getElementById('loopButton');
    loopButton.classList.toggle('text-blue-400', loopMode !== 'none');
    loopButton.title = `Loop: ${loopMode.charAt(0).toUpperCase() + loopMode.slice(1)}`;
}

/**
 * Allows a user to select a track directly from the playlist UI.
 * @param {number} i - The index of the track to select.
 */
function selectTrack(i) {
    // If the clicked track is already playing, toggle play/pause.
    if (i === currentIndex) {
        playPause();
        return;
    }
    
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    
    loadTrack(i);
    audio.play().catch(err => {
        if (err.name !== 'AbortError') showPlayerError(`Play error: ${err.message}`);
    });
}


// ---_> UI UPDATE & RENDERING FUNCTIONS <---

/**
 * Updates the visual state of the play/pause button and prev/next buttons.
 */
function updatePlayerControls() {
    if (!playIcon) return;
    // Update play/pause icon.
    if (playerState === 'playing') {
        playIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6" />`; // Pause icon
    } else {
        playIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3l14 9-14 9V3z" />`; // Play icon
    }

    // Disable/enable prev/next buttons at the ends of the playlist (unless looping or shuffling).
    const atStart = currentIndex === 0 && !isShuffled && loopMode !== 'all';
    const atEnd = currentIndex === playlist.length - 1 && !isShuffled && loopMode !== 'all';
    if(prevButton) prevButton.disabled = atStart;
    if(nextButton) nextButton.disabled = atEnd;
}

/**
 * Updates the progress bar and current time display.
 */
function updateProgress() {
    if (!isFinite(audio.duration)) return;
    const percent = (audio.currentTime / audio.duration) * 100;
    if (trackProgress) trackProgress.value = percent;
    document.getElementById('progressBar').style.width = `${percent}%`;
    if (currentTimeEl) currentTimeEl.textContent = formatTime(audio.currentTime);
}

/**
 * Updates the total time display once metadata is loaded.
 */
function updateTotalTime() {
    if (totalTimeEl) totalTimeEl.textContent = formatTime(audio.duration);
}

/**
 * Updates the buffered amount indicator on the progress bar.
 */
function updateBufferProgress() {
    if (!audio.buffered.length || !isFinite(audio.duration)) return;
    const bufferedEnd = audio.buffered.end(audio.buffered.length - 1);
    const percent = (bufferedEnd / audio.duration) * 100;
    document.getElementById('bufferBar').style.width = `${percent}%`;
}


/**
 * Renders the entire playlist in the UI.
 */
function renderPlaylist() {
    if (!playlistContainer) return;
    playlistContainer.innerHTML = playlist.map((track, i) => `
        <div class="py-2 px-3 flex justify-between items-center hover:bg-gray-700 transition-colors rounded-lg cursor-pointer"
             onclick="selectTrack(${i})" role="option" aria-selected="${i === currentIndex}">
            <div class="flex items-center space-x-2 overflow-hidden">
                <span class="text-sm font-mono ${i === currentIndex ? 'text-blue-400' : 'text-gray-400'}">${(i + 1).toString().padStart(2, '0')}.</span>
                <span class="text-sm truncate ${i === currentIndex ? 'text-white font-semibold' : 'text-gray-300'}">${track.title}</span>
            </div>
            <div class="play-indicator-container flex-shrink-0 w-4">
                ${i === currentIndex && playerState === 'playing' ? '<span class="text-blue-400 text-xs">▶</span>' : ''}
            </div>
        </div>
    `).join('');
    updatePlaylistInfo();
}

/**
 * Highlights the currently playing track in the playlist UI.
 */
function highlightCurrentTrack() {
    if (!playlistContainer) return;
    // Update all track elements in the playlist.
    Array.from(playlistContainer.children).forEach((el, i) => {
        const isCurrent = i === currentIndex;
        el.classList.toggle('bg-gray-700', isCurrent);
        el.setAttribute('aria-selected', isCurrent);

        const textSpans = el.querySelectorAll('span');
        if (textSpans[0]) textSpans[0].classList.toggle('text-blue-400', isCurrent);
        if (textSpans[0]) textSpans[0].classList.toggle('text-gray-400', !isCurrent);
        if (textSpans[1]) textSpans[1].classList.toggle('text-white', isCurrent);
        if (textSpans[1]) textSpans[1].classList.toggle('font-semibold', isCurrent);
        
        // Update the play indicator.
        const indicatorContainer = el.querySelector('.play-indicator-container');
        if (indicatorContainer) {
            const isPlaying = isCurrent && playerState === 'playing';
            indicatorContainer.innerHTML = isPlaying ? '<span class="text-blue-400 text-xs">▶</span>' : '';
        }
    });

    // Scroll the current track into view if needed.
    const activeElement = playlistContainer.children[currentIndex];
    if (activeElement) {
        activeElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

/**
 * Updates the small text indicating the total number of tracks.
 */
function updatePlaylistInfo() {
    const pi = document.getElementById('playlistInfo');
    if (pi) pi.textContent = `${playlist.length} tracks`;
}


// ---_> VISUALIZER LOGIC <---

/**
 * Initializes the Web Audio API for the visualizer.
 */
function initializeAudioContext() {
    if (audioContext) {
        if (audioContext.state === 'suspended') {
            audioContext.resume().catch(e => console.error('AudioContext resume error:', e));
        }
        return;
    }
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioContext.createMediaElementSource(audio);
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);
        
        source.connect(analyser);
        analyser.connect(audioContext.destination);
        
        visualizerCanvas = document.getElementById('visualizerCanvas');
        if (visualizerCanvas) {
            visualizerCtx = visualizerCanvas.getContext('2d');
            drawVisualizer(); // Start the animation loop.
        }
    } catch (e) {
        console.error('Audio visualizer initialization failed:', e);
    }
}

/**
 * The animation loop for drawing the frequency data to the canvas.
 */
function drawVisualizer() {
    requestAnimationFrame(drawVisualizer); // Loop this function.

    if (!visualizerCtx || !analyser || !dataArray) return;
    analyser.getByteFrequencyData(dataArray);

    const width = visualizerCanvas.width = visualizerCanvas.clientWidth;
    const height = visualizerCanvas.height = visualizerCanvas.clientHeight;

    // Fading trail effect.
    visualizerCtx.fillStyle = 'rgba(0, 0, 0, 0.06)';
    visualizerCtx.fillRect(0, 0, width, height);
    visualizerCtx.globalCompositeOperation = 'lighter';

    const barCount = bufferLength;
    const barWidth = width / barCount * 2;
    const time = Date.now() * 0.003;

    for (let i = 0; i < barCount; i++) {
        const value = dataArray[i] / 255;
        const easedValue = Math.pow(value, 1.5);
        const barHeight = easedValue * height * 1.7;
        const x = i * barWidth * 0.6 + Math.sin(i * 0.1 + time * 4) * 2;
        
        // Dynamic, multi-layered color calculation for a psychedelic effect.
        const hue = (i * 2 + time * 80 + Math.sin(i * 0.3 + time) * 60) % 360;
        const saturation = 85 + Math.sin(time + i * 0.15) * 10;
        const lightness = 40 + easedValue * 45;

        const gradient = visualizerCtx.createLinearGradient(x, height, x, height - barHeight);
        gradient.addColorStop(0, `hsla(${hue}, ${saturation}%, ${lightness + 5}%, 0.6)`);
        gradient.addColorStop(1, `hsla(${hue + 20}, ${saturation + 5}%, ${lightness}%, 1)`);
        visualizerCtx.fillStyle = gradient;

        // Draw the bar with a rounded top.
        visualizerCtx.beginPath();
        visualizerCtx.moveTo(x, height);
        visualizerCtx.lineTo(x, height - barHeight + 10);
        visualizerCtx.quadraticCurveTo(x, height - barHeight, x + 10, height - barHeight);
        visualizerCtx.lineTo(x + barWidth - 10, height - barHeight);
        visualizerCtx.quadraticCurveTo(x + barWidth, height - barHeight, x + barWidth, height - barHeight + 10);
        visualizerCtx.lineTo(x + barWidth, height);
        visualizerCtx.closePath();
        visualizerCtx.fill();
    }
    visualizerCtx.globalCompositeOperation = 'source-over';
}


// ---_> UTILITY & HELPER FUNCTIONS <---

/**
 * Adds or updates a show in the 'recently viewed' list in localStorage.
 * @param {object} show - The show object with `identifier` and `title`.
 */
function updateRecentlyViewed(show) {
    if (!show || !show.identifier) return;
    // Remove any existing entry for the same show to move it to the top.
    let stored = recentlyViewed.filter(s => s.identifier !== show.identifier);
    // Add the new show to the beginning of the array.
    stored.unshift({
        identifier: show.identifier,
        title: show.title || 'Unknown Show'
    });
    // Limit the list to the 5 most recent items.
    if (stored.length > 5) stored.pop();

    try {
        localStorage.setItem('recentlyViewed', JSON.stringify(stored));
        recentlyViewed = stored; // Update the global variable.
    } catch (e) {
        console.error('Failed to save `recentlyViewed` to localStorage:', e);
    }
    renderRecentlyViewed();
}

/**
 * Renders the 'recently viewed' list into its container.
 */
function renderRecentlyViewed() {
    const container = document.getElementById('recentlyViewed');
    if (!container || recentlyViewed.length === 0) {
        if (container) container.innerHTML = ''; // Clear if empty
        return;
    }
    container.innerHTML = `
        <div class="glass-card p-4 max-w-sm">
            <h3 class="font-semibold mb-2 text-gray-100">Recently Viewed</h3>
            ${recentlyViewed.map(show => `
                <div class="text-sm mb-1 hover:bg-gray-700 p-2 rounded cursor-pointer text-gray-300 truncate"
                     onclick="openPlayerPage('${show.identifier}')" title="${show.title}">
                    ${show.title}
                </div>
            `).join('')}
        </div>
    `;
}

/**
 * Navigates to the player page for a given show identifier.
 * @param {string} identifier - The Archive.org identifier for the show.
 */
function openPlayerPage(identifier) {
    window.location.href = `player.html?id=${identifier}`;
}

/**
 * Formats seconds into a `M:SS` or `H:MM:SS` string.
 * @param {number} sec - The total seconds.
 * @returns {string} The formatted time string.
 */
function formatTime(sec) {
    if (!sec || !isFinite(sec)) return '0:00';
    const hours = Math.floor(sec / 3600);
    const minutes = Math.floor((sec % 3600) / 60);
    const seconds = Math.floor(sec % 60);
    const paddedSeconds = seconds.toString().padStart(2, '0');
    
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${paddedSeconds}`;
    }
    return `${minutes}:${paddedSeconds}`;
}

/**
 * Shuffles an array using the Fisher-Yates algorithm.
 * @param {Array} array - The array to shuffle.
 * @returns {Array} A new array with the elements shuffled.
 */
function shuffleArray(array) {
    let currentIndex = array.length, randomIndex;
    while (currentIndex !== 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }
    return array;
}

/**
 * Displays a temporary error message in the player UI.
 * @param {string} msg - The error message to display.
 */
function showPlayerError(msg) {
    const pw = document.getElementById('player-wrapper');
    if (!pw) return;
    // Remove any existing error message first.
    const existingError = pw.querySelector('.player-error-message');
    if (existingError) existingError.remove();

    const errDiv = document.createElement('div');
    errDiv.className = 'player-error-message bg-red-800 text-white px-4 py-2 rounded-lg mb-4 text-sm';
    errDiv.innerHTML = `<span>${msg}</span>`;
    // Automatically remove the error message after a few seconds.
    setTimeout(() => errDiv.remove(), 8000);
    pw.insertBefore(errDiv, pw.firstChild);
}

/**
 * Sets the main page title and header/subheader titles.
 * @param {string} bandTitle - The name of the band currently being searched.
 */
function updatePageTitles(bandTitle) {
    document.title = `${bandTitle} Tape Finder`;
    const headerTitle = document.querySelector('header h1');
    const subtitle = document.querySelector('header p');
    if (headerTitle) {
        headerTitle.textContent = `${bandTitle} Tape Finder`;
    }
    if (subtitle) {
        subtitle.textContent = `An interface to the Live Music Archive's ${bandTitle} collection`;
    }
}

/**
 * Sets up keyboard shortcuts for the media player.
 */
function setupKeyboardControls() {
    document.addEventListener('keydown', e => {
        // Ignore key presses if an input field is focused.
        if (document.activeElement.tagName === 'INPUT') return;

        const cp = document.getElementById('custom-player');
        if (!cp || cp.classList.contains('hidden')) return;

        switch (e.key.toLowerCase()) {
            case ' ': case 'k':
                e.preventDefault(); playPauseWrapper(); break;
            case 'arrowright':
                e.preventDefault(); audio.currentTime = Math.min(audio.currentTime + 5, audio.duration); break;
            case 'arrowleft':
                e.preventDefault(); audio.currentTime = Math.max(audio.currentTime - 5, 0); break;
            case 'l':
                e.preventDefault(); audio.currentTime = Math.min(audio.currentTime + 10, audio.duration); break;
            case 'j':
                e.preventDefault(); audio.currentTime = Math.max(audio.currentTime - 10, 0); break;
            case 'm':
                e.preventDefault(); toggleMute(); break;
            case 'n':
                e.preventDefault(); nextTrack(); break;
            case 'p':
                e.preventDefault(); prevTrack(); break;
        }
    });
}

/**
 * Handles the search button click event.
 */
function handleSearchClick() {
    const qi = document.getElementById('searchQuery');
    if (qi) { qi.blur(); searchShows(1); }
}

/**
 * Handles the 'Enter' key press in the search input field.
 * @param {KeyboardEvent} e - The keyboard event.
 */
function handleSearchKeyPress(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        handleSearchClick();
    }
}

/**
 * Shows the loading spinner and skeleton cards.
 */
function showLoading() {
    document.getElementById('loading')?.classList.remove('hidden');
    const resultsDiv = document.getElementById('results');
    if (resultsDiv) {
        resultsDiv.innerHTML = ''; // Clear previous results
        for (let i = 0; i < 3; i++) {
            resultsDiv.innerHTML += `
                <div class="show-card-skeleton animate-pulse">
                    <div class="skeleton-line" style="width: 60%;"></div>
                    <div class="skeleton-line" style="width: 90%;"></div>
                    <div class="skeleton-line" style="width: 75%;"></div>
                </div>`;
        }
    }
}

/**
 * Hides the loading spinner.
 */
function hideLoading() {
    document.getElementById('loading')?.classList.add('hidden');
}

/**
 * Changes the current page of search results.
 * @param {number} delta - The change in page number (+1 for next, -1 for previous).
 */
function changePage(delta) {
    const newPage = currentPage + delta;
    if (newPage > 0 && newPage <= Math.ceil(totalResults / resultsPerPage)) {
        searchShows(newPage);
    }
}
