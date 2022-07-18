// UI related packages
import inquirer from 'inquirer'

import { AsciiTable3 } from 'ascii-table3'

import asciichart from 'asciichart'

import boxen from 'boxen'

import chalk from 'chalk'
const chalkError = chalk.bold.red
const chalkWarn = chalk.hex('#FFA500') // Orange color
const chalkTitle = chalk.bold.yellow

// library for datetime manipulation
import dayjs from 'dayjs'

// get config from .env
import dotenv from 'dotenv'
dotenv.config()
let weatherApiKey = process.env.OPENWEATHERMAP_API_KEY
let weatherUnits = process.env.OPENWEATHERMAP_UNITS
if (weatherUnits != 'metric' && weatherUnits != 'imperial') weatherUnits = 'metric'

// import api wrapper classes
import postcodesIoApi from './api/postcodes.mjs'
import OpenWeatherMapApi from './api/weather.mjs'
const openWeatherMapApi = new OpenWeatherMapApi(weatherApiKey, weatherUnits)

// check if postcode is provided via command line
let postcode = ''
if (process.argv[2] && process.argv[2].length >= 5) {
    postcode = process.argv[2]
}

// ask user to input postcode, if not already provided
if (postcode) {
    console.log("Checking weather for postcode: " + postcode)
} else {
    const response = await inquirer.prompt({
        type: 'input',
        name: 'postcode',
        message: 'Enter a postcode to check weather forecast: '
    })
    postcode = response.postcode
}


let postcodeObj = {}
if (!postcode) {
    // no postcode provided, will pick a random location
    try {
        const data = await postcodesIoApi.request('random')
        postcode = data.result.postcode
        postcodeObj = data.result
        console.log(chalkWarn('No postcode detected. A random postcode has been selected: ' + postcode))
    } catch (error) {
        console.log(chalkError(`Error: failed to get random postcode via API (${error.message})`))
        process.exit()
    }
} else {
    // validate provided postcode via API
    try {
        const data = await postcodesIoApi.request('validate', { postcode: postcode })
        let valid = data.result
        if (!valid) {
            console.error(chalkError('Error: postcode entered is invalid'))
            process.exit()
        }
    } catch (error) {
        console.error(chalkError(`Error: failed to validate postcode via API (${error.message})`))
        process.exit()
    }

    // call API to look up lat/lon from postcode
    try {
        const data = await postcodesIoApi.request('lookup', { postcode: postcode })
        postcodeObj = data.result
    } catch (error) {
        console.error(chalkError(`Error: failed to lookup postcode details via API (${error.message})`))
        process.exit()
    }
}

// extract coordinates and location name from postcode lookup response
let lat = postcodeObj.latitude
let lon = postcodeObj.longitude
let coords = { lat, lon }
let location = `${postcodeObj.admin_district}, ${postcodeObj.country}`
console.log(`Coordinates: lat ${lat} lon ${lon}`)
console.log(`Location: ${location}`)


// helper stuff for weather
const windDirections = [ 'N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW','N' ]
const daysOfWeek = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"]
// work out wind direction from wind degree
const getWindDirection = (degree) => {
    let windDirectionIndex = Math.round(degree / 22.5)
    return windDirections[windDirectionIndex]
}
// function to group array elements by day
const groupByDay = (obj, timestamp) => {
    var objPeriod = {}
    var oneDay = 24 * 60 * 60 * 1000 // hours * minutes * seconds * milliseconds
    for (var i = 0; i < obj.length; i++) {
        var d = new Date(obj[i][timestamp] * 1000)
        d = Math.floor(d.getTime() / oneDay)
        objPeriod[d] = objPeriod[d] || []
        objPeriod[d].push(obj[i])
    }
    return objPeriod
}

// weather units
const tempUnit = weatherUnits == 'metric' ? '°C' : '°F'
const windSpeedUnit = weatherUnits == 'metric' ? 'm/s' : 'mi/hr'
const pressureUnit = 'hPa'

// get current weather conditions
let weather = {}
try {
    weather = await openWeatherMapApi.getWeatherData(coords)
} catch (error) {
    console.error(chalkError(error))
    process.exit()
}

// output details about location/date/time, and current weather
let current = weather.current
console.log()
console.log(boxen(chalkTitle('Location')))
console.log(`-- location: ${location} `)
let today = dayjs(current.dt * 1000)
console.log(`-- date/time: ${today.format('dddd DD MMMM YYYY, hh:mma')}`)
let sunrise = dayjs(current.sunrise * 1000)
console.log(`-- sunrise time: ${sunrise.format('hh:mma')}`)
let sunset = dayjs(current.sunset * 1000)
console.log(`-- sunset time: ${sunset.format('hh:mma')}`)

console.log()
console.log(boxen(chalkTitle('Current Weather')))
console.log(`-- condition: ${current.main} - ${current.description}`)
console.log(`-- temperature: ${current.temperature} ${tempUnit}`)
console.log(`-- feels like: ${current.feelsLike} ${tempUnit}`)
console.log(`-- humidity: ${current.humidity}%`)
console.log(`-- pressure: ${current.pressure} ${pressureUnit}`)
console.log(`-- cloud coverage: ${current.clouds}%`)
console.log(`-- wind: ${current.windSpeed} ${windSpeedUnit}, ${getWindDirection(current.windDegree)} direction`)

// if forecast data is available, output forecast
if (weather.forecast) {
    // draw graph for the forecast temperatures first
    console.log()
    console.log(boxen(chalkTitle('Temperature Trend')))
    let temps = weather.forecast.map((item) => {
        return Math.round(item.temperature)
    })
    console.log(asciichart.plot(temps, { height: 8 }))

    await inquirer.prompt({
        type: 'input',
        name: 'discard',
        message: 'Press [Enter] to continue to the 5 day forecast'
    })

    // output 5 day forecast now
    console.log()
    console.log(boxen(chalkTitle('5 Day Forecast')))

    // group the 3-hourly records into different days
    var weatherByDay = groupByDay(weather.forecast, 'dt')
    Object.keys(weatherByDay).forEach(key => {
        let daily = weatherByDay[key]
        let day = dayjs(key * 24 * 60 * 60 * 1000)

        // set up ascii table for the day with title and headers
        var table =
            new AsciiTable3(`${day.format('dddd DD MMMM')}`)
            .setHeading('Time', 'Description', 'Temp', 'Feels Like', 'Cloud', 'Wind')

        // insert the required data into table rows
        daily.forEach((record) => {
            table.addRow(
                dayjs(record.dt * 1000).format('ha'),
                `${record.description}`,
                `${record.temperature} ${tempUnit}`,
                `${record.feelsLike} ${tempUnit}`,
                `${record.clouds}%`,
                `${record.windSpeed} ${windSpeedUnit}, ${getWindDirection(record.windDegree)} direction`
            )
        })

        // style and print table
        table.setStyle('unicode-single')
        console.log(table.toString())
    })
}