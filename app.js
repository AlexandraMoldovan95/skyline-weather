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

// WEATHER_API_BASE, buildWeatherUrl() and weatherErrorForStatus() are in logic.js.

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

// degToCompass(), escapeHtml() and weatherView() are in logic.js.

/**
 * Renders the weather card from a weather payload - either the real
 * OpenWeatherMap response, or the mock payload built by getMockWeatherData()
 * while in demo mode.
 * @param {object} data
 * @param {boolean} isDemo - adds a visible "sample data" tag to the card
 */
function renderWeatherCard(data, isDemo = false) {
  const v = weatherView(data);   // the numbers and texts: logic.js
  const cityName = escapeHtml(v.city);
  const countryCode = escapeHtml(v.country);
  const temp = v.temp;
  const feelsLike = v.feelsLike;
  const description = escapeHtml(v.description);
  const iconCode = v.iconCode;
  const humidity = v.humidity;
  const pressure = v.pressure;
  const windSpeedKmh = v.windKmh;

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
            <strong>${windSpeedKmh ?? '—'} km/h</strong>${v.windDir ? ' ' + v.windDir : ''}
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

// Demo mode's sample data and getMockWeatherData() are in logic.js.

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

  const url = buildWeatherUrl(city, country, localStorage.getItem(STORAGE_KEY));   // logic.js

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

  const problem = weatherErrorForStatus(response.status);   // 401 / 404 / other: logic.js
  if (problem) {
    showResultError(problem.message, problem.showKeyAction);
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
