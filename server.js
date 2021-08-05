// https://kitesurfer.co.il/kitesurfing-in-israel/ (Beit Yanai > Atlit > Haifa > Qiryat Yam )
const fetch = require('node-fetch');
const config = require('./app.config.json');
const nodemailer = require('nodemailer');

const getCityForecast = async(city) => {
	const cnt = Math.floor(config.DAYS * (24 / config.HOUR_INTERVAL));
	const resp = await fetch(`https://api.openweathermap.org/data/2.5/forecast?q=${city}&cnt=${cnt}&APPID=${config.API_KEY}`);
	const json = await resp.json(); 
	return json.list
		.map(forecastEntry => ({
			// city: city,
			// dateString: new Date(forecastEntry.dt * 1000).toString(),
			timestamp: new Date(forecastEntry.dt * 1000),
			...forecastEntry.wind
		}))
		.filter(e => isValidHour(e.timestamp));
};
const getForecast = async () => await Promise.all(config.cities.map(getCityForecast));

const getDailyForecastByCity = async () => {
	const forecast = await getForecast();
//	console.log(forecast);
	const validEntries = forecast.map(filterEntries);
	const validEntriesPerCity = {};
	let validEntryExists = false;
	for (let i=0; i < config.cities.length; i++) {
		if (validEntries[i].length > 0) {
			let city = config.cities[i];
			validEntriesPerCity[city] = validEntries[i];
			validEntryExists = true;
		}
	}
	if (validEntryExists)
		sendMailNotification(validEntriesPerCity);
};

// const zip = rows=>rows[0].map((_,c)=>rows.map(row=>row[c]));
// const groupEntriesByHour = (entries) => zip(entries);

const isValidHour = timestamp => timestamp.getHours() >= config.MIN_HOUR && timestamp.getHours() <= config.MAX_HOUR;
const isValidAngle = angle => config.ANGLE_RANGES.some(([min, max]) => angle >= min && angle <=max);
const isValidSpeed = speed => speed >= config.MIN_SPEED && speed <= config.MAX_SPEED;
const filterEntries = (entries) => entries.filter(e => isValidSpeed(e.speed));

const formatDate = date => date.toLocaleString('he-il', { weekday: "short", hour: "2-digit" });
const formatEntry = e => `(${formatDate(e.timestamp)} - ${e.speed}kn - ${e.deg}˚)`;
const formatCityForecast = ([city,forecast]) => `[${city}:${forecast.map(formatEntry).join('')}]`;
const formatMessage = citiesForecast => Object.entries(citiesForecast).map(formatCityForecast).join('\n');
const formatSubject = citiesForecast => Object.keys(citiesForecast).join(', ');


var transporter=nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port:465,
    secure: true,
    auth: {
      user: config.SENDER_MAIL,
      pass: config.SENDER_PASSWORD
    }
  });

const sendMailNotification = (citiesForecast) => {
	var msg = formatMessage(citiesForecast);
	var options = {
      from: 'WindWatcher',
      subject:'[WW] ' + formatSubject(citiesForecast),
      text: msg
    };

	for (let subscriberEmail of config.subscribers){
		transporter.sendMail({...options, to: subscriberEmail})
	    	.then(console.log)
	    	.catch(console.error);
	}  
};

setInterval(getDailyForecastByCity, config.API_POLL_INTERVAL_HOURS * 60 * 60 * 1000);
//setInterval(() => console.log('Keep alive'), 15 * 60 * 1000);
//const express = require('express')
//const app = express()
//const port = process.env.PORT || 3000;
//
//app.get('/', (req, res) => res.send('Hello World!'));
//app.listen(port, () => console.log("app listening on port " + port));

getDailyForecastByCity();