import axios from 'axios'

class OpenWeatherMapApi {
    // constructor to set up base config for API, and definitions for the available endpoints
    constructor(apikey, units) {
        this.baseUrl = "https://api.openweathermap.org/data/2.5"
        this.apikey = apikey
        this.units = units

        this.endpoints = {
            // endpoint for getting current weather condition
            weather: (options = {}) => {
                return {
                    method: 'get',
                    resource: '/weather',
                    params: {
                        lat: options.lat,
                        lon: options.lon,
                        units: this.units,
                        appid: this.apikey
                    },
                    headers: null,
                    body: null,
                }
            },
            // endpoint for getting 5 day 3 hourly forecast
            forecast: (options = {}) => {
                return {
                    method: 'get',
                    resource: '/forecast',
                    params: {
                        lat: options.lat,
                        lon: options.lon,
                        units: this.units,
                        cnt: options.cnt ? options.cnt : null,  // optional param to specify how many forecast data points to return
                        appid: this.apikey
                    },
                    headers: null,
                    body: null,
                }
            },
        }
    }

    // function to make the API request to server using given endpoint, and return complete JSON data
    async request(action, options = {}) {
        // make sure an action is specified
        if (!action) {
            throw Error('you must specify a pre-defined action when calling request function')
        }

        // get pre-defined request definition for the given action
        const getEndpointDefinition = this.endpoints[action]
        if (!getEndpointDefinition) {
            throw Error(`api action [${action}] not recognised by wrapper class`)
        }
        const endpoint = getEndpointDefinition(options)
        
        // make api call using axios library
        try {
            const response = await axios({
                method: endpoint.method,
                url: `${this.baseUrl}${endpoint.resource}`,
                params: endpoint.params,
                data: endpoint.body ? JSON.stringify(endpoint.body) : null,
                headers: endpoint.headers
            })
            return response.data
        } catch (error) {
            if (error.response) {
                // response received from server with non-2xx code
                console.log(error)
                throw new Error(`error response from server: ${error.response.data.cod} ${error.response.data.message}`)
            } else if (error.request) {
                // request made but no response received
                console.log(error.message)
                throw new Error(error.message)
            } else {
                // error setting up request
                console.log(error.message)
                throw new Error(error.message)
            }
        }
        
    }

    // function to use above request function to get current and forecast weather data and return transformed object with simplified view
    async getWeatherData(coords, cnt = null) {
        let data = { current: {}, forecast: {} }
        try {
            const weather = await this.request('weather', { lat: coords.lat, lon: coords.lon })
            let dt = `${weather.dt}`
            let main = `${weather.weather[0].main}`
            let description = `${weather.weather[0].description}`
            let icon = `${weather.weather[0].icon}`
            let temperature = `${Math.round(weather.main.temp)}`
            let feelsLike = `${Math.round(weather.main.feels_like)}`
            let pressure = `${weather.main.pressure}`
            let humidity = `${weather.main.humidity}`
            let clouds = `${weather.clouds.all}`
            let visibility = `${weather.visibility}`
            let windSpeed = `${Math.round(weather.wind.speed)}`
            let windDegree = `${weather.wind.deg}`
            let windDirection = this.getWindDirection(windDegree)
            let sunrise = `${weather.sys.sunrise}`
            let sunset = `${weather.sys.sunset}`
            data.current = { 
                dt, main, description, icon, temperature, feelsLike, pressure, humidity, clouds, visibility, windSpeed, windDegree, windDirection, sunrise, sunset 
            }
        } catch (error) {
            throw new Error(`Error retrieving current weather: ${error.message}`)
        }

        // only get forecast data if cnt isn't set to 0
        if (cnt === null || cnt > 0) {
            try {
                const forecast = await this.request('forecast', { lat: coords.lat, lon: coords.lon, cnt: cnt })
                // function to transform each item in the list array to flat object
                let forecastData = forecast.list.map((weather) => {
                    let dt = `${weather.dt}`
                    let main = `${weather.weather[0].main}`
                    let description = `${weather.weather[0].description}`
                    let icon = `${weather.weather[0].icon}`
                    let temperature = `${Math.round(weather.main.temp)}`
                    let feelsLike = `${Math.round(weather.main.feels_like)}`
                    let pressure = `${weather.main.pressure}`
                    let humidity = `${weather.main.humidity}`
                    let clouds = `${weather.clouds.all}`
                    let visibility = `${weather.visibility}`
                    let windSpeed = `${Math.round(weather.wind.speed)}`
                    let windDegree = `${weather.wind.deg}`
                    let windDirection = this.getWindDirection(windDegree)
                    return { 
                        dt, main, description, icon, temperature, feelsLike, pressure, humidity, visibility, clouds, windSpeed, windDegree, windDirection 
                    }
                })
                data.forecast = forecastData
            } catch (error) {
                throw new Error(`Error retrieving forecast weather: ${error.message}`)
            }
        }

        // return complete object containing current and forecast data
        return data
    }

    // work out wind direction from wind degree
    getWindDirection (degree) {
        const windDirections = [ 'N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW','N' ]
        degree = degree % 360   // just in case the degree is > 360
        let windDirectionIndex = Math.round(degree / 22.5)
        return windDirections[windDirectionIndex]
    }

    getUnit (type) {
        switch(type) {
            case 'temp':
                return this.units == 'metric' ? '°C' : '°F'
                break;
            case 'windspeed':
                return this.units == 'metric' ? 'm/s' : 'mi/hr'
                break;
            case 'pressure':
                return 'hPa'
                break;
            default:
                throw new Error(`unknown unit type [${type}]`)
                break;
        }
    }
}
  
export default OpenWeatherMapApi;