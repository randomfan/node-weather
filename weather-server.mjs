// Require node_modules

import dayjs from 'dayjs'
import express from 'express'
import bodyParser from 'body-parser'
import request from 'request'
const app = express()

// Configure dotenv package
import dotenv from 'dotenv'
dotenv.config()

// Set up our openweathermap API_KEY

let apiKey = process.env.OPENWEATHERMAP_API_KEY
let weatherUnits = process.env.OPENWEATHERMAP_UNITS
if (weatherUnits != 'metric' && weatherUnits != 'imperial') weatherUnits = 'metric'

// import api wrapper classes
import postcodesIoApi from './api/postcodes.mjs'
import OpenWeatherMapApi from './api/weather.mjs'
const openWeatherMapApi = new OpenWeatherMapApi(apiKey, weatherUnits)

// Setup our express app and body-parser configurations
// Setup our javascript template view engine
app.use(express.static('public'))
app.use(bodyParser.urlencoded({ extended: true }))
app.set('view engine', 'ejs')

// Setup our default display on launch
app.get('/weather', async function(req, res) {
    // return view with just base form
    res.render('index', { weather: null, error: null })
})

// route redirect from root url
app.get('/', async (req, res) => {
    res.redirect('/weather');
});

// post request for when form submits to get weather data
app.post('/weather', async function(req, res) {

    // Get postcode passed in the form
    let postcode = req.body.postcode

    // validate provided postcode via API
    try {
        const data = await postcodesIoApi.request('validate', { postcode: postcode })
        let valid = data.result
        if (!valid) {
            res.render('index', { weather: null, error: 'Please enter a valid postcode' })
            return
        }
    } catch (error) {
        res.render('index', { weather: null, error: 'Error: failed to validate postcode' })
        return
    }

    let postcodeObj = {}
    // call API to look up lat/lon from postcode
    try {
        const data = await postcodesIoApi.request('lookup', { postcode: postcode })
        postcodeObj = data.result
    } catch (error) {
        res.render('index', { weather: null, error: 'Error: failed to lookup postcode details' })
        return
    }

    // grab location details from postcode lookup response
    let lat = postcodeObj.latitude
    let lon = postcodeObj.longitude
    let coords = { lat, lon }
    let location = `${postcodeObj.admin_district}, ${postcodeObj.country}`
    console.log(`Coordinates: lat ${lat} lon ${lon}`)
    console.log(`Location: ${location}`)

    // get current weather conditions
    let weather = {}
    try {
        weather = await openWeatherMapApi.getWeatherData(coords, 0)
    } catch (error) {
        res.render('index', { weather: null, error: `Error: ${error.message}` })
        return
    }

    console.log(weather)

    // helper stuff for weather
    const windDirections = [ 'N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW','N' ]
    // work out wind direction from wind degree
    const getWindDirection = (degree) => {
        let windDirectionIndex = Math.round(degree / 22.5)
        return windDirections[windDirectionIndex]
    }
    // weather units
    const tempUnit = weatherUnits == 'metric' ? '°C' : '°F'
    const windSpeedUnit = weatherUnits == 'metric' ? 'm/s' : 'mi/hr'
    const pressureUnit = 'hPa'

    // set up object to be passed to view for all the weather data
    let current = weather.current
    let today = dayjs(current.dt * 1000)
    let sunrise = dayjs(current.sunrise * 1000)
    let sunset = dayjs(current.sunset * 1000)

    let data = {
        location: location,
        datetime: today.format('dddd DD MMMM YYYY, hh:mma'),
        sunrise: sunrise.format('hh:mma'),
        sunset: sunset.format('hh:mma'),
        main: current.main,
        description: current.description,
        temperature: `${current.temperature} ${tempUnit}`,
        feelsLike: `${current.feelsLike} ${tempUnit}`,
        humidity: current.humidity,
        pressure: current.pressure,
        visibility: current.visibility,
        icon: `http://openweathermap.org/img/wn/${current.icon}@2x.png`,
        clouds: current.clouds,
        windSpeed: `${current.windSpeed} ${windSpeedUnit}`,
        windDirection: getWindDirection(current.windDegree)
    }

    // now render the view with the weather data
    res.render('index', { weather: data, error: null })

})

// set up app listening port
app.listen(5000, function() {
    console.log('Weather app listening on port 5000!')
})