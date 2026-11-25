// Skyline: the pure logic (no DOM, no network, no localStorage), shared by the page and the tests.
// Loaded with a plain <script> before app.js, so everything here is a global there;
// in Node (tests/logic.test.js) the same file is loaded with require().

const WEATHER_API_BASE = 'https://api.openweathermap.org/data/2.5/weather';

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
 * The OpenWeatherMap request URL. City and country travel as one encoded "q" value, so
 * whatever the user types can't add or change other parameters of the request.
 * @param {string} city
 * @param {string} country - 2-letter ISO code, or empty string
 * @param {string} apiKey - the visitor's own key
 */
function buildWeatherUrl(city, country, apiKey) {
  const query = country ? `${city},${country}` : city;
  return `${WEATHER_API_BASE}?q=${encodeURIComponent(query)}&units=metric&lang=en&appid=${apiKey}`;
}

/**
 * What to tell the user for an HTTP status from OpenWeatherMap, or null when it's fine.
 * A 401 also offers the "Re-enter API key" button.
 * @param {number} status
 */
function weatherErrorForStatus(status) {
  if (status === 401) return { message: 'The API key looks invalid or has expired.', showKeyAction: true };
  if (status === 404) return { message: 'City not found. Check what you entered.', showKeyAction: false };
  if (status < 200 || status > 299) {
    return { message: `An unexpected error occurred (${status}). Try again.`, showKeyAction: false };
  }
  return null;
}

/**
 * The values the weather card shows, from a weather payload (real or demo). Plain text:
 * renderWeatherCard() escapes it before it goes into the page. Wind comes in m/s and is
 * shown in km/h; the icon code is URL-encoded because it goes into the icon's address.
 * @param {object} data
 */
function weatherView(data) {
  const windDeg = data.wind?.deg;
  return {
    city: data.name || '—',
    country: data.sys?.country || '',
    temp: Math.round(data.main?.temp),
    feelsLike: Math.round(data.main?.feels_like),
    description: data.weather?.[0]?.description || '',
    iconCode: encodeURIComponent(data.weather?.[0]?.icon || '01d'),
    humidity: data.main?.humidity,
    pressure: data.main?.pressure,
    windKmh: data.wind?.speed != null ? Math.round(data.wind.speed * 3.6) : null,
    windDir: windDeg != null ? degToCompass(windDeg) : '',
  };
}

// In Node (the tests) `module` exists and the functions are exported; in the browser it doesn't,
// so this is skipped and everything above stays a plain global for app.js.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { WEATHER_API_BASE, DEMO_CITIES, DEMO_CONDITIONS, degToCompass, escapeHtml, hashString,
                     getMockWeatherData, buildWeatherUrl, weatherErrorForStatus, weatherView };
}
