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

// Safely initialize recentlyViewed on load
(function(){
    try {
        const raw = localStorage.getItem('recentlyViewed') || '[]';
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) recentlyViewed = parsed;
        else throw new Error;
    } catch {
        console.error('Invalid recentlyViewed; resetting');
        localStorage.removeItem('recentlyViewed');
        recentlyViewed = [];
    }
})();

// Robust updateRecentlyViewed(...)
// Adds a show to the 'recently viewed' list in localStorage.
function updateRecentlyViewed(show) {
    if (!show || !show.identifier) {
        console.error('Invalid show data for recently viewed');
        return;
    }
    let stored = [];
    try {
        const raw = localStorage.getItem('recentlyViewed') || '[]';
        stored = JSON.parse(raw);
        if (!Array.isArray(stored)) throw new Error;
    } catch {
        console.error('Corrupt recentlyViewed; resetting');
        stored = [];
    }

    // Remove any existing entry for this show to move it to the top.
    stored = stored.filter(s => s.identifier !== show.identifier);
    stored.unshift({
        identifier: show.identifier,
        title: show.title || 'Unknown Show'
    });
    // Keep the list at a max of 5 items.
    if (stored.length > 5) stored.pop();

    try {
        localStorage.setItem('recentlyViewed', JSON.stringify(stored));
    } catch (e) {
        console.error('Error saving recentlyViewed:', e);
    }
    recentlyViewed = stored;
    renderRecentlyViewed();
}

// renderRecentlyViewed()
// Renders the list of recently viewed shows to the DOM.
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

// debounce helper
// A utility function to limit the rate at which a function gets called.
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// show/hide loading skeletons
// Displays skeleton loaders while search results are being fetched.
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
// Hides the loading skeleton loaders.
function hideLoading() {
    const loadingEl = document.getElementById('loading');
    if (loadingEl) loadingEl.classList.add('hidden');
}

// createShowCard
// Generates the HTML for a single show result card.
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
        <div class="bg-gray-800 border border-gray-700 rounded-lg shadow hover:shadow-lg p-6 mb-4 cursor-pointer"
             onclick="openPlayerPage('${show.identifier}')">
            <div class="flex justify-between items-start">
                <div>
                    <h3 class="text-lg font-semibold text-gray-100">${show.year}: ${show.title}</h3>
                    <div class="mt-1">${tags}</div>
                </div>
                <div class="text-sm text-gray-400">${show.downloads||0} downloads</div>
            </div>
            <div class="mt-2 text-sm text-gray-400">
                <div>${show.venue||'Unknown Venue'}</div>
                <div>${show.coverage||'Unknown Location'}</div>
            </div>
        </div>
    `;
}

// updatePagination
// Updates the pagination UI with the current page and total pages.
function updatePagination() {
    const totalPages = Math.ceil(totalResults / resultsPerPage);
    const pageInfo = document.getElementById('pageInfo');
    const prevPage = document.getElementById('prevPage');
    const nextPage = document.getElementById('nextPage');

    if (pageInfo) pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    if (prevPage) prevPage.disabled = currentPage === 1;
    if (nextPage) nextPage.disabled = currentPage === totalPages;
}

// searchShows - Updated to support verified bands with substantial collections
// searchShows - Fixed search queries for bands with specific collection structures
// Fetches show data from the Internet Archive based on the current search filters.
async function searchShows(page = 1) {
    const searchQueryInput = document.getElementById('searchQuery');
    const yearFromInput    = document.getElementById('yearFrom');
    const yearToInput      = document.getElementById('yearTo');
    const bandSelector     = document.getElementById('bandSelector');

    const query    = searchQueryInput ? searchQueryInput.value : '';
    const yearFrom = yearFromInput    ? yearFromInput.value : '';
    const yearTo   = yearToInput      ? yearToInput.value : '';
    const band     = bandSelector     ? bandSelector.value : 'GratefulDead';
    
    showLoading();
    currentPage = page;
    
    // Customize the API query based on the selected band.
    let baseQuery = '';
    let bandTitle = '';
    
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
            // Use Archive.org's full-text metadata search within etree
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
    
    // Update page title to reflect current band
    document.title = `${bandTitle} Tape Finder`;

    // Update header title
    const headerTitle = document.querySelector('header h1');
    if (headerTitle) {
        headerTitle.textContent = `${bandTitle} Tape Finder`;
    }
    
    // Update subtitle
    const subtitle = document.querySelector('header p');
    if (subtitle) {
        subtitle.textContent = `An interface to Archive's ${bandTitle} collection`;
    }
    
   if (band !== 'Other' && query) {
        baseQuery += ` AND (${query})`;
    }
    if (yearFrom) baseQuery += ` AND year:[${yearFrom} TO ${yearTo || '*'}]`;
    else if (band === 'GratefulDead' && !yearFrom) baseQuery += ' AND year:[1965 TO 1995]';
    else baseQuery += ' AND year:[1965 TO 2025]'; // Default year range for other bands
    
    const activeFilter = document.querySelector('[data-filter].bg-blue-500');
    if (activeFilter) {
        const f = activeFilter.dataset.filter;
        if (f === 'five-star')   baseQuery += ' AND avg_rating:[4.5 TO 5]';
        else if (f === 'soundboard') baseQuery += ' AND source:(soundboard OR sbd)';
        else if (f === 'aud')         baseQuery += ' AND source:(audience OR aud)';
        else if (f === 'matrix')      baseQuery += ' AND (source:matrix)';
    }

    console.log('Search query:', baseQuery); // For debugging

    try {
        const resp = await fetch(`https://archive.org/advancedsearch.php?` +
            `q=${encodeURIComponent(baseQuery)}` +
            `&fl[]=identifier,title,year,venue,coverage,downloads,source` +
            `&sort[]=downloads+score&output=json` +
            `&rows=${resultsPerPage}&page=${page}`);
        const data = await resp.json();
        hideLoading();
        const resultsDiv = document.getElementById('results');
        
        if (!data.response.docs.length) {
            if (resultsDiv) resultsDiv.innerHTML = `
                <p class="text-center text-gray-400 my-8">
                  No shows found for ${bandTitle}.
                </p>`;
            return;
        }
        
        totalResults = data.response.numFound;
        if (resultsDiv) resultsDiv.innerHTML = data.response.docs.map(createShowCard).join('');
        updatePagination();
    } catch (error) {
        console.error('Search error:', error);
        hideLoading();  // ensure spinner always hides
        const resultsDiv = document.getElementById('results');
        if (resultsDiv) resultsDiv.innerHTML = `
            <p class="text-center text-red-500 my-8">
              An error occurred while searching. Please try again later.
            </p>`;
    }
}

// pagination controls
// Changes the current page of search results.
function changePage(delta) {
    searchShows(currentPage + delta);
}
// Navigates to the player page for a given show identifier.
function openPlayerPage(identifier) {
    window.location.href = `player.html?id=${identifier}`;
}

// initializePlayer
// Fetches all metadata for a specific show and sets up the player UI.
async function initializePlayer() {
  // 1) Read URL params
  const params     = new URLSearchParams(window.location.search);
  const identifier = params.get('id');
  const trackParam = parseInt(params.get('track'), 10);

  // 2) If no show ID, bail out
  if (!identifier) {
    const pw = document.getElementById('player-wrapper');
    if (pw) pw.innerHTML = `
      <p class="text-center text-red-500">
        No show selected. Please go back and choose a show.
      </p>`;
    return;
  }

  // 3) Show loading state
  const showTitleEl = document.getElementById('show-title');
  if (showTitleEl) showTitleEl.textContent = 'Loading Show...';

  try {
    // 4) Fetch metadata
    const resp = await fetch(`https://archive.org/metadata/${identifier}`);
    if (!resp.ok) throw new Error(`Status ${resp.status}`);
    const data = await resp.json();

    // 5) Determine band name and update title/header
    let bandName = 'Grateful Dead';
    if (typeof data.metadata.creator === 'string') {
      const cr = data.metadata.creator;
      if (cr.includes('Billy Strings'))       bandName = 'Billy Strings';
      else if (cr.includes('Ratdog'))         bandName = 'Ratdog';
      else if (cr.includes('Phil Lesh'))      bandName = 'Phil Lesh & Friends';
      else if (cr.includes('Dead and Company')) bandName = 'Dead & Company';
      else if (cr.includes('Furthur'))        bandName = 'Furthur';
      else if (cr.includes('Jerry Garcia'))   bandName = 'Jerry Garcia Band';
      else if (cr.includes('Bob Weir'))       bandName = 'Bob Weir';
    }
    document.title = `${bandName}: ${data.metadata.title || 'Show'}`;
    if (showTitleEl) showTitleEl.textContent = data.metadata.title || 'Unknown Show';
    document.getElementById('archive-link').href = `https://archive.org/details/${identifier}`;

    // 6) Render info & mark recently viewed
    updateShowInfo(data);
    updateRecentlyViewed({ identifier, title: data.metadata.title });

    // 7) Build playlist
    const audioFiles = data.files.filter(f =>
      f.format && f.format.toLowerCase().includes('mp3') && f.name
    );
    if (!audioFiles.length) throw new Error('No playable audio files found');
    playlist = audioFiles.map(f => ({
      title: f.title || f.name,
      url:   `https://archive.org/download/${identifier}/${encodeURIComponent(f.name)}`
    }));
    originalPlaylist = [...playlist];

    // 8) Start on ?track=N if valid, otherwise 0
    if (!isNaN(trackParam) && trackParam > 0 && trackParam <= playlist.length) {
      currentIndex = trackParam - 1;
    } else {
      currentIndex = 0;
    }

    // 9) Initialize UI + audio and load that track
    setupPlayerUI();
    initializeAudioContext();
    loadTrack(currentIndex);

  } catch (error) {
    console.error('Error initializing player:', error);
    const pw = document.getElementById('player-wrapper');
    if (pw) pw.innerHTML = `
      <div class="bg-red-800 text-white p-4 rounded-lg">
        <h3 class="font-bold">Error Loading Player</h3>
        <p class="mt-2">${error.message || 'Unknown error'}</p>
        <a href="index.html" class="underline text-blue-300 mt-2 inline-block">
          Return to Search
        </a>
      </div>`;
  }
}


// updateShowInfo
// Populates the show details and additional information sections.
function updateShowInfo(data) {
    const si = document.getElementById('show-info');
    if (si) si.innerHTML = `
        <h2 class="text-xl font-semibold mb-4 text-gray-100">Show Details</h2>
        <p class="text-gray-300"><strong>Date:</strong> ${data.metadata.date || 'N/A'}</p>
        <p class="text-gray-300"><strong>Venue:</strong> ${data.metadata.venue || 'N/A'}</p>
        <p class="text-gray-300"><strong>Location:</strong> ${data.metadata.coverage || 'N/A'}</p>
        <p class="text-gray-300"><strong>Source:</strong> ${data.metadata.source || 'N/A'}</p>
        <p class="text-gray-300"><strong>Lineage:</strong> ${data.metadata.lineage || 'N/A'}</p>
        <p class="text-gray-300"><strong>Taper:</strong> ${data.metadata.taper || 'N/A'}</p>
    `;
    const ai = document.getElementById('additional-info');
    if (ai) ai.innerHTML = `
        <h2 class="text-xl font-semibold mb-4 text-gray-100">Additional Information</h2>
        ${data.metadata.description ? `<p class="text-gray-300">${data.metadata.description}</p>` : ''}
        ${data.metadata.notes       ? `<p class="text-gray-300">${data.metadata.notes}</p>`       : ''}
        ${data.metadata.setlist     ? `<p class="text-gray-300">${data.metadata.setlist}</p>`     : ''}
    `;
}

// setupPlayerUI
// Gets references to all player DOM elements and attaches event listeners.
function setupPlayerUI() {
    const loadingPlaceholder = document.getElementById('loading-placeholder');
    const customPlayer       = document.getElementById('custom-player');
    if (loadingPlaceholder) loadingPlaceholder.remove();
    if (customPlayer)       customPlayer.classList.remove('hidden');

    audio            = document.getElementById('audioElement');
    trackTitle       = document.getElementById('trackTitle');
    playPauseButton  = document.getElementById('playPause');
    prevButton       = document.getElementById('prevTrack');
    nextButton       = document.getElementById('nextTrack');
    trackProgress    = document.getElementById('trackProgress');
    currentTimeEl    = document.getElementById('currentTime');
    totalTimeEl      = document.getElementById('totalTime');
    playlistContainer= document.getElementById('playlistContainer');
    playIcon         = document.getElementById('playIcon');

    const muteButton     = document.getElementById('muteButton');
    const volumeControl  = document.getElementById('volumeControl');
    const shuffleButton  = document.getElementById('shuffleButton');
    const loopButton     = document.getElementById('loopButton');

    if (playPauseButton) playPauseButton.addEventListener('click', playPauseWrapper);
    if (nextButton)      nextButton.addEventListener('click', nextTrack);
    if (prevButton)      prevButton.addEventListener('click', prevTrack);
    if (trackProgress)   trackProgress.addEventListener('input', seekTrack);
    if (muteButton)      muteButton.addEventListener('click', toggleMute);
    if (volumeControl)   volumeControl.addEventListener('input', handleVolumeChange);
    if (shuffleButton)   shuffleButton.addEventListener('click', toggleShuffle);
    if (loopButton)      loopButton.addEventListener('click', toggleLoop);

    if (audio) {
        audio.addEventListener('timeupdate', updateProgress);
        audio.addEventListener('loadedmetadata', updateTotalTime);
        audio.addEventListener('ended', handleTrackEnd);
        audio.addEventListener('progress', updateBufferProgress);
        audio.addEventListener('playing', updatePlayingState);
        audio.addEventListener('pause',   updatePausedState);
        audio.addEventListener('waiting', updateLoadingState);
        audio.addEventListener('error',   e => {
            console.error('Audio error:', e);
            const code = audio.error ? audio.error.code : 'Unknown';
            showPlayerError(`Audio error: ${code}`);
        });
    }

    renderPlaylist();
    updatePlaylistInfo();
    updatePlayerControls();
    setupKeyboardControls();
}

// initializeAudioContext + drawVisualizer
// Sets up the Web Audio API for the visualizer.
function initializeAudioContext() {
    if (!audioContext) {
        try {
            audioContext = new (window.AudioContext||window.webkitAudioContext)();
            const src   = audioContext.createMediaElementSource(audio);
            analyser     = audioContext.createAnalyser();
            analyser.fftSize = 256;
            bufferLength = analyser.frequencyBinCount;
            dataArray    = new Uint8Array(bufferLength);
            src.connect(analyser);
            analyser.connect(audioContext.destination);
            visualizerCanvas = document.getElementById('visualizerCanvas');
            if (visualizerCanvas) visualizerCtx = visualizerCanvas.getContext('2d');
            if (visualizerCtx) drawVisualizer();
        } catch (e) {
            console.error('Visualizer init error:', e);
        }
    } else if (audioContext.state === 'suspended') {
        audioContext.resume().catch(e => console.error('AudioContext resume error:', e));
    }
}

// The animation loop for drawing the frequency data to the canvas.
function drawVisualizer() {
  requestAnimationFrame(drawVisualizer);

  if (!visualizerCtx || !analyser) return;
  analyser.getByteFrequencyData(dataArray);

  const width  = visualizerCanvas.width  = visualizerCanvas.clientWidth;
  const height = visualizerCanvas.height = visualizerCanvas.clientHeight;

  // Smooth trailing blur effect
  visualizerCtx.fillStyle = 'rgba(0, 0, 0, 0.06)';
  visualizerCtx.fillRect(0, 0, width, height);
  visualizerCtx.globalCompositeOperation = 'lighter';

  const barCount = bufferLength;
  const barWidth = width / barCount * 2;
  const time = Date.now() * 0.003;

  // Global metrics for visual variation
  const volume = dataArray.reduce((a, b) => a + b, 0) / bufferLength;
  const intensity = dataArray.filter((v, i) => i % 8 === 0).reduce((a, b) => a + b, 0) / (bufferLength / 8);

  for (let i = 0; i < barCount; i++) {
    const value = dataArray[i] / 255;
    const eased = Math.pow(value, 1.5); // smoother scaling
    const barHeight = eased * height * 1.7;

    const x = i * barWidth * 0.6 + Math.sin(i * 0.1 + time * 4) * 2;

    // Multi-layer color shifting for a psychedelic effect
    const hue = (i * 2 + time * 80 + Math.sin(i * 0.3 + time) * 60 + (volume * 0.8)) % 360;
    const saturation = 85 + Math.sin(time + i * 0.15) * 10;
    const light = 40 + eased * 45 + Math.sin(i + time * 0.5) * 5;

    // Colorful glow with gradient
    const gradient = visualizerCtx.createLinearGradient(x, height, x, height - barHeight);
    gradient.addColorStop(0, `hsla(${hue}, ${saturation}%, ${light + 5}%, 0.6)`);
    gradient.addColorStop(1, `hsla(${hue + 20}, ${saturation + 5}%, ${light}%, 1)`);

    visualizerCtx.fillStyle = gradient;

    // Draw a bar with a rounded top
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

// loadTrack
// Loads a specific track into the audio element by its index.
function loadTrack(index) {
    const track = playlist[index];
    if (!track) {
        showPlayerError('Invalid track or missing URL');
        return;
    }
    currentIndex = index;
    playerState  = 'loading';
    updatePlayerControls();

    audio.src       = track.url;
    trackTitle.textContent = track.title;
    const infoEl    = document.getElementById('trackInfo');
    if (infoEl) infoEl.textContent = `Track ${index + 1} of ${playlist.length}`;

    audio.playbackRate = playbackRate;
    audio.volume       = lastVolume;
    audio.load();
    highlightCurrentTrack();
}

// renderPlaylist
// Generates and injects the HTML for the track playlist.
function renderPlaylist() {
    if (!playlistContainer) return;
    playlistContainer.innerHTML = playlist.map((track, i) => `
        <div class="py-2 px-3 flex justify-between items-center
                    hover:bg-gray-700 transition-colors rounded-lg cursor-pointer
                    ${i === currentIndex ? 'bg-gray-700' : ''}"
             onclick="selectTrack(${i})">
            <div class="flex items-center space-x-2">
                <span class="text-sm ${i === currentIndex ? 'text-blue-400' : 'text-gray-400'}">
                  ${i + 1}.
                </span>
                <span class="text-sm ${i === currentIndex ? 'text-white font-medium' : 'text-gray-300'}">
                  ${track.title}
                </span>
            </div>
            ${i === currentIndex && playerState === 'playing' ? '<span class="text-blue-400">▶️</span>' : ''}
        </div>
    `).join('');
    updatePlaylistInfo();
}

// highlightCurrentTrack
// Applies special styling to the currently active track in the playlist.
function highlightCurrentTrack() {
    if (!playlistContainer) return;
    Array.from(playlistContainer.children).forEach((el, i) => {
        const isCurrent = i === currentIndex;
        el.classList.toggle('bg-gray-700', isCurrent);
        const spans = el.querySelectorAll('span.text-sm');
        if (spans.length < 2) return;
        if (isCurrent) {
            spans[0].classList.replace('text-gray-400', 'text-blue-400');
            spans[1].classList.add('text-white', 'font-medium');
            spans[1].classList.remove('text-gray-300');
            if (!el.querySelector('span:last-child')) {
                const ind = document.createElement('span');
                ind.textContent = '▶️';
                ind.classList.add('text-blue-400');
                el.appendChild(ind);
            }
        } else {
            spans[0].classList.replace('text-blue-400', 'text-gray-400');
            spans[1].classList.remove('text-white', 'font-medium');
            spans[1].classList.add('text-gray-300');
            const last = el.querySelector('span:last-child');
            if (last && last.textContent === '▶️') last.remove();
        }
    });
}

// play/pause, next, prev, etc.
// play/pause wrapper: always let play/pause go through
// Wrapper to ensure AudioContext is active before playing.
function playPauseWrapper() {
  if (!audioContext || audioContext.state === 'suspended') {
    initializeAudioContext();
  }
  playPause();
}

// Toggles the audio between play and pause states.
function playPause() {
    if (playerState === 'playing') {
        audio.pause();
        playerState = 'paused';
    } else {
        const promise = audio.play();
        if (promise !== undefined) {
            promise.catch(error => {
                console.error('Playback failed:', error);
                playerState = 'paused';
                updatePlayerControls();
                showPlayerError(`Playback failed: ${error.message}`);
            });
        }
        playerState = 'playing';
    }
    updatePlayerControls();
    highlightCurrentTrack();
}

// === NEXT TRACK ===
// Skips to the next track in the playlist.
function nextTrack() {
  // cancel any in-flight load
  audio.pause();
  audio.removeAttribute('src');
  audio.load();

  // pick next index
  if (isShuffled) {
    currentIndex = Math.floor(Math.random() * playlist.length);
  } else if (currentIndex < playlist.length - 1) {
    currentIndex++;
  } else if (loopMode === 'all') {
    currentIndex = 0;
  } else {
    return;
  }

  // load & play
  loadTrack(currentIndex);
  audio.play().catch(err => {
    // ignore the “interrupted by a call to pause()” abort
    if (err.message.includes('interrupted by a call to pause')) return;
    showPlayerError(`Next track failed: ${err.message}`);
  });
}

// === PREVIOUS TRACK ===
// Goes to the previous track or rewinds the current one.
function prevTrack() {
  // cancel any in-flight load
  audio.pause();
  audio.removeAttribute('src');
  audio.load();

  // if just a few seconds in, rewind instead of skipping
  if (audio.currentTime > 3) {
    audio.currentTime = 0;
    return;
  }

  // pick previous index
  if (isShuffled) {
    currentIndex = Math.floor(Math.random() * playlist.length);
  } else if (currentIndex > 0) {
    currentIndex--;
  } else if (loopMode === 'all') {
    currentIndex = playlist.length - 1;
  } else {
    return;
  }

  // load & play
  loadTrack(currentIndex);
  audio.play().catch(err => {
    if (err.message.includes('interrupted by a call to pause')) return;
    showPlayerError(`Prev track failed: ${err.message}`);
  });
}

// handle end
// Logic for what happens when a track finishes playing.
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

// updateProgress, buffer, times
// Updates the track progress bar and time displays.
function updateProgress() {
    if (!audio.duration) return;
    const pct = (audio.currentTime / audio.duration) * 100;
    if (trackProgress) trackProgress.value = pct;
    const pb = document.getElementById('progressBar');
    if (pb) pb.style.width = `${pct}%`;
    if (currentTimeEl) currentTimeEl.textContent = formatTime(audio.currentTime);
}
// Sets the total time display when a track loads.
function updateTotalTime() {
    if (totalTimeEl) totalTimeEl.textContent = formatTime(audio.duration);
}
// Seeks the audio to a new position based on the progress bar input.
function seekTrack(e) {
    const t = (e.target.value / 100) * audio.duration;
    if (!isNaN(t)) {
        audio.currentTime = t;
        updateProgress();
    }
}
// Updates the visual representation of how much of the track is buffered.
function updateBufferProgress() {
    if (!audio.buffered.length) return;
    const bb = document.getElementById('bufferBar');
    if (!bb) return;
    const buffered = audio.buffered.end(audio.buffered.length - 1);
    const pct = (buffered / audio.duration) * 100;
    bb.style.width = `${pct}%`;
}

// mute & volume
// Toggles the audio mute state.
function toggleMute() {
    if (audio.volume > 0) {
        lastVolume = audio.volume;
        audio.volume = 0;
    } else {
        audio.volume = lastVolume;
    }
    updateVolumeUI();
}
// Handles volume changes from the slider.
function handleVolumeChange(e) {
    const vol = e.target.value / 100;
    audio.volume = vol;
    lastVolume = vol;
    updateVolumeUI();
}
// Updates the volume slider and icon UI.
function updateVolumeUI() {
    const icon = document.getElementById('volumeIcon');
    const bar  = document.getElementById('volumeBar');
    const ctrl = document.getElementById('volumeControl');
    if (!icon || !bar || !ctrl) return;
    bar.style.width = `${audio.volume * 100}%`;
    ctrl.value     = audio.volume * 100;
    if (audio.volume === 0) {
        icon.innerHTML = `<path stroke-linecap="round" .../>`; // Mute icon
    } else if (audio.volume < 0.5) {
        icon.innerHTML = `<path stroke-linecap="round" ... low/>`; // Low volume icon
    } else {
        icon.innerHTML = `<path stroke-linecap="round" ... high/>`; // High volume icon
    }
}

// shuffle & loop
// Toggles shuffle mode on and off.
function toggleShuffle() {
    const btn = document.getElementById('shuffleButton');
    if (!btn) return;
    isShuffled = !isShuffled;
    btn.classList.toggle('text-blue-400');
    btn.title = `Shuffle ${isShuffled ? 'On' : 'Off'}`;
    const current = playlist[currentIndex];
    playlist = isShuffled ? shuffleArray([...playlist]) : [...originalPlaylist];
    currentIndex = playlist.findIndex(t => t.url === current.url);
    renderPlaylist();
    highlightCurrentTrack();
}
// Cycles through the loop modes (none, one, all).
function toggleLoop() {
    const btn = document.getElementById('loopButton');
    if (!btn) return;
    const modes = ['none', 'one', 'all'];
    loopMode = modes[(modes.indexOf(loopMode) + 1) % 3];
    btn.classList.toggle('text-blue-400', loopMode !== 'none');
    btn.title = `Loop: ${loopMode}`;
}

// updatePlayerControls
// Fix for the updatePlayerControls function
// Updates the state of the player controls (e.g., play/pause icon, disabled buttons).
function updatePlayerControls() {
    if (!playIcon) return;
    
    // Set proper SVG path for play/pause icons
    if (playerState === 'playing') {
        // Pause icon (two vertical bars)
        playIcon.innerHTML = `
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                  d="M10 9v6m4-6v6" />
        `;
    } else {
        // Play icon (triangle)
        playIcon.innerHTML = `
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                  d="M5 3l14 9-14 9V3z" />
        `;
    }
    
    if (prevButton && nextButton) {
        prevButton.disabled = currentIndex === 0 && !isShuffled && loopMode === 'none';
        nextButton.disabled = currentIndex === playlist.length - 1 && !isShuffled && loopMode === 'none';
        [prevButton, nextButton].forEach(b => {
            if (b.disabled) b.classList.add('opacity-50','cursor-not-allowed');
            else          b.classList.remove('opacity-50','cursor-not-allowed');
        });
    }
}
// playing/paused/loading state handlers
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

// direct track selection from playlist
// === SELECT A TRACK FROM THE LIST ===
// Handles direct track selection from the playlist UI.
function selectTrack(i) {
  // cancel any in-flight load
  audio.pause();
  audio.removeAttribute('src');
  audio.load();

  // if you click the currently-playing track, toggle play/pause
  if (i === currentIndex && playerState === 'playing') {
    playPause();
    return;
  }

  // otherwise switch, load & play
  currentIndex = i;
  loadTrack(i);
  audio.play().catch(err => {
    if (err.message.includes('interrupted by a call to pause')) return;
    showPlayerError(`Play error: ${err.message}`);
  });
  playerState = 'playing';
  updatePlayerControls();
  highlightCurrentTrack();
}
// playlist info & utilities
// Updates the text showing the total number of tracks.
function updatePlaylistInfo() {
    const pi = document.getElementById('playlistInfo');
    if (pi) pi.textContent = `${playlist.length} tracks`;
}
// Formats seconds into a M:SS or H:MM:SS string.
function formatTime(sec) {
    if (!sec || isNaN(sec)) return '0:00';
    const h = Math.floor(sec / 3600),
          m = Math.floor((sec % 3600) / 60),
          s = Math.floor(sec % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
    return `${m}:${s.toString().padStart(2,'0')}`;
}
// Shuffles an array using the Fisher-Yates algorithm. Returns a new array.
function shuffleArray(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

// showPlayerError / retryCurrentTrack
// Displays an error message in the player UI.
function showPlayerError(msg) {
    const pw = document.getElementById('player-wrapper');
    if (!pw) return;
    const err = document.createElement('div');
    err.className = 'bg-red-800 text-white px-4 py-2 rounded-lg mb-4';
    err.innerHTML = `
        <div class="flex items-center">
            <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round".../>
            </svg>
            <span>${msg}</span>
        </div>
        <button class="mt-2 bg-red-700 hover:bg-red-600 px-3 py-1 rounded text-sm"
                onclick="retryCurrentTrack()">
            Retry
        </button>`;
    const existing = pw.querySelector('.bg-red-800');
    if (existing) existing.remove();
    pw.insertBefore(err, pw.firstChild);
}
// Retries loading the current track after an error.
function retryCurrentTrack() {
    const e = document.querySelector('.bg-red-800');
    if (e) e.remove();
    loadTrack(currentIndex);
    playPause();
}

// search click & enter
// Handles the search button click event.
function handleSearchClick() {
    const qi = document.getElementById('searchQuery');
    if (qi) { qi.blur(); searchShows(1); }
}
// Handles the 'Enter' key press in the search input.
function handleSearchKeyPress(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        const qi = document.getElementById('searchQuery');
        if (qi) { qi.blur(); searchShows(1); }
    }
}

// keyboard controls
// Sets up global keyboard shortcuts for the media player.
function setupKeyboardControls() {
    document.addEventListener('keydown', e => {
        const cp = document.getElementById('custom-player');
        if (!cp || cp.classList.contains('hidden')) return;
        // Ignore shortcuts if user is typing in an input field
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

        switch (e.key.toLowerCase()) {
            case ' ':
            case 'k':
                e.preventDefault(); playPauseWrapper();
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
                e.preventDefault(); toggleMute();
                break;
            case 'n':
                e.preventDefault(); nextTrack();
                break;
            case 'p':
                e.preventDefault(); prevTrack();
                break;
        }
    });
}

// DOMContentLoaded: decide search vs player
// Main entry point when the DOM is fully loaded.
document.addEventListener('DOMContentLoaded', function() {
    const isPlayerPage = window.location.pathname.includes('player.html');
    if (isPlayerPage) {
        try {
            // reset any stale state
            playlist = []; currentIndex = 0; isShuffled = false; loopMode = 'none'; playerState = 'paused';
            initializePlayer();
        } catch (error) {
            console.error('Fatal error initializing player page:', error);
            const pw = document.getElementById('player-wrapper');
            if (pw) pw.innerHTML = `
                <div class="bg-red-800 text-white p-4 rounded-lg">
                    <h3 class="font-bold">Error Loading Player</h3>
                    <p class="mt-2">${error.message || 'Unknown error'}</p>
                    <a href="index.html" class="underline text-blue-300">Return to Search</a>
                </div>`;
        }
    } else {
        // search-page init
        const searchButton = document.getElementById('searchButton');
        const searchQuery  = document.getElementById('searchQuery');
        const yearFrom     = document.getElementById('yearFrom');
        const yearTo       = document.getElementById('yearTo');
        const bandSelector = document.getElementById('bandSelector');
        const filterButtons= document.querySelectorAll('[data-filter]');
        const prevPage     = document.getElementById('prevPage');
        const nextPage     = document.getElementById('nextPage');

        // Set default years for the year range
        if (yearFrom) yearFrom.value = '1965';
        if (yearTo)   yearTo.value   = '2025';

        if (searchButton) searchButton.addEventListener('click', handleSearchClick);
        if (searchQuery)  searchQuery.addEventListener('keydown', handleSearchKeyPress);
        if (yearFrom)     yearFrom.addEventListener('change', () => searchShows(1));
        if (yearTo)       yearTo.addEventListener('change', () => searchShows(1));
        if (bandSelector) bandSelector.addEventListener('change', () => searchShows(1));

        // Load previously selected band if any
        if (bandSelector) {
            const savedBand = localStorage.getItem('selectedBand');
            if (savedBand) {
                bandSelector.value = savedBand;
                // Update page title and header to reflect the loaded band
                const headerTitle = document.querySelector('header h1');
                if (headerTitle && bandSelector.selectedOptions[0]) {
                    const bandName = bandSelector.selectedOptions[0].text;
                    headerTitle.textContent = `${bandName} Tape Finder`;
                    document.title = `${bandName} Tape Finder`;
                }
            }
            
            // Update localStorage when band changes
            bandSelector.addEventListener('change', function() {
                localStorage.setItem('selectedBand', this.value);
                // Reset to page 1 when changing bands
                currentPage = 1;
                // Update UI immediately
                searchShows(1);
            });
        }

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

        if (prevPage) prevPage.addEventListener('click', () => changePage(-1));
        if (nextPage) nextPage.addEventListener('click', () => changePage(1));

        searchShows(1);
        renderRecentlyViewed();
    }
});
