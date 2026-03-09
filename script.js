console.log("Weather dashboard loaded");

document.getElementById("getWeather").addEventListener("click", function() {

    const city = document.getElementById("cityInput").value;

    console.log("City entered:", city);


    fetch(`https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=27c03d243226010189df240e219e42de
    `)


    .then(response => {
    
        if (!response.ok) {
            throw new Error("City not found");
        }
    
        return response.json();
    })
    
    .then(data => {
    
        document.getElementById("city").innerText =
        "City: " + data.name;
    
        document.getElementById("temperature").innerText =
        "Temperature: " + data.main.temp + " °F";
    
        document.getElementById("description").innerText =
        "Weather: " + data.weather[0].description;
    
    })
    
    .catch(error => {
    
        document.getElementById("city").innerText = "Error";
        document.getElementById("temperature").innerText = "";
        document.getElementById("description").innerText = error.message;
    
    });

});
