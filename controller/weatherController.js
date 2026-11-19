
const axios = require('axios');

const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';

// Convert Open-Meteo weather codes into descriptions and dashboard icons.
const getWeatherInfo = (code) => {
    const weather = {
        0:  { description: 'Clear sky', icon: '01' },
        1:  { description: 'Mainly clear', icon: '02' },
        2:  { description: 'Partly cloudy', icon: '02' },
        3:  { description: 'Overcast', icon: '04' },
        45: { description: 'Fog', icon: '50' },
        48: { description: 'Depositing rime fog', icon: '50' },
        51: { description: 'Light drizzle', icon: '09' },
        53: { description: 'Moderate drizzle', icon: '09' },
        55: { description: 'Dense drizzle', icon: '09' },
        56: { description: 'Freezing drizzle', icon: '09' },
        57: { description: 'Dense freezing drizzle', icon: '09' },
        61: { description: 'Slight rain', icon: '10' },
        63: { description: 'Moderate rain', icon: '10' },
        65: { description: 'Heavy rain', icon: '10' },
        66: { description: 'Freezing rain', icon: '10' },
        67: { description: 'Heavy freezing rain', icon: '10' },
        71: { description: 'Slight snowfall', icon: '13' },
        73: { description: 'Moderate snowfall', icon: '13' },
        75: { description: 'Heavy snowfall', icon: '13' },
        77: { description: 'Snow grains', icon: '13' },
        80: { description: 'Slight rain showers', icon: '09' },
        81: { description: 'Moderate rain showers', icon: '09' },
        82: { description: 'Violent rain showers', icon: '10' },
        85: { description: 'Slight snow showers', icon: '13' },
        86: { description: 'Heavy snow showers', icon: '13' },
        95: { description: 'Thunderstorm', icon: '11' },
        96: { description: 'Thunderstorm with slight hail', icon: '11' },
        99: { description: 'Thunderstorm with heavy hail', icon: '11' }
    };

    return weather[code] || {
        description: 'Unknown conditions',
        icon: '04'
    };
};

const toTimestamp = (date) => {
    return Math.floor(new Date(date).getTime() / 1000);
};

const getWeather = async (req, res) => {
    try {
        const lat = Number(req.query.lat);
        const lon = Number(req.query.lon);
        const units = req.query.units || 'metric';

        // Validate coordinates.
        if (
            !Number.isFinite(lat) ||
            !Number.isFinite(lon) ||
            lat < -90 ||
            lat > 90 ||
            lon < -180 ||
            lon > 180
        ) {
            return res.status(400).json({
                error: 'Valid latitude and longitude are required.'
            });
        }

        // Validate measurement units.
        if (!['metric', 'imperial'].includes(units)) {
            return res.status(400).json({
                error: 'Units must be metric or imperial.'
            });
        }

        const temperatureUnit = units === 'metric'
            ? 'celsius'
            : 'fahrenheit';

        const windSpeedUnit = units === 'metric'
            ? 'ms'
            : 'mph';

        const response = await axios.get(OPEN_METEO_URL, {
            params: {
                latitude: lat,
                longitude: lon,
                current: [
                    'temperature_2m',
                    'relative_humidity_2m',
                    'apparent_temperature',
                    'is_day',
                    'precipitation',
                    'weather_code',
                    'wind_speed_10m',
                    'visibility',
                    'uv_index'
                ].join(','),

                hourly: [
                    'temperature_2m',
                    'weather_code',
                    'precipitation_probability'
                ].join(','),

                daily: [
                    'weather_code',
                    'temperature_2m_max',
                    'temperature_2m_min',
                    'precipitation_probability_max'
                ].join(','),

                temperature_unit: temperatureUnit,
                wind_speed_unit: windSpeedUnit,
                timezone: 'Asia/Manila',
                forecast_days: 7
            },
            timeout: 15000
        });

        const data = response.data;

        const current = data.current;
        const daily = data.daily;
        const hourly = data.hourly;

        const currentWeather = getWeatherInfo(current.weather_code);

        // Current weather.
        const currentData = {
            updatedAt: toTimestamp(current.time),
            temp: Math.round(current.temperature_2m),
            description: currentWeather.description,
            feelsLike: Math.round(current.apparent_temperature),
            high: Math.round(daily.temperature_2m_max[0]),
            low: Math.round(daily.temperature_2m_min[0]),
            icon: currentWeather.icon,
            wind: Number(current.wind_speed_10m.toFixed(1)),
            humidity: current.relative_humidity_2m,
            visibility: current.visibility,
            uvi: current.uv_index
        };

        // Hourly forecast: next 9 available hours.
        const currentTime = toTimestamp(current.time);

        const hourlyData = hourly.time
            .map((time, index) => ({
                time: toTimestamp(time),
                icon: getWeatherInfo(hourly.weather_code[index]).icon,
                temp: Math.round(hourly.temperature_2m[index]),
                pop: hourly.precipitation_probability[index] ?? 0
            }))
            .filter((hour) => hour.time >= currentTime)
            .slice(0, 9);

        // Seven-day forecast.
        const dailyData = daily.time.map((time, index) => {
            const weather = getWeatherInfo(daily.weather_code[index]);

            return {
                time: toTimestamp(time),
                icon: weather.icon,
                condition: weather.description,
                pop: daily.precipitation_probability_max[index] ?? 0,
                low: Math.round(daily.temperature_2m_min[index]),
                high: Math.round(daily.temperature_2m_max[index])
            };
        });

        return res.status(200).json({
            location: {
                name: 'Selected location',
                lat,
                lon
            },
            current: currentData,

            // Open-Meteo forecast data does not include official
            // government disaster or severe-weather alerts.
            alerts: [],

            hourly: hourlyData,
            daily: dailyData
        });

    } catch (error) {
        console.error(
            'Weather retrieval error:',
            error.response?.data || error.message
        );

        return res.status(502).json({
            error: 'Unable to retrieve weather information.'
        });
    }
};

module.exports = {
    getWeather
};
