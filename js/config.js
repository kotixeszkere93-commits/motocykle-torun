/* =========================================================================
   config.js — konfiguracja aplikacji, dane domenowe i stałe
   Wszystko w jednym miejscu, żeby zmiana regionu / punktów / punktacji
   nie wymagała grzebania w logice.
   ========================================================================= */

/** Konfiguracja projektu Firebase (projekt: motoswiry-torun). */
const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyAYUJTecN0qlD8rSP3RaNudQLHq9ogvDOc',
  authDomain: 'motoswiry-torun.firebaseapp.com',
  projectId: 'motoswiry-torun',
  storageBucket: 'motoswiry-torun.firebasestorage.app',
  messagingSenderId: '118192917482',
  appId: '1:118192917482:web:9756f6dba2c1ad1e8093',
  measurementId: 'G-LZV2S0GKT9'
};

const APP = {
  name: 'Moto Świry Toruń',
  version: '3.0.0',
  home: 'Toruń',
  homeCoords: [53.0138, 18.5984],
  contactEmail: 'motoswiry.torun@gmail.com',
  storagePrefix: 'mst:'
};

/** Regionalne przeskoki w planerze (chipy + select regionu trasy). */
const REGIONS = [
  { id: 'kujawy', name: 'Kujawy i Toruń', center: [53.0138, 18.5984], zoom: 10, note: 'Domowe tereny — asfalt wokół Wisły i krótkie szutry po pracy.' },
  { id: 'chelminski', name: 'Chełmiński Park Krajobrazowy', center: [53.27, 18.62], zoom: 11, note: 'Pagórki, wąskie asfalty i widoki na Dolinę Wisły.' },
  { id: 'bory-tucholskie', name: 'Bory Tucholskie', center: [53.72, 17.94], zoom: 10, note: 'Piach, szuter, sosny i Zalew Koronowski.' },
  { id: 'dolina-drwecy', name: 'Dolina Drwęcy', center: [53.22, 19.15], zoom: 11, note: 'Zamki w Golubiu-Dobrzyniu i Brodnicy, spokojne drogi.' },
  { id: 'pojezierze-brodnickie', name: 'Pojezierze Brodnickie', center: [53.32, 19.42], zoom: 11, note: 'Jeziora, wąskie asfalty, mały ruch.' },
  { id: 'kaszuby', name: 'Kaszuby', center: [54.2, 17.9], zoom: 10, note: 'Podjazdy, serpentyny i jeziora.' },
  { id: 'mazury', name: 'Mazury', center: [53.8, 21.6], zoom: 9, note: 'Wielkie przestrzenie i długie proste.' },
  { id: 'gory-swietokrzyskie', name: 'Góry Świętokrzyskie', center: [50.85, 20.9], zoom: 10, note: 'Łysica, dinozaury i kręte drogi.' },
  { id: 'bieszczady', name: 'Bieszczady', center: [49.25, 22.5], zoom: 9, note: 'Serpentyny, połoniny i puste drogi.' },
  { id: 'karkonosze', name: 'Karkonosze i Sudety', center: [50.8, 15.7], zoom: 9, note: 'Zakręty, przewyższenia i chłodne poranki.' },
  { id: 'suwalszczyzna', name: 'Suwalszczyzna', center: [54.1, 22.9], zoom: 9, note: 'Puste drogi, jeziora i Wigry.' },
  { id: 'rozgrzewka', name: 'Cała Polska', center: [52.0, 19.0], zoom: 6, note: 'Planowanie dłuższych wypraw przez cały kraj.' }
];

/** Punkty na trasie (POI) — warstwa pomocnicza planera. */
const POI_CATEGORIES = [
  { id: 'widok', label: 'Widoki', icon: 'mountain' },
  { id: 'paliwo', label: 'Paliwo 24h', icon: 'fuel' },
  { id: 'jedzenie', label: 'Jedzenie', icon: 'utensils' },
  { id: 'nocleg', label: 'Nocleg', icon: 'tent' },
  { id: 'warsztat', label: 'Warsztaty', icon: 'wrench' },
  { id: 'atrakcja', label: 'Atrakcje', icon: 'star' }
];

const POI = [
  { name: 'Zamek w Golubiu-Dobrzyniu', cat: 'atrakcja', lat: 53.1081, lng: 19.0531, note: 'Parking przy zamku, dobre miejsce na start albo przerwę.' },
  { name: 'Rynek w Chełmnie', cat: 'jedzenie', lat: 53.3485, lng: 18.4260, note: 'Kawa i obiad, ratusz i planty.' },
  { name: 'Zalew Koronowski — Tleń', cat: 'widok', lat: 53.6217, lng: 18.1394, note: 'Widok na zalew, plaża i smażalnia.' },
  { name: 'Zamek Bierzgłowski', cat: 'atrakcja', lat: 53.0917, lng: 18.4475, note: 'Gotyk na skraju Chełmińskiego Parku.' },
  { name: 'Wieża widokowa w Brodnicy', cat: 'widok', lat: 53.2576, lng: 19.3977, note: 'Panorama Pojezierza Brodnickiego.' },
  { name: 'Stacja paliw 24h — Świecie', cat: 'paliwo', lat: 53.4096, lng: 18.4465, note: 'Ostatnie tankowanie przed lasami.' },
  { name: 'Warsztat motocyklowy — Toruń Podgórz', cat: 'warsztat', lat: 52.9965, lng: 18.5857, note: 'Serwis ogumienia i przeglądy.' },
  { name: 'Warsztat — Bydgoszcz Fordon', cat: 'warsztat', lat: 53.1500, lng: 18.1700, note: 'Diagnostyka, elektryka, akcesoria.' },
  { name: 'Pole namiotowe w Okoninie', cat: 'nocleg', lat: 53.5 , lng: 18.8, note: 'Namioty, prysznice, cisza.' },
  { name: 'Restauracja nad Wisłą — Toruń', cat: 'jedzenie', lat: 53.0086, lng: 18.6012, note: 'Spotkanie ekipy, dużo miejsca na parkowanie.' },
  { name: 'Góra Zamkowa — Wda', cat: 'widok', lat: 53.65, lng: 18.32, note: 'Punkt widokowy nad Wdą.' },
  { name: 'Jezioro Wdzydze', cat: 'widok', lat: 53.95 , lng: 17.9, note: 'Kaszubskie jezioro, dobry postój.' },
  { name: 'Sopot — molo (meta wyprawy)', cat: 'atrakcja', lat: 54.4447, lng: 18.5707, note: 'Klasyczna meta nad morzem.' },
  { name: 'Hel — koniec Polski', cat: 'atrakcja', lat: 54.6081, lng: 18.8010, note: 'Ostatni punkt przed Bałtykiem.' },
  { name: 'Wilczy Szaniec (Gierłoż)', cat: 'atrakcja', lat: 54.0833, lng: 21.4950, note: 'Historia i las, wstęp biletowany.' },
  { name: 'Święty Krzyż — klasztor', cat: 'widok', lat: 50.8596, lng: 21.0470, note: 'Widok na Góry Świętokrzyskie.' },
  { name: 'Przełęcz Dukielska', cat: 'widok', lat: 49.4157, lng: 21.7 , note: 'Start w Bieszczady, serpentyny.' },
  { name: 'Zapora w Solinie', cat: 'widok', lat: 49.3575, lng: 22.4580, note: 'Legendarna pętla bieszczadzka.' },
  { name: 'Przełęcz Karkonoska', cat: 'widok', lat: 50.7690, lng: 15.6510, note: 'Droga z zakrętami, uwaga na mgłę.' },
  { name: 'Zamek Chojnik', cat: 'atrakcja', lat: 50.7655, lng: 15.6650, note: 'Podjazd i widok na Kotlinę Jeleniogórską.' },
  { name: 'Myjnia 24h — Cieszyn', cat: 'warsztat', lat: 49.7495, lng: 18.6300, note: 'Ostatnia myjnia i woda pod ciśnieniem przed górami.' },
  { name: 'Mierzeja Wiślana — Krynica Morska', cat: 'widok', lat: 54.3820, lng: 19.4440, note: 'Piach, wydmy, morze.' },
  { name: 'Wigry — klasztor', cat: 'atrakcja', lat: 54.0220, lng: 23.0800, note: 'Suwalszczyzna, spokój i jeziora.' },
  { name: 'Roztocze — Zwierzyniec', cat: 'atrakcja', lat: 50.6140, lng: 22.9740, note: 'Kręte drogi i Roztoczański Park.' }
];

/** Punktacja w rankingu. */
const POINTS = {
  route: 10,
  join: 2,
  suggestion: 3,
  comment: 1
};

/** Odznaki — sprawdzane na podstawie statystyk użytkownika. */
const BADGES = [
  { id: 'pierwsza-trasa', name: 'Pierwsza trasa', icon: 'route', desc: 'Opublikuj swoją pierwszą trasę.', test: s => s.routes >= 1 },
  { id: 'organizator', name: 'Organizator', icon: 'calendar', desc: 'Opublikuj 5 tras.', test: s => s.routes >= 5 },
  { id: 'architekt', name: 'Architekt wypraw', icon: 'compass', desc: 'Opublikuj 10 tras.', test: s => s.routes >= 10 },
  { id: 'ekipa', name: 'Ekipa', icon: 'users', desc: 'Dołącz do 3 wyjazdów.', test: s => s.joins >= 3 },
  { id: 'maratoner', name: 'Maratoner', icon: 'gauge', desc: 'Zaplanuj trasy o łącznej długości 1000 km.', test: s => s.km >= 1000 },
  { id: 'szutrowy-wariat', name: 'Szutrowy wariat', icon: 'mountain', desc: 'Opublikuj trasę oznaczoną jako szuter.', test: s => s.gravel >= 1 },
  { id: 'nocny-marek', name: 'Nocny marek', icon: 'moon', desc: 'Zdobądź 100 punktów.', test: s => s.score >= 100 },
  { id: 'legenda-swiru', name: 'Legenda Świrów', icon: 'trophy', desc: 'Zdobądź 250 punktów.', test: s => s.score >= 250 },
  { id: 'doradca', name: 'Doradca', icon: 'chat', desc: 'Wrzuć 3 propozycje zmian w trasach.', test: s => s.suggestions >= 3 }
];

const DIFFICULTY = {
  latwa: { label: 'Łatwa', cls: 'badge--latwa', desc: 'Asfalt, spokojne tempo, bez zaskoczeń.' },
  srednia: { label: 'Średnia', cls: 'badge--srednia', desc: 'Mieszana nawierzchnia, trochę szutru.' },
  trudna: { label: 'Trudna', cls: 'badge--trudna', desc: 'Szuter i techniczne odcinki — wymaga doświadczenia.' }
};

const SURFACE = {
  asfalt: { label: 'Asfalt', cls: 'badge--asfalt', icon: 'road' },
  mieszana: { label: 'Mieszana', cls: 'badge--mieszana', icon: 'route' },
  szuter: { label: 'Szuter i grunt', cls: 'badge--szuter', icon: 'mountain' }
};

/** Ustawienia planera i nawigacji. */
const PLANNER = {
  maxWaypoints: 12,
  fuelPriceDefault: 6.49,
  consumptionDefault: 5.2,
  avgSpeedFallback: 55,
  osrm: 'https://router.project-osrm.org/route/v1/driving/',
  osrmProfiles: { road: 'driving', gravel: 'driving' },
  weatherApi: 'https://api.open-meteo.com/v1/forecast'
};

/** Warstwy mapy. */
const TILES = {
  map: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19
  },
  terrain: {
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)',
    maxZoom: 17
  },
  sat: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri, Maxar, Earthstar Geographics',
    maxZoom: 18
  }
};

/** Granice domyślnego widoku mapy (Polska + bufor). */
const PL_BOUNDS = [[48.8, 13.5], [54.9, 24.5]];

/** Wiadomości w interfejsie (jedno miejsce na copy). */
const MSG = {
  loginRequired: 'Do tej akcji musisz być zalogowany. Kliknij „Zaloguj / Zarejestruj”.',
  localMode: 'Tryb lokalny: dane zapisują się tylko w tej przeglądarce.',
  cloudMode: 'Połączono z bazą społeczności.',
  offline: 'Jesteś offline — część funkcji (mapa, baza) może nie działać.',
  saved: 'Zapisano.',
  error: 'Coś poszło nie tak. Spróbuj ponownie.'
};

// Eksport dla testów w Node (jeśli plik ładowany jako moduł)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { FIREBASE_CONFIG, APP, REGIONS, POI, POI_CATEGORIES, POINTS, BADGES, DIFFICULTY, SURFACE, PLANNER, TILES, PL_BOUNDS, MSG };
}
