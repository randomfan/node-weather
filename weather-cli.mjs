// UI related packages
import inquirer from 'inquirer'
import { AsciiTable3 } from 'ascii-table3'
import asciichart from 'asciichart'
import boxen from 'boxen'
import chalk from 'chalk'

// library for datetime manipulation
import dayjs from 'dayjs'

// get config from .env
import dotenv from 'dotenv'
dotenv.config()
let weatherApiKey = process.env.OPENWEATHERMAP_API_KEY
let weatherUnits = process.env.OPENWEATHERMAP_UNITS
if (weatherUnits != 'metric' && weatherUnits != 'imperial') weatherUnits = 'metric'

// console output shortcuts
const logError = (e) => {
    console.error(chalk.bold.red(e))
}
const logWarning = (w) => {
    console.log(boxen(chalk.hex('#FFA500')(w)))
}
const logTitle = (t) => {
    console.log(boxen(chalk.bold.yellowBright(t)))
}
const logKvp = (k,v) => {
    let key = k
    let value = chalk.blueBright(v)
    let prefix = '- '
    console.log(`${prefix}${key}: ${value}`)
}

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
        logWarning('No postcode detected. A random postcode has been selected: ' + postcode)
    } catch (error) {
        logError(`Error: failed to get random postcode via API (${error.message})`)
        process.exit()
    }
} else {
    // validate provided postcode via API
    try {
        const data = await postcodesIoApi.request('validate', { postcode: postcode })
        let valid = data.result
        if (!valid) {
            logError('Error: postcode entered is invalid')
            process.exit()
        }
    } catch (error) {
        logError(`Error: failed to validate postcode via API (${error.message})`)
        process.exit()
    }

    // call API to look up lat/lon from postcode
    try {
        const data = await postcodesIoApi.request('lookup', { postcode: postcode })
        postcodeObj = data.result
    } catch (error) {
        logError(`Error: failed to lookup postcode details via API (${error.message})`)
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

// get current weather conditions
let weather = {}
try {
    weather = await openWeatherMapApi.getWeatherData(coords)
} catch (error) {
    logError(error)
    process.exit()
}

// get weather unit
const tempUnit = openWeatherMapApi.getUnit('temp')
const windSpeedUnit = openWeatherMapApi.getUnit('windspeed')
const pressureUnit = openWeatherMapApi.getUnit('pressure')

// output details about location/date/time, and current weather
let current = weather.current
console.log()
logTitle('Location')

let today = dayjs(current.dt * 1000).format('dddd DD MMMM YYYY, hh:mma')
let sunrise = dayjs(current.sunrise * 1000).format('hh:mma')
let sunset = dayjs(current.sunset * 1000).format('hh:mma')
logKvp('Location', location)
logKvp('Date/Time',today)
logKvp('Sunrise Time', sunrise)
logKvp('Sunset Time', sunset)

console.log()
logTitle('Current Weather')
logKvp('condition', `${current.main} - ${current.description}`)
logKvp('temperature', `${current.temperature} ${tempUnit}`)
logKvp('Feels Like', `${current.feelsLike} ${tempUnit}`)
logKvp('Humidity', `${current.humidity}%`)
logKvp('Pressure', `${current.pressure} ${pressureUnit}`)
logKvp('Cloud Coverage', `${current.clouds}%`)
logKvp('Wind', `${current.windSpeed} ${windSpeedUnit}, ${current.windDirection} direction`)

// if forecast data is available, output forecast
if (weather.forecast) {
    // draw graph for the forecast temperatures first
    console.log()
    logTitle('Temperature Trend')
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
    logTitle('5 Day Forecast')

    // group the 3-hourly records into different days
    var weatherByDay = groupByDay(weather.forecast, 'dt')
    Object.keys(weatherByDay).forEach(key => {
        let daily = weatherByDay[key]
        let day = dayjs(key * 24 * 60 * 60 * 1000)

        // set up ascii table for the day with title and headers
        var table =
            new AsciiTable3(chalk.yellowBright(`${day.format('dddd DD MMMM')}`))
            .setHeading('Time', 'Condition', 'Description', 'Temperature', 'Feels Like', 'Cloud', 'Wind')
            .setAlignRight(1)
            .setAlignCenter(2)
            .setAlignCenter(3)
            .setAlignCenter(4)
            .setAlignCenter(5)
            .setAlignCenter(6)
            .setWidths([6,15,30,15,15,10,15])
            .setStyle('unicode-single')

        // insert the required data into table rows
        daily.forEach((record) => {
            table.addRow(
                dayjs(record.dt * 1000).format('ha'),
                `${record.main}`,
                `${record.description}`,
                `${record.temperature} ${tempUnit}`,
                `${record.feelsLike} ${tempUnit}`,
                `${record.clouds}%`,
                `${record.windSpeed} ${windSpeedUnit}, ${record.windDirection}`
            )
        })

        // print table
        console.log(table.toString())
    })
}
