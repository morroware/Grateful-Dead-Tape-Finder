// bandConfig.js - Band search configuration with expanded collection support

const CURRENT_YEAR = new Date().getFullYear();

export const bandConfig = {
    // === SPECIAL OPTIONS ===
    'AllArchive': {
        query: 'mediatype:(etree)',
        title: 'All Archive.org Live Music',
        customSearch: false,
        yearRange: [1900, CURRENT_YEAR]
    },
    
    // === DEAD FAMILY ===
    'GratefulDead': {
        query: 'collection:(GratefulDead) AND mediatype:(etree) AND creator:(Grateful Dead)',
        title: 'Grateful Dead',
        yearRange: [1965, 1995]
    },
    'PhilLesh': {
        query: 'collection:(PhilLeshandFriends) AND mediatype:(etree)',
        title: 'Phil Lesh & Friends'
    },
    'JerryGarciaBand': {
        query: 'collection:(etree) AND creator:("Jerry Garcia Band" OR "JGB")',
        title: 'Jerry Garcia Band'
    },
    'RatDog': {
        query: 'collection:(etree) AND creator:("Ratdog" OR "Bob Weir and Ratdog")',
        title: 'Ratdog'
    },
    'BobWeir': {
        query: 'collection:(etree) AND creator:("Bob Weir") -creator:("Bob Weir and Ratdog")',
        title: 'Bob Weir'
    },
    'DeadAndCompany': {
        query: 'collection:(etree) AND creator:("Dead and Company" OR "Dead & Company")',
        title: 'Dead & Company'
    },
    'Furthur': {
        query: 'collection:(Furthur) AND mediatype:(etree)',
        title: 'Furthur'
    },
    'DarkStar': {
        query: 'collection:(DarkStarOrchestra) AND mediatype:(etree)',
        title: 'Dark Star Orchestra'
    },
    'JRAD': {
        query: 'collection:(JoeRussosAlmostDead) AND mediatype:(etree)',
        title: "Joe Russo's Almost Dead"
    },
    
    // === JAM BANDS ===
    'DiscoBiscuits': {
        query: 'collection:(DiscoBiscuits) AND mediatype:(etree)',
        title: 'Disco Biscuits'
    },
    'StringCheese': {
        query: 'collection:(StringCheeseIncident) AND mediatype:(etree)',
        title: 'String Cheese Incident'
    },
    'STS9': {
        query: 'collection:(SoundTribeSector9) AND mediatype:(etree)',
        title: 'STS9'
    },
    'moe': {
        query: 'collection:(moe) AND mediatype:(etree)',
        title: 'moe.'
    },
    'UmphreysMcGee': {
        query: 'collection:(UmphreysMcGee) AND mediatype:(etree)',
        title: "Umphrey's McGee"
    },
    'Goose': {
        query: 'collection:(GooseBand) AND mediatype:(etree)',
        title: 'Goose'
    },
    'WidespreadPanic': {
        query: 'collection:(WidespreadPanic) AND mediatype:(etree)',
        title: 'Widespread Panic'
    },
    'Lotus': {
        query: 'collection:(Lotus) AND mediatype:(etree)',
        title: 'Lotus'
    },
    'Twiddle': {
        query: 'collection:(Twiddle) AND mediatype:(etree)',
        title: 'Twiddle'
    },
    'Dopapod': {
        query: 'collection:(Dopapod) AND mediatype:(etree)',
        title: 'Dopapod'
    },
    'PigeonsPPP': {
        query: 'collection:(PigeonsPlayingPingPong) AND mediatype:(etree)',
        title: 'Pigeons Playing Ping Pong'
    },
    'Spafford': {
        query: 'collection:(Spafford) AND mediatype:(etree)',
        title: 'Spafford'
    },
    
    // === BLUEGRASS/ACOUSTIC ===
    'BillyStrings': {
        query: 'collection:(BillyStrings) AND mediatype:(etree)',
        title: 'Billy Strings'
    },
    'GreenskyBluegrass': {
        query: 'collection:(GreenskyBluegrass) AND mediatype:(etree)',
        title: 'Greensky Bluegrass'
    },
    'YonderMountain': {
        query: 'collection:(YonderMountainStringBand) AND mediatype:(etree)',
        title: 'Yonder Mountain String Band'
    },
    'LeftoverSalmon': {
        query: 'collection:(LeftoverSalmon) AND mediatype:(etree)',
        title: 'Leftover Salmon'
    },
    'KitchenDwellers': {
        query: 'collection:(KitchenDwellers) AND mediatype:(etree)',
        title: 'Kitchen Dwellers'
    },
    'InfamousStringdusters': {
        query: 'collection:(InfamousStringdusters) AND mediatype:(etree)',
        title: 'Infamous Stringdusters'
    },
    
    // === FUNK/SOUL ===
    'Lettuce': {
        query: 'collection:(Lettuce) AND mediatype:(etree)',
        title: 'Lettuce'
    },
    'Soulive': {
        query: 'collection:(Soulive) AND mediatype:(etree)',
        title: 'Soulive'
    },
    'GalacticFunk': {
        query: 'collection:(GalacticFunk) AND mediatype:(etree)',
        title: 'Galactic'
    },
    'Dumpstaphunk': {
        query: 'collection:(Dumpstaphunk) AND mediatype:(etree)',
        title: 'Dumpstaphunk'
    },
    'TheMotet': {
        query: 'collection:(TheMotet) AND mediatype:(etree)',
        title: 'The Motet'
    },
    'Vulfpeck': {
        query: 'collection:(Vulfpeck) AND mediatype:(etree)',
        title: 'Vulfpeck'
    },
    
    // === ROCK/INDIE ===
    'Ween': {
        query: 'collection:(Ween) AND mediatype:(etree)',
        title: 'Ween'
    },
    'KingGizzard': {
        query: 'collection:(KingGizzardAndTheLizardWizard) AND mediatype:(etree)',
        title: 'King Gizzard & The Lizard Wizard'
    },
    'Wilco': {
        query: 'collection:(Wilco) AND mediatype:(etree)',
        title: 'Wilco'
    },
    'MyMorningJacket': {
        query: 'collection:(MyMorningJacket) AND mediatype:(etree)',
        title: 'My Morning Jacket'
    },
    'DrDog': {
        query: 'collection:(DrDog) AND mediatype:(etree)',
        title: 'Dr. Dog'
    },
    'TenaciousD': {
        query: 'collection:(TenaciousD) AND mediatype:(etree)',
        title: 'Tenacious D'
    },
    
    // === ELECTRONIC/EXPERIMENTAL ===
    'Tipper': {
        query: 'collection:(Tipper) AND mediatype:(etree)',
        title: 'Tipper'
    },
    'Shpongle': {
        query: 'collection:(Shpongle) AND mediatype:(etree)',
        title: 'Shpongle'
    },
    'Papadosio': {
        query: 'collection:(Papadosio) AND mediatype:(etree)',
        title: 'Papadosio'
    },
    'EOTO': {
        query: 'collection:(EOTO) AND mediatype:(etree)',
        title: 'EOTO'
    },
    
    // === REGGAE/WORLD ===
    'Matisyahu': {
        query: 'collection:(Matisyahu) AND mediatype:(etree)',
        title: 'Matisyahu'
    },
    'RebelutionMusic': {
        query: 'collection:(RebelutionMusic) AND mediatype:(etree)',
        title: 'Rebelution'
    },
    'StickFigure': {
        query: 'collection:(StickFigure) AND mediatype:(etree)',
        title: 'Stick Figure'
    },
    
    // === SEARCH BY COLLECTION ===
    'Collection_Search': {
        query: null,
        title: 'Search by Collection Name',
        customSearch: true,
        placeholder: 'Enter collection name (e.g., "Phish", "WidespreadPanic")'
    },
    
    // === CUSTOM SEARCH ===
    'Custom': {
        query: null,
        title: 'Custom Search (All Archive)',
        customSearch: true,
        placeholder: 'Search all live music archives'
    }
};

// Get band configuration
export function getBandConfig(bandId) {
    return bandConfig[bandId] || bandConfig['AllArchive'];
}

// Get all band options for dropdown (organized by category)
export function getAllBands() {
    return [
        { group: 'Quick Options', options: [
            { id: 'AllArchive', title: '🌍 All Archive.org Live Music' },
            { id: 'Collection_Search', title: '🔍 Search by Collection Name' },
            { id: 'Custom', title: '⚙️ Custom Advanced Search' }
        ]},
        { group: 'Dead Family', options: [
            { id: 'GratefulDead', title: 'Grateful Dead' },
            { id: 'DeadAndCompany', title: 'Dead & Company' },
            { id: 'PhilLesh', title: 'Phil Lesh & Friends' },
            { id: 'JerryGarciaBand', title: 'Jerry Garcia Band' },
            { id: 'RatDog', title: 'Ratdog' },
            { id: 'BobWeir', title: 'Bob Weir' },
            { id: 'Furthur', title: 'Furthur' },
            { id: 'DarkStar', title: 'Dark Star Orchestra' },
            { id: 'JRAD', title: "Joe Russo's Almost Dead" }
        ]},
        { group: 'Jam Bands', options: [
            { id: 'WidespreadPanic', title: 'Widespread Panic' },
            { id: 'StringCheese', title: 'String Cheese Incident' },
            { id: 'UmphreysMcGee', title: "Umphrey's McGee" },
            { id: 'moe', title: 'moe.' },
            { id: 'DiscoBiscuits', title: 'Disco Biscuits' },
            { id: 'STS9', title: 'STS9' },
            { id: 'Goose', title: 'Goose' },
            { id: 'Lotus', title: 'Lotus' },
            { id: 'Twiddle', title: 'Twiddle' },
            { id: 'Dopapod', title: 'Dopapod' },
            { id: 'PigeonsPPP', title: 'Pigeons Playing Ping Pong' },
            { id: 'Spafford', title: 'Spafford' }
        ]},
        { group: 'Bluegrass/Acoustic', options: [
            { id: 'BillyStrings', title: 'Billy Strings' },
            { id: 'GreenskyBluegrass', title: 'Greensky Bluegrass' },
            { id: 'YonderMountain', title: 'Yonder Mountain String Band' },
            { id: 'LeftoverSalmon', title: 'Leftover Salmon' },
            { id: 'KitchenDwellers', title: 'Kitchen Dwellers' },
            { id: 'InfamousStringdusters', title: 'Infamous Stringdusters' }
        ]},
        { group: 'Funk/Soul', options: [
            { id: 'Lettuce', title: 'Lettuce' },
            { id: 'Soulive', title: 'Soulive' },
            { id: 'GalacticFunk', title: 'Galactic' },
            { id: 'Dumpstaphunk', title: 'Dumpstaphunk' },
            { id: 'TheMotet', title: 'The Motet' },
            { id: 'Vulfpeck', title: 'Vulfpeck' }
        ]},
        { group: 'Rock/Indie', options: [
            { id: 'Ween', title: 'Ween' },
            { id: 'Wilco', title: 'Wilco' },
            { id: 'MyMorningJacket', title: 'My Morning Jacket' },
            { id: 'KingGizzard', title: 'King Gizzard' },
            { id: 'DrDog', title: 'Dr. Dog' },
            { id: 'TenaciousD', title: 'Tenacious D' }
        ]},
        { group: 'Electronic', options: [
            { id: 'Tipper', title: 'Tipper' },
            { id: 'Papadosio', title: 'Papadosio' },
            { id: 'Shpongle', title: 'Shpongle' },
            { id: 'EOTO', title: 'EOTO' }
        ]}
    ];
}