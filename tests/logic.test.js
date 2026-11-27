// Tests for logic.js: the weather card's numbers, wind direction, escaping, the request URL,
// the error messages per HTTP status, demo mode's sample data, and the theme choice.
// No browser, no network, no API key.
// Run:  node --test tests/
const test = require("node:test");
const assert = require("node:assert/strict");
const L = require("../logic.js");

// ---------- wind direction ----------

test("wind degrees become the nearest of 8 compass points", () => {
  assert.equal(L.degToCompass(0), "N");
  assert.equal(L.degToCompass(90), "E");
  assert.equal(L.degToCompass(180), "S");
  assert.equal(L.degToCompass(250), "W");      // 5.56 x 45 rounds to W, not SW
  assert.equal(L.degToCompass(210), "SW");
});

test("the compass wraps around: 359 degrees is north, 22 is still north, 23 is north-east", () => {
  assert.equal(L.degToCompass(359), "N");
  assert.equal(L.degToCompass(22), "N");
  assert.equal(L.degToCompass(23), "NE");
  assert.equal(L.degToCompass(337), "NW");
});

// ---------- the weather card ----------

const REAL = { name: "London", sys: { country: "GB" }, main: { temp: 12.6, feels_like: 11.4, humidity: 71, pressure: 1013 },
               weather: [{ description: "light rain", icon: "10d" }], wind: { speed: 4.1, deg: 210 } };

test("a real payload: temperatures rounded, wind from m/s to km/h with its direction", () => {
  assert.deepEqual(L.weatherView(REAL), {
    city: "London", country: "GB", temp: 13, feelsLike: 11, description: "light rain", iconCode: "10d",
    humidity: 71, pressure: 1013, windKmh: 15, windDir: "SW",
  });
});

test("missing fields don't break the card: a dash for the city, no wind, the clear-sky icon", () => {
  const v = L.weatherView({ main: { temp: 3 } });
  assert.equal(v.city, "—");
  assert.equal(v.country, "");
  assert.equal(v.windKmh, null);
  assert.equal(v.windDir, "");
  assert.equal(v.iconCode, "01d");
  assert.equal(v.humidity, undefined);         // shown as "—" by the card
});

test("calm wind (0 m/s, 0 degrees) is shown as 0 km/h N, not as missing", () => {
  const v = L.weatherView({ ...REAL, wind: { speed: 0, deg: 0 } });
  assert.equal(v.windKmh, 0);
  assert.equal(v.windDir, "N");
});

test("the icon code can't change the icon's address", () => {
  const v = L.weatherView({ ...REAL, weather: [{ description: "x", icon: "../../evil?x=1" }] });
  assert.equal(v.iconCode, "..%2F..%2Fevil%3Fx%3D1");
});

// ---------- escaping ----------

test("a city typed as markup is shown as text", () => {
  // demo mode echoes an unknown city's name back, so this is what reaches the card
  const name = L.getMockWeatherData('<img src=x onerror="alert(1)">', "").name;
  const shown = L.escapeHtml(L.weatherView({ name }).city);
  assert.doesNotMatch(shown, /<img/i);
  // (demo mode capitalizes each word of an unknown city, hence /i)
  assert.match(shown, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/i);
});

// ---------- the request ----------

test("the request URL: city and country in one encoded q, metric units, the visitor's key", () => {
  assert.equal(L.buildWeatherUrl("London", "GB", "k3y"),
    "https://api.openweathermap.org/data/2.5/weather?q=London%2CGB&units=metric&lang=en&appid=k3y");
  assert.equal(L.buildWeatherUrl("São Paulo", "", "k"),
    "https://api.openweathermap.org/data/2.5/weather?q=S%C3%A3o%20Paulo&units=metric&lang=en&appid=k");
});

test("whatever is typed as the city can't add parameters to the request", () => {
  const url = new URL(L.buildWeatherUrl("Paris&appid=someone-elses-key&units=imperial", "", "mine"));
  assert.equal(url.searchParams.getAll("appid").join(), "mine");
  assert.equal(url.searchParams.get("units"), "metric");
  assert.equal(url.searchParams.get("q"), "Paris&appid=someone-elses-key&units=imperial");
});

// ---------- error messages ----------

test("401 says the key is the problem and offers to re-enter it", () => {
  assert.deepEqual(L.weatherErrorForStatus(401), { message: "The API key looks invalid or has expired.", showKeyAction: true });
});

test("404 says the city wasn't found; any other failure shows its status code", () => {
  assert.match(L.weatherErrorForStatus(404).message, /City not found/);
  assert.equal(L.weatherErrorForStatus(404).showKeyAction, false);
  assert.match(L.weatherErrorForStatus(429).message, /\(429\)/);
  assert.match(L.weatherErrorForStatus(500).message, /\(500\)/);
});

test("a successful status is not an error", () => {
  assert.equal(L.weatherErrorForStatus(200), null);
});

// ---------- demo mode ----------

test("demo: a known city is found whatever the case and spaces, and its wind round-trips to km/h", () => {
  const d = L.getMockWeatherData("  LONDON ", "");
  assert.equal(d.name, "London");
  assert.equal(d.sys.country, "GB");
  assert.equal(L.weatherView(d).windKmh, L.DEMO_CITIES.london.windKmh);   // stored in km/h, sent as m/s
});

test("demo: the country picked in the form wins over the preset's", () => {
  assert.equal(L.getMockWeatherData("Paris", "US").sys.country, "US");
});

test("demo: any other city gets the same plausible weather every time", () => {
  const a = L.getMockWeatherData("springfield", "US");
  assert.deepEqual(L.getMockWeatherData("springfield", "US"), a);
  assert.equal(a.name, "Springfield");
  assert.ok(a.main.temp >= 4 && a.main.temp <= 30, "temperature " + a.main.temp);
  assert.ok(a.main.humidity >= 35 && a.main.humidity <= 84, "humidity " + a.main.humidity);
  assert.ok(a.main.pressure >= 995 && a.main.pressure <= 1029, "pressure " + a.main.pressure);
  assert.ok(L.DEMO_CONDITIONS.includes(a.weather[0]));
});

test("demo: every preset city has the fields the card needs", () => {
  for (const [key, c] of Object.entries(L.DEMO_CITIES)) {
    assert.equal(key, key.toLowerCase().trim(), key);
    for (const field of ["name", "country", "temp", "feelsLike", "description", "icon", "humidity", "pressure", "windKmh", "windDeg"]) {
      assert.ok(c[field] !== undefined && c[field] !== "", key + "." + field);
    }
    assert.match(c.icon, /^\d\dd$/, key);
  }
});

// ---------- the theme ----------

test("a saved theme choice wins over the system setting", () => {
  assert.equal(L.pickTheme("light", true), "light");
  assert.equal(L.pickTheme("dark", false), "dark");
});

test("with nothing saved, the system setting decides the theme", () => {
  assert.equal(L.pickTheme(null, true), "dark");
  assert.equal(L.pickTheme(null, false), "light");
});

test("a saved theme that isn't dark or light is ignored", () => {
  assert.equal(L.pickTheme("purple", true), "dark");
  assert.equal(L.pickTheme("", false), "light");
});
