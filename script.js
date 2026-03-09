console.log("Weather dashboard loaded");

document.getElementById("getWeather").addEventListener("click", function() {

    const city = document.getElementById("cityInput").value;

    console.log("City entered:", city);

    fetch(`https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=27c03d243226010189df240e219e42de
    `)

    .then(response => response.json())

    .then(data => {

        console.log(data);

        document.getElementById("city").innerText =
        "City: " + data.name;

        document.getElementById("temperature").innerText =
        "Temperature: " + data.main.temp + " °F";

        document.getElementById("description").innerText =
        "Weather: " + data.weather[0].description;

    });

});