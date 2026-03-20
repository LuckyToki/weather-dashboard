const cityInput = document.getElementById("cityInput");
const getWeatherButton = document.getElementById("getWeather");
const useLocationButton = document.getElementById("useLocation");
const cityName = document.getElementById("cityName");
const temperature = document.getElementById("temperature");
const condition = document.getElementById("condition");
const styleAdvice = document.getElementById("styleAdvice");
const statusText = document.getElementById("statusText");
const weatherIcon = document.getElementById("weatherIcon");
const weatherMood = document.getElementById("weatherMood");
const feedbackMessage = document.getElementById("feedbackMessage");
const resolvedLocation = document.getElementById("resolvedLocation");
const suggestions = document.getElementById("suggestions");

let suggestionResults = [];
let suggestionRequestId = 0;

getWeatherButton.addEventListener("click", fetchWeatherByCity);
useLocationButton.addEventListener("click", getLocation);

cityInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        fetchWeatherByCity();
    }
});

cityInput.addEventListener("input", debounce(handleAutocomplete, 250));

document.addEventListener("click", (event) => {
    const clickedInsideSuggestions = suggestions.contains(event.target);
    const clickedInput = cityInput.contains(event.target);

    if (!clickedInsideSuggestions && !clickedInput) {
        hideSuggestions();
    }
});

function getLocation() {
    if (!navigator.geolocation) {
        setFeedback("Geolocation is not supported by this browser. Use manual search instead.", "error");
        return;
    }

    statusText.innerText = "Locating device";
    setFeedback("Requesting your current coordinates...", "success");

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const { latitude, longitude } = position.coords;
            await fetchWeatherByCoords(latitude, longitude);
            setFeedback("Using your current location for the weather briefing.", "success");
        },
        (error) => {
            const message = getGeolocationErrorMessage(error);
            statusText.innerText = "Geolocation unavailable";
            setFeedback(message, "error");
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 300000
        }
    );
}

async function fetchWeatherByCoords(latitude, longitude) {
    statusText.innerText = "Fetching coordinate weather";

    try {
        const weatherData = await fetchJson(`https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${API_KEY}&units=imperial`);
        const locationData = await safeReverseGeocode(latitude, longitude);

        renderWeather(weatherData, locationData);
    } catch (error) {
        console.error("Error fetching weather by coordinates:", error);
        renderWeatherError("Unable to retrieve weather for your current location.");
    }
}

async function fetchWeatherByCity() {
    const rawInput = cityInput.value.trim();

    if (!rawInput) {
        renderEmptySearchState();
        return;
    }

    statusText.innerText = "Resolving location";
    setFeedback("Searching for the most accurate location match...", "success");

    try {
        const location = await resolveLocationFromInput(rawInput);

        if (!location) {
            renderWeatherError("Location not found. Try `City, State, Country` for a clearer match.");
            return;
        }

        cityInput.value = buildInputLabel(location);
        hideSuggestions();
        await fetchWeatherByCoords(location.lat, location.lon);
        setFeedback(`Resolved location: ${buildInputLabel(location)}`, "success");
    } catch (error) {
        console.error("Error fetching weather by city:", error);
        renderWeatherError("Location not found. Verify the spelling and try again.");
    }
}

async function resolveLocationFromInput(rawInput) {
    const parsed = parseLocationInput(rawInput);
    const directQuery = [parsed.city, parsed.state, parsed.country].filter(Boolean).join(",");

    const results = await fetchJson(`https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(directQuery)}&limit=5&appid=${API_KEY}`);

    if (!Array.isArray(results) || results.length === 0) {
        return null;
    }

    if (parsed.state || parsed.country) {
        return results[0];
    }

    return pickBestLocation(results);
}

async function reverseGeocode(latitude, longitude) {
    const results = await fetchJson(`https://api.openweathermap.org/geo/1.0/reverse?lat=${latitude}&lon=${longitude}&limit=1&appid=${API_KEY}`);
    return Array.isArray(results) && results.length ? results[0] : null;
}

async function safeReverseGeocode(latitude, longitude) {
    try {
        return await reverseGeocode(latitude, longitude);
    } catch (error) {
        console.warn("Reverse geocoding failed:", error);
        return null;
    }
}

async function handleAutocomplete() {
    const query = cityInput.value.trim();
    const requestId = ++suggestionRequestId;

    if (query.length < 2) {
        hideSuggestions();
        return;
    }

    try {
        const results = await fetchJson(`https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(query)}&limit=5&appid=${API_KEY}`);

        if (requestId !== suggestionRequestId) {
            return;
        }

        suggestionResults = Array.isArray(results) ? results : [];
        renderSuggestions(suggestionResults);
    } catch (error) {
        console.error("Autocomplete lookup failed:", error);
        hideSuggestions();
    }
}

function renderSuggestions(results) {
    suggestions.innerHTML = "";

    if (!results.length) {
        hideSuggestions();
        return;
    }

    results.forEach((result) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "suggestion-item";
        button.innerHTML = `
            <span class="suggestion-main">${escapeHtml(buildInputLabel(result))}</span>
            <span class="suggestion-meta">Coordinates ${result.lat.toFixed(2)}, ${result.lon.toFixed(2)}</span>
        `;

        button.addEventListener("click", async () => {
            cityInput.value = buildInputLabel(result);
            hideSuggestions();
            await fetchWeatherByCoords(result.lat, result.lon);
            setFeedback(`Resolved location: ${buildInputLabel(result)}`, "success");
        });

        suggestions.appendChild(button);
    });

    suggestions.hidden = false;
}

function hideSuggestions() {
    suggestionResults = [];
    suggestions.hidden = true;
    suggestions.innerHTML = "";
}

function renderWeather(weatherData, locationData) {
    const temp = Math.round(weatherData.main.temp);
    const weather = weatherData.weather[0].main;
    const locationLabel = buildResolvedLocation(weatherData, locationData);

    cityName.innerText = locationLabel;
    cityInput.value = locationLabel;
    temperature.innerText = `${temp}°F`;
    condition.innerText = weather;
    weatherIcon.innerText = getWeatherIcon(weather);
    weatherMood.innerText = buildWeatherMood(temp, weather);
    resolvedLocation.innerText = `Resolved location: ${locationLabel}`;
    statusText.innerText = "Synchronized";

    recommendStyle(temp, weather);
}

function renderWeatherError(message) {
    cityName.innerText = "Signal lost";
    temperature.innerText = "--°F";
    condition.innerText = "Unavailable";
    weatherIcon.innerText = "◌";
    weatherMood.innerText = "The external weather source did not return a usable forecast for this query.";
    resolvedLocation.innerText = "Resolved location: unavailable";
    statusText.innerText = "Lookup failed";
    setFeedback(message, "error");
    renderItems(["Verify city spelling", "Add state or country", "Retry the weather request"]);
}

function renderEmptySearchState() {
    cityName.innerText = "No city selected";
    temperature.innerText = "--°F";
    condition.innerText = "Standby";
    weatherIcon.innerText = "◎";
    weatherMood.innerText = "Enter a city or use your current location to generate a weather briefing.";
    resolvedLocation.innerText = "Resolved location: waiting for input";
    statusText.innerText = "Location required";
    setFeedback("Enter a city before searching.", "error");
    renderItems(["City name required", "Or use your current location"]);
}

function recommendStyle(temp, weather) {
    let items = [];

    if (temp < 45) {
        items = ["Wool coat", "Thermal layer", "Weatherproof boots"];
    } else if (temp < 65) {
        items = ["Light jacket", "Long sleeve shirt", "Structured trousers"];
    } else {
        items = ["Breathable shirt", "Lightweight layers", "Sunglasses"];
    }

    if (weather === "Rain" || weather === "Drizzle" || weather === "Thunderstorm") {
        items.push("Umbrella");
    }

    if (weather === "Snow") {
        items.push("Insulated gloves");
    }

    if (weather === "Clear" && temp >= 72) {
        items.push("Water bottle");
    }

    renderItems(items);
}

function renderItems(items) {
    styleAdvice.innerHTML = "";

    items.forEach((item) => {
        const li = document.createElement("li");
        li.textContent = item;
        styleAdvice.appendChild(li);
    });
}

function buildResolvedLocation(weatherData, locationData) {
    const city = locationData?.name || weatherData.name || "Unknown";
    const state = locationData?.state || "";
    const country = locationData?.country || weatherData.sys?.country || "";

    return [city, state, country].filter(Boolean).join(", ");
}

function buildInputLabel(location) {
    return [location.name, location.state, location.country].filter(Boolean).join(", ");
}

function parseLocationInput(input) {
    const [city = "", state = "", country = ""] = input
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);

    return { city, state, country };
}

function pickBestLocation(results) {
    const exactNameMatches = results.filter((result) => result.name.toLowerCase() === parseLocationInput(cityInput.value).city.toLowerCase());
    return exactNameMatches[0] || results[0];
}

function setFeedback(message, type) {
    feedbackMessage.innerText = message;
    feedbackMessage.classList.remove("is-error", "is-success");

    if (type === "error") {
        feedbackMessage.classList.add("is-error");
    }

    if (type === "success") {
        feedbackMessage.classList.add("is-success");
    }
}

function getGeolocationErrorMessage(error) {
    if (error.code === error.PERMISSION_DENIED) {
        return "Location permission was denied. You can still search manually using city, state, or country.";
    }

    if (error.code === error.POSITION_UNAVAILABLE) {
        return "Your current position could not be determined. Try manual search instead.";
    }

    if (error.code === error.TIMEOUT) {
        return "Location lookup timed out. Try again or enter your city manually.";
    }

    return "Geolocation failed. Use the manual location search instead.";
}

function getWeatherIcon(weather) {
    const iconMap = {
        Clear: "◐",
        Clouds: "☰",
        Rain: "☂",
        Drizzle: "☔",
        Thunderstorm: "⚡",
        Snow: "❄",
        Mist: "◌",
        Fog: "◌",
        Haze: "◌"
    };

    return iconMap[weather] || "◎";
}

function buildWeatherMood(temp, weather) {
    if (weather === "Rain" || weather === "Drizzle") {
        return "Low-visibility pattern with surface moisture. Keep outer layers light but protective.";
    }

    if (weather === "Thunderstorm") {
        return "Convective activity detected. Prioritize coverage, waterproofing, and quick movement.";
    }

    if (weather === "Snow") {
        return "Cold atmospheric load with likely ground chill. Insulation and traction matter most.";
    }

    if (temp < 45) {
        return "Cool temperature band with elevated wind-chill sensitivity. Layering is recommended.";
    }

    if (temp > 78) {
        return "Warm air mass with comfortable visibility. Favor breathable pieces and hydration.";
    }

    return "Balanced visibility and mild temperature range. Lightweight layers should be sufficient.";
}

async function fetchJson(url) {
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || "Request failed");
    }

    return data;
}

function debounce(callback, delay) {
    let timeoutId;

    return (...args) => {
        window.clearTimeout(timeoutId);
        timeoutId = window.setTimeout(() => callback(...args), delay);
    };
}

function escapeHtml(value) {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}
