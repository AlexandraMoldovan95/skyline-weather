/* Skyline app logic. Kept in a file, not in the page, so the CSP (in _headers) can forbid inline scripts. */
// ============================================
// Skyline — Step 1: Login / API Key Authentication (BYOK)
// ============================================

const STORAGE_KEY = 'skyline_owm_api_key';

// Demo mode: true once the visitor chose "Try the demo" (or landed with ?demo=1)
// instead of entering their own OpenWeatherMap key. No network call is made
// to OpenWeatherMap while this is on - weather is generated locally.
let demoMode = false;

// DOM references
const loginScreen = document.getElementById('login-screen');
const appScreen = document.getElementById('app-screen');
const loginForm = document.getElementById('login-form');
const apiKeyInput = document.getElementById('api-key');
const formError = document.getElementById('form-error');
const toggleVisibilityBtn = document.getElementById('toggle-visibility');
const logoutBtn = document.getElementById('logout-btn');
const tryDemoBtn = document.getElementById('try-demo-btn');
const demoBanner = document.getElementById('demo-banner');

/**
 * Switches which screen is visible.
 * @param {'login' | 'app'} screenName
 */
function showScreen(screenName) {
  if (screenName === 'app') {
    loginScreen.classList.add('screen--hidden');
    appScreen.classList.remove('screen--hidden');
  } else {
    appScreen.classList.add('screen--hidden');
    loginScreen.classList.remove('screen--hidden');
  }
}

/**
 * Shows an error under the input, without using alert().
 * @param {string} message
 */
function setError(message) {
  formError.textContent = message;
  apiKeyInput.classList.toggle('is-invalid', Boolean(message));
}

/**
 * Checks whether a key is already saved in localStorage
 * and decides which screen to show when the page loads.
 * A link ending in ?demo=1 skips straight to the demo, no click needed -
 * that's the link the portfolio's "Try the demo" button uses.
 */
function checkExistingKey() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('demo') === '1') {
    enterDemoMode();
    return;
  }

  const savedKey = localStorage.getItem(STORAGE_KEY);
  if (savedKey) {
    showScreen('app');
  } else {
    showScreen('login');
  }
}

/**
 * Switches into demo mode: no API key required, no real network call.
 * Shows the app screen with a visible "demo mode" banner and immediately
 * runs one search so a visitor sees a result without typing anything.
 */
function enterDemoMode() {
  demoMode = true;
  logoutBtn.textContent = 'Exit demo';
  demoBanner.classList.remove('screen--hidden');
  showScreen('app');

  cityInput.value = 'Bucharest';
  countrySelect.value = 'RO';
  performSearch('Bucharest', 'RO');
}

/**
 * Handler for the login form submit.
 */
function handleLoginSubmit(event) {
  event.preventDefault();

  const rawValue = apiKeyInput.value.trim();

  if (!rawValue) {
    setError('The API key cannot be empty.');
    apiKeyInput.focus();
    return;
  }

  // Minimal length check — OpenWeatherMap keys are usually 32 characters,
  // but we don't hard-enforce 32 so we don't reject valid keys in other formats.
  if (rawValue.length < 10) {
    setError('The key looks too short. Check that you copied it in full.');
    apiKeyInput.focus();
    return;
  }

  setError('');
  localStorage.setItem(STORAGE_KEY, rawValue);
  apiKeyInput.value = '';
  showScreen('app');
}

/**
 * Handler for the logout / change-key button. Also used to exit demo mode,
 * since it's the same button (relabelled "Exit demo" while demoMode is on).
 */
function handleLogout() {
  localStorage.removeItem(STORAGE_KEY);
  demoMode = false;
  logoutBtn.textContent = 'Change key';
  demoBanner.classList.add('screen--hidden');
  resultsContainer.classList.add('results--empty');
  resultsContainer.innerHTML = '';
  showScreen('login');
}

/**
 * Toggles the input's text visibility (password <-> text).
 */
function handleToggleVisibility() {
  const isPassword = apiKeyInput.type === 'password';
  apiKeyInput.type = isPassword ? 'text' : 'password';
  toggleVisibilityBtn.textContent = isPassword ? '🙈' : '👁';
  toggleVisibilityBtn.setAttribute(
    'aria-label',
    isPassword ? 'Hide key' : 'Show key'
  );
}

// Event listeners
loginForm.addEventListener('submit', handleLoginSubmit);
logoutBtn.addEventListener('click', handleLogout);
toggleVisibilityBtn.addEventListener('click', handleToggleVisibility);
apiKeyInput.addEventListener('input', () => setError(''));
tryDemoBtn.addEventListener('click', enterDemoMode);

// Initialization moved to the very end of this script (after Step 2 below) -
// checkExistingKey() can jump straight into enterDemoMode() via ?demo=1,
// which needs the Step 2 search elements to already be declared.


// ============================================
// Skyline — Step 2: Search Form (City + Country)
// ============================================

const searchForm = document.getElementById('search-form');
const cityInput = document.getElementById('city-input');
const countrySelect = document.getElementById('country-select');
const searchError = document.getElementById('search-error');
const resultsContainer = document.getElementById('results');
const searchSubmitBtn = searchForm.querySelector('button[type="submit"]');

const WEATHER_API_BASE = 'https://api.openweathermap.org/data/2.5/weather';

/**
 * Shows / hides the error under the search form.
 * @param {string} message
 */
function setSearchError(message) {
  searchError.textContent = message;
  cityInput.classList.toggle('is-invalid', Boolean(message));
}

/**
 * Shows the "loading" state in the results container.
 */
function showLoadingState() {
  resultsContainer.classList.remove('results--empty');
  resultsContainer.innerHTML = `
    <div class="loading-state">
      <div class="spinner" role="status" aria-label="Loading"></div>
      <span>Loading weather…</span>
    </div>
  `;
}

/**
 * Shows an error message in the results container.
 * @param {string} message
 * @param {boolean} showKeyAction - whether to add a "Change key" button (for 401)
 */
function showResultError(message, showKeyAction = false) {
  resultsContainer.classList.remove('results--empty');
  resultsContainer.innerHTML = `
    <div class="result-error">
      <div class="result-error__icon">⚠️</div>
      <p class="result-error__message">${message}</p>
      ${showKeyAction ? '<button type="button" id="fix-key-btn" class="btn btn--ghost result-error__action">Re-enter API key</button>' : ''}
    </div>
  `;

  if (showKeyAction) {
    document.getElementById('fix-key-btn').addEventListener('click', () => {
      localStorage.removeItem(STORAGE_KEY);
      showScreen('login');
    });
  }
}

/**
 * Converts wind direction from degrees to an approximate cardinal point.
 * @param {number} deg
 */
function degToCompass(deg) {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return directions[Math.round(deg / 45) % 8];
}

/**
 * Escapes HTML-significant characters before a value is interpolated into
 * an innerHTML template string. Needed because the city name shown here can
 * come straight from what the user typed in the search box (demo mode's
 * fallback echoes it back as-is) - without this, typing something like
 * <img onerror=...> as a "city" would execute as markup instead of
 * displaying as plain text.
 * @param {string} value
 */
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
}

/**
 * Renders the weather card from a weather payload - either the real
 * OpenWeatherMap response, or the mock payload built by getMockWeatherData()
 * while in demo mode.
 * @param {object} data
 * @param {boolean} isDemo - adds a visible "sample data" tag to the card
 */
function renderWeatherCard(data, isDemo = false) {
  const cityName = escapeHtml(data.name || '—');
  const countryCode = escapeHtml(data.sys?.country || '');
  const temp = Math.round(data.main?.temp);
  const feelsLike = Math.round(data.main?.feels_like);
  const description = escapeHtml(data.weather?.[0]?.description || '');
  const iconCode = encodeURIComponent(data.weather?.[0]?.icon || '01d');
  const humidity = data.main?.humidity;
  const pressure = data.main?.pressure;
  const windSpeedKmh = data.wind?.speed != null ? Math.round(data.wind.speed * 3.6) : null;
  const windDeg = data.wind?.deg;

  resultsContainer.classList.remove('results--empty');
  resultsContainer.innerHTML = `
    <div class="weather-card">
      <p class="weather-card__location">${cityName}${countryCode ? ', ' + countryCode : ''}</p>
      ${isDemo ? '<p class="weather-card__demo-tag">Sample data - demo mode</p>' : ''}
      <div class="weather-card__main">
        <div class="weather-card__temp-block">
          <span class="weather-card__temp">${temp}°C</span>
          <span class="weather-card__desc">${description}</span>
        </div>
        <img
          class="weather-card__icon"
          src="https://openweathermap.org/img/wn/${iconCode}@2x.png"
          alt="${description}"
        >
      </div>
      <div class="weather-card__grid">
        <div class="weather-stat">
          <div class="weather-stat__label">Feels like</div>
          <div class="weather-stat__value"><strong>${feelsLike}°C</strong></div>
        </div>
        <div class="weather-stat">
          <div class="weather-stat__label">Humidity</div>
          <div class="weather-stat__value"><strong>${humidity ?? '—'}%</strong></div>
        </div>
        <div class="weather-stat">
          <div class="weather-stat__label">Wind</div>
          <div class="weather-stat__value">
            <strong>${windSpeedKmh ?? '—'} km/h</strong>${windDeg != null ? ' ' + degToCompass(windDeg) : ''}
          </div>
        </div>
        <div class="weather-stat">
          <div class="weather-stat__label">Pressure</div>
          <div class="weather-stat__value"><strong>${pressure ?? '—'}</strong> hPa</div>
        </div>
      </div>
    </div>
  `;
}

// ============================================
// Demo mode: fake weather data, no API key / no network call
// ============================================

// A handful of real cities get hand-picked, plausible-looking sample data.
const DEMO_CITIES = {
  'bucharest':    { name: 'Bucharest',    country: 'RO', temp: 23, feelsLike: 24, description: 'clear sky',         icon: '01d', humidity: 46, pressure: 1014, windKmh: 11, windDeg: 200 },
  'london':       { name: 'London',       country: 'GB', temp: 14, feelsLike: 13, description: 'light rain',        icon: '10d', humidity: 78, pressure: 1008, windKmh: 19, windDeg: 250 },
  'paris':        { name: 'Paris',        country: 'FR', temp: 17, feelsLike: 17, description: 'few clouds',        icon: '02d', humidity: 58, pressure: 1016, windKmh: 9,  windDeg: 180 },
  'new york':     { name: 'New York',     country: 'US', temp: 19, feelsLike: 18, description: 'broken clouds',     icon: '04d', humidity: 52, pressure: 1012, windKmh: 14, windDeg: 290 },
  'tokyo':        { name: 'Tokyo',        country: 'JP', temp: 21, feelsLike: 22, description: 'scattered clouds',  icon: '03d', humidity: 64, pressure: 1010, windKmh: 7,  windDeg: 90  },
  'rome':         { name: 'Rome',         country: 'IT', temp: 26, feelsLike: 27, description: 'clear sky',         icon: '01d', humidity: 41, pressure: 1018, windKmh: 10, windDeg: 160 },
  'berlin':       { name: 'Berlin',       country: 'DE', temp: 12, feelsLike: 10, description: 'overcast clouds',   icon: '04d', humidity: 70, pressure: 1006, windKmh: 21, windDeg: 230 },
  'madrid':       { name: 'Madrid',       country: 'ES', temp: 28, feelsLike: 27, description: 'clear sky',         icon: '01d', humidity: 32, pressure: 1015, windKmh: 8,  windDeg: 140 },
  'amsterdam':    { name: 'Amsterdam',    country: 'NL', temp: 13, feelsLike: 11, description: 'mist',              icon: '50d', humidity: 82, pressure: 1009, windKmh: 16, windDeg: 260 },
  'chisinau':     { name: 'Chisinau',     country: 'MD', temp: 20, feelsLike: 20, description: 'few clouds',        icon: '02d', humidity: 55, pressure: 1013, windKmh: 10, windDeg: 210 },
  'cluj-napoca':  { name: 'Cluj-Napoca',  country: 'RO', temp: 18, feelsLike: 17, description: 'scattered clouds',  icon: '03d', humidity: 60, pressure: 1011, windKmh: 12, windDeg: 220 },
  'barcelona':    { name: 'Barcelona',    country: 'ES', temp: 24, feelsLike: 24, description: 'clear sky',         icon: '01d', humidity: 48, pressure: 1016, windKmh: 13, windDeg: 170 },
};

// Any other city still "works" in the demo: a small deterministic hash of
// the name picks a condition and numbers in a plausible range, so the
// search box isn't limited to the twelve cities above.
const DEMO_CONDITIONS = [
  { description: 'clear sky',        icon: '01d' },
  { description: 'few clouds',       icon: '02d' },
  { description: 'scattered clouds', icon: '03d' },
  { description: 'broken clouds',    icon: '04d' },
  { description: 'light rain',       icon: '10d' },
  { description: 'thunderstorm',     icon: '11d' },
  { description: 'snow',             icon: '13d' },
  { description: 'mist',             icon: '50d' },
];

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Builds a fake weather payload shaped exactly like an OpenWeatherMap
 * response, so renderWeatherCard() doesn't need to know it's fake.
 * @param {string} city
 * @param {string} country - 2-letter ISO code, or empty string
 */
function getMockWeatherData(city, country) {
  const key = city.trim().toLowerCase();
  const preset = DEMO_CITIES[key];

  if (preset) {
    return {
      name: preset.name,
      sys: { country: country || preset.country },
      main: { temp: preset.temp, feels_like: preset.feelsLike, humidity: preset.humidity, pressure: preset.pressure },
      weather: [{ description: preset.description, icon: preset.icon }],
      wind: { speed: preset.windKmh / 3.6, deg: preset.windDeg },
    };
  }

  // Deterministic fallback, so typing any city still returns a result.
  const h = hashString(key + country);
  const condition = DEMO_CONDITIONS[h % DEMO_CONDITIONS.length];
  return {
    name: city.trim().replace(/\b\w/g, (c) => c.toUpperCase()),
    sys: { country: country || '' },
    main: {
      temp: 4 + (h % 27),
      feels_like: 2 + (h % 27),
      humidity: 35 + (h % 50),
      pressure: 995 + (h % 35),
    },
    weather: [condition],
    wind: { speed: (2 + (h % 22)) / 3.6, deg: h % 360 },
  };
}

/**
 * Calls the OpenWeatherMap Current Weather Data API - or, in demo mode,
 * builds a fake result locally after a short simulated delay so the
 * loading state still makes sense.
 * @param {string} city
 * @param {string} country - 2-letter ISO code, or empty string
 */
async function fetchWeather(city, country) {
  if (demoMode) {
    const data = getMockWeatherData(city, country);
    await new Promise((resolve) => setTimeout(resolve, 650));
    renderWeatherCard(data, true);
    return;
  }

  const apiKey = localStorage.getItem(STORAGE_KEY);
  const query = country ? `${city},${country}` : city;
  const url = `${WEATHER_API_BASE}?q=${encodeURIComponent(query)}&units=metric&lang=en&appid=${apiKey}`;

  let response;
  try {
    response = await fetch(url);
  } catch (networkErr) {
    showResultError("Couldn't connect. Check your internet connection and try again.");
    return;
  }

  let payload;
  try {
    payload = await response.json();
  } catch (parseErr) {
    showResultError('The response from the server was unexpected. Try again.');
    return;
  }

  if (response.status === 401) {
    showResultError('The API key looks invalid or has expired.', true);
    return;
  }

  if (response.status === 404) {
    showResultError('City not found. Check what you entered.');
    return;
  }

  if (!response.ok) {
    showResultError(`An unexpected error occurred (${response.status}). Try again.`);
    return;
  }

  renderWeatherCard(payload);
}

/**
 * Runs a search for a given city/country: shows the loading state, calls
 * fetchWeather (real or mocked), and re-enables the search button after.
 * Shared by the search form and by enterDemoMode()'s automatic first search.
 * @param {string} city
 * @param {string} country - 2-letter ISO code, or empty string
 */
async function performSearch(city, country) {
  setSearchError('');
  showLoadingState();

  searchSubmitBtn.disabled = true;
  try {
    await fetchWeather(city, country);
  } finally {
    searchSubmitBtn.disabled = false;
  }
}

/**
 * Handler for the search form submit.
 */
async function handleSearchSubmit(event) {
  event.preventDefault();

  const city = cityInput.value.trim();
  const country = countrySelect.value;

  if (!city) {
    setSearchError('Enter a city to search the weather.');
    cityInput.focus();
    return;
  }

  await performSearch(city, country);
}

searchForm.addEventListener('submit', handleSearchSubmit);
cityInput.addEventListener('input', () => setSearchError(''));

// Initialize on page load (placed here, not after Step 1, since this can
// call straight into enterDemoMode() via ?demo=1, which needs the search
// elements above to already be declared).
checkExistingKey();
