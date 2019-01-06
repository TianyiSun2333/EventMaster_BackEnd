var express = require("express");
var cors = require("cors");
var geohash = require('ngeohash');
var http = require("http");
var https = require("https");
const path = require('path');
const port = process.env.PORT || 3000;
const SpotifyWebApi = require('spotify-web-api-node');

const SONGKICK_PREFIX = 'https://api.songkick.com/api/3.0';
const SONGKICK_APIKEY = 'YOUR_SONGKICK_APIKEY';
const GOOGLE_SEARCH_API_URL_PREFIX = 'https://www.googleapis.com';
const GOOGLE_MAP_API_URL_PREFIX = 'https://maps.googleapis.com';
const GOOGLE_APIKEY = 'YOUR_GOOGLE_APIKEY';
const GOOGLE_SEARCHENGINE_ID = 'YOUR_GOOGLE_SEARCHENGINE_ID';
const TICKETMASTER_APIKEY = 'YOUR_TICKETMASTER_APIKEY';
const TICKETMASTER_PREFIX = 'https://app.ticketmaster.com/discovery/v2';
const SPOTIFY_CLIENT_ID = 'YOUR_SPOTIFY_CLIENT_ID';
const SPOTIFY_CLIENT_SECRET = 'YOUR_SPOTIFY_CLIENT_SECRET';
const CATEGORY = {
    "music": "KZFzniwnSyZfZ7v7nJ",
    "sports": "KZFzniwnSyZfZ7v7nE",
    "arts & theatre": "KZFzniwnSyZfZ7v7na",
    "film": "KZFzniwnSyZfZ7v7nn",
    "miscellaneous": "KZFzniwnSyZfZ7v7n1"
};

let token = '';
let serverCreated = false;

init();

function init() {
    let timeout = 0;
    let promise = new Promise((resolve, reject) => {
        let spotifyApi = new SpotifyWebApi({
            clientId: SPOTIFY_CLIENT_ID,
            clientSecret: SPOTIFY_CLIENT_SECRET
        });
        spotifyApi.clientCredentialsGrant().then(
            (data) => {
                token = data.body['access_token'];
                timeout = 700 * data.body['expires_in'];
                console.log('The access token expires in ' + data.body['expires_in']);
                // console.log('The access token is ' + data.body['access_token']);
                resolve(timeout);
            },
            (err) => {
                reject(err);
                console.log('Something went wrong when retrieving an access token', err);
            }
        );
    });
    promise.then((timeout) => {
        if (!serverCreated) {
            createServer();
            serverCreated = true;
        }
        setTimeout(init, timeout);
    }, (err) => {
        console.log('Something went wrong when retrieving an access token', err);
    })
}

function createServer() {
    var app = express();
    app.use(cors());

    app.use(express.static("./index"));
    app.get('/',(req,res)=> {
        res.sendFile("./index/index.html", {root:__dirname});
    });

    app.listen(port);
    console.log("Listening on port: " + port);


    app.get("/recommendation", function(req, res) {
        recommendationHandler(res, req.query);
    });

    app.get("/events", function(req, res) {
        eventsHandler(res, req.query);
    })

    app.get("/detail", function(req, res) {
        detailHandler(res, req.query);
    })

    app.get("/artist", function(req, res) {
        artistHandler(res, req.query);
    })

    app.get("/venue", function(req, res) {
        venueHandler(res, req.query);
    })

    app.get("/upcomingevents", function(req, res) {
        upComingEventsHandler(res, req.query);
    })

    app.get("/images", function(req, res) {
        imagesHandler(res, req.query);
    })
}

function get(res, url, callback) {
    console.log(url,'\n');
    https.get(url, (response) => {
        response.setEncoding('utf8');
        let rawData = '';
        response.on('data', (chunk) => {
            rawData += chunk;
        });
        response.on('end', () => {
            try {
                let retrievedData = callback(rawData);
                console.log(retrievedData);
                res.write(retrievedData);
                res.end();
            } catch (e) {
                console.error(e.message);
                res.end();
            }
        });
    }).on('error', (e) => {
        console.error(`Got error: ${e.message}`);
        res.end();
    });
}

function getUserLocation(address, resolve) {
    let endpoint = '/maps/api/geocode/json?address=';
    let url = GOOGLE_MAP_API_URL_PREFIX + endpoint + address + '&key=' + GOOGLE_APIKEY;
    console.log(url,'\n');
    https.get(url, (response) => {
        let rawData = '';
        response.on('data', (chunk) => {
            rawData += chunk;
        });
        response.on('end', () => {
            try {
                let json = JSON.parse(rawData);
                let location = {
                    'lat': json.results[0].geometry.location.lat,
                    'lng': json.results[0].geometry.location.lng
                };
                console.log(location);
                resolve(location);
            } catch (e) {
                console.error(e.message);
            }
        });
    }).on('error', (e) => {
        console.error(`Got error: ${e.message}`);
    });
}

function recommendationHandler(res, query) {
    let endpoint = '/suggest';
    let keyword = query.keyword;
    let url = TICKETMASTER_PREFIX + endpoint + '?keyword=' + keyword + '&apikey=' + TICKETMASTER_APIKEY;
    get(res, url, retrieveRecommendationData);
}

function eventsHandler(res, query) {
    console.log(query);
    let endpoint = '/events.json';

    let keyword = query.keyword;
    let radius = query.radius;
    let segmentId = '';
    if (query.category.toLowerCase() !== 'all') {
        segmentId = CATEGORY[query.category.toLowerCase()];
    }
    let unit = query.unit;
    let lat = '';
    let lng = '';
    let geoPoint = '';
    console.log(query.address);
    if (query.address) {
        console.log(query.address);
        new Promise((resolve, reject) => {
            console.log(query.address);
            getUserLocation(query.address, resolve);
        }).then((location) => {
            geoPoint = geohash.encode(location.lat, location.lng);
            let url = TICKETMASTER_PREFIX + endpoint
                + '?apikey=' + TICKETMASTER_APIKEY
                + '&keyword=' + keyword
                + '&unit=' + unit
                + '&geoPoint=' + geoPoint
                + '&radius=' + radius;
            if (segmentId !== '') {
                url += '&segmentId=' + segmentId;
            }
            console.log(url);
            get(res, url, retrieveEventsData);
        }, () => {

        });
    } else {
        lat = query.lat;
        lng = query.lng;
        geoPoint = geohash.encode(lat, lng);
        let url = TICKETMASTER_PREFIX + endpoint
            + '?apikey=' + TICKETMASTER_APIKEY
            + '&keyword=' + keyword
            + '&unit=' + unit
            + '&geoPoint=' + geoPoint
            + '&radius=' + radius;
        if (segmentId !== '') {
            url += '&segmentId=' + segmentId;
        }
        console.log(url);
        get(res, url, retrieveEventsData);
    }
}

function detailHandler(res, query) {
    let endpoint = '/events';
    let id = query.id;
    let url = TICKETMASTER_PREFIX + endpoint + '/' + id + '.json?apikey=' + TICKETMASTER_APIKEY;
    get(res, url, retrieveDetailData);
}

function artistHandler(res, query) {
    let name = query.name;
    let spotifyApi = new SpotifyWebApi({
        clientId: SPOTIFY_CLIENT_ID,
        clientSecret: SPOTIFY_CLIENT_SECRET
    });
    spotifyApi.setAccessToken(token);
    spotifyApi.searchArtists(name).then(
        (data) => {
            // console.log('Search artists by "Love"', data.body);
            let responseData = retrieveArtistData(data.body, name);
            // res.writeHead(200, {
            //     'Content-Type': 'application/json; charset=utf-8',
            //     'Access-Control-Allow-Origin': '*'
            // });
            res.write(responseData);
            res.end();
        }, (err) => {
            console.error(err);
            res.end();
        });
}

function venueHandler(res, query) {
    let endpoint = '/venues';
    let keyword = query.keyword;
    let url = TICKETMASTER_PREFIX + endpoint + '?keyword=' + keyword + '&apikey=' + TICKETMASTER_APIKEY;
    get(res, url, retrieveVenueData);
}

function upComingEventsHandler(res, query) {
    const idEndpoint = '/search/venues.json';
    const eventsEndpoint = '/venues';
    let name = query.name;
    let idUrl = SONGKICK_PREFIX + idEndpoint + '?query=' + name + '&apikey=' + SONGKICK_APIKEY;
    console.log(idUrl);
    let promise = new Promise((resolve, reject) => {
        console.log(idUrl,'\n');
        https.get(idUrl, (response) => {
            response.setEncoding('utf8');
            let rawData = '';
            response.on('data', (chunk) => {
                rawData += chunk;
            });
            response.on('end', () => {
                try {
                    let json = JSON.parse(rawData);
                    if (json.resultsPage.totalEntries && json.resultsPage.totalEntries > 0) {
                        resolve(json.resultsPage.results.venue[0].id);
                        console.log('get id for ', name, ' ', json.resultsPage.results.venue[0].id);
                    }
                } catch (e) {
                    console.error(e.message);
                    reject(e);
                }
            });
        }).on('error', (e) => {
            console.error(`Got error: ${e.message}`);
        });
    });
    promise.then((id) => {
        console.log(id);
        let eventsUrl = SONGKICK_PREFIX + eventsEndpoint + '/' + id + '/' + 'calendar.json?apikey=' + SONGKICK_APIKEY;
        console.log('request future events from songkick', eventsUrl);
        get(res, eventsUrl, retrieveUpComingEventsData);
    }, (error) => {
        console.log(error);
        res.write('{}');
        res.end();
    });
}

function imagesHandler(res, query) {
    let endpoint = '/customsearch/v1';
    let keyword = query.keyword;
    let size = query.size;
    let number = query.number;
    let url = GOOGLE_SEARCH_API_URL_PREFIX + endpoint + '?q=' + keyword + '&cx=' + GOOGLE_SEARCHENGINE_ID + '&imgSize=' +
        size + '&imgType=news' + '&num=' + number + '&searchType=image' + '&key=' + GOOGLE_APIKEY;
    // let url = GOOGLE_API_URL_PREFIX + endpoint + '?q=' + keyword + '&cx=' + GOOGLE_SEARCHENGINE_ID + '&imgSize=' +
    //     size + '&num=' + number + '&searchType=image' + '&key=' + GOOGLE_APIKEY;
    console.log(url);
    get(res, url, retrieveImagesData);
}

function retrieveGeoLocation() {

}

function retrieveRecommendationData(jsonStr) {
    var json = JSON.parse(jsonStr);
    var resJson = {
        names: []
    };
    if (json._embedded) {
        var attractions = json._embedded.attractions;
        for (let i = 0; i < attractions.length; i++) {
            resJson.names.push({
                'name': attractions[i].name
            });
        }
    }
    return JSON.stringify(resJson);
}

function retrieveEventsData(jsonStr) {
    var json = JSON.parse(jsonStr);
    var resJson = {
        events: []
    };
    console.log(jsonStr);
    if (json.page.totalElements > 0) {
        var events = json._embedded.events;
        for (let i = 0; i < events.length; i++) {
            let event = {};
            event['name'] = events[i].name;
            event['date'] = events[i].dates.start.localDate;
            event['time'] = events[i].dates.start.localTime ?
                events[i].dates.start.localTime
                : '00:00:00';
            if (events[i].classifications) {
                if (events[i].classifications[0].genre.name && events[i].classifications[0].genre.name !== "Undefined") {
                    event['genre'] = events[i].classifications[0].genre.name;
                }
                if (events[i].classifications[0].segment.name && events[i].classifications[0].segment.name !== "Undefined") {
                    event['segment'] = events[i].classifications[0].segment.name;
                }
            }
            event['venue'] = events[i]._embedded.venues[0].name;
            event['id'] = events[i].id;
            if (events[i]._embedded.attractions !== undefined) {
                console.log(i);
                event['teams'] = [];
                for (let j = 0; j < events[i]._embedded.attractions.length; j++) {
                    console.log(j);
                    console.log('flag', events[i]._embedded.attractions[j].name);
                    let name = {};
                    name['name'] = events[i]._embedded.attractions[j].name;
                    event['teams'].push(name);
                }
            }
            resJson.events.push(event);
        }
    }
    console.log(JSON.stringify(resJson));
    return JSON.stringify(resJson);
}

function retrieveDetailData(jsonStr) {
    let json = JSON.parse(jsonStr);
    let resJson = {};
    resJson['name'] = json.name;
    if (json._embedded.attractions && json._embedded.attractions.length > 0) {
        let teams = [];
        for (let i = 0; i < json._embedded.attractions.length; i++) {
            teams.push({
                'name': json._embedded.attractions[i].name
            });
        }
        resJson['teams'] = teams;
    }
    if (json.seatmap) {
        resJson['seatmap'] = json.seatmap.staticUrl;
    }
    resJson['id'] = json.id;
    resJson['buy'] = json.url;
    resJson['status'] = json.dates.status.code;
    if (json.priceRanges) {
        if (json.priceRanges[0].min) {
            resJson['min'] = json.priceRanges[0].min;
        }
        if (json.priceRanges[0].max) {
            resJson['max'] = json.priceRanges[0].max;
        }
    }
    resJson['venue'] = json._embedded.venues[0].name;
    if (json.classifications) {
        if (json.classifications[0].genre && json.classifications[0].genre.name !== 'Undefined') {
            resJson['genre'] = json.classifications[0].genre.name;
        }
        if (json.classifications[0].segment && json.classifications[0].segment.name !== 'Undefined') {
            resJson['segment'] = json.classifications[0].segment.name;
        }
    }
    resJson['localDate'] = json.dates.start.localDate;
    if (json.dates.start.localTime) {
        resJson['localTime'] = json.dates.start.localTime;
    }
    return JSON.stringify(resJson);
}

function retrieveArtistData(json, name) {
    console.log(JSON.stringify(json));
    let artists = json.artists.items;
    let artist;
    for (let i = 0; i < artists.length; i++) {
        if (artists[i].name.toLowerCase() === name.toLowerCase()) {
            artist = artists[i];
            break;
        }
    }
    let resJson = {};
    if (artist !== undefined) {
        if (artist.name) {
            resJson['name'] = artist.name;
        }
        if (artist.followers.total) {
            resJson['followers'] = artist.followers.total;
        }
        if (artist.popularity) {
            resJson['popularity'] = artist.popularity;
        }
        if (artist.external_urls.spotify) {
            resJson['url'] = artist.external_urls.spotify;
        }
        console.log(JSON.stringify(resJson));
    }
    return JSON.stringify(resJson);
}

function retrieveVenueData(jsonStr) {
    console.log(jsonStr);
    let json = JSON.parse(jsonStr);
    let resJson = {};
    if (json.page.totalElements > 0) {
        let venue = json._embedded.venues[0];
        if (venue.name) {
            resJson['name'] = venue.name;
        }
        if (venue.address.line1) {
            resJson['address'] = venue.address.line1;
        }
        if (venue.city.name) {
            resJson['city'] = venue.city.name;
        }
        if (venue.state) {
            resJson['state'] = venue.state.stateCode;
        }
        if (venue.boxOfficeInfo) {
            if (venue.boxOfficeInfo.openHoursDetail) {
                resJson['hour'] = venue.boxOfficeInfo.openHoursDetail;
            }
            if (venue.boxOfficeInfo.phoneNumberDetail) {
                resJson['phone'] = venue.boxOfficeInfo.phoneNumberDetail;
            }
        }
        if (venue.generalInfo) {
            if (venue.generalInfo.generalRule) {
                resJson['generalRule'] = venue.generalInfo.generalRule;
            }
            if (venue.generalInfo.childRule) {
                resJson['childRule'] = venue.generalInfo.childRule;
            }
        }
        if (venue.location) {
            if (venue.location.longitude) {
                resJson['lng'] = venue.location.longitude;
            }
            if (venue.location.latitude) {
                resJson['lat'] = venue.location.latitude;
            }
        }
    }
    console.log('\n', JSON.stringify(resJson));
    return JSON.stringify(resJson);
}

function retrieveUpComingEventsData(jsonStr) {
    let json = JSON.parse(jsonStr);
    let resJson = {};
    if (json.resultsPage.totalEntries > 0) {
        let events = json.resultsPage.results.event;
        resJson = {
            'events': []
        };
        for (let i = 0; i < events.length; i++) {
            let event = { 'index': i };
            if (events[i].displayName) {
                event['displayName'] = events[i].displayName;
            }
            if (events[i].uri) {
                event['uri'] = events[i].uri;
            }
            if (events[i].performance[0]) {
                event['artist'] = events[i].performance[0].displayName;
            }
            if (events[i].start) {
                event['date'] = events[i].start.date;
                event['time'] = events[i].start.time;
            }
            if (events[i].type) {
                event['type'] = events[i].type;
            }
            resJson['events'].push(event);
        }
    }
    return JSON.stringify(resJson);
}

function retrieveImagesData(jsonStr) {
    console.log(jsonStr);
    let json = JSON.parse(jsonStr);
    let resJson = {
        'images': []
    };
    if (json.queries.nextPage[0].count > 0) {
        console.log('flag');
        let images = json.items;
        for (let i = 0; i < images.length; i++) {
            resJson['images'].push(images[i].link);
            console.log(images[i].link);
        }

    }
    console.log(JSON.stringify(resJson));
    return JSON.stringify(resJson);
}



