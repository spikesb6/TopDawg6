# What's Happening

A phone-first web app for seeing what's going on around you and getting there and back safely. It installs to the home screen like an app and needs no account.

## What it does

- **Discover**: events near you for the next two weeks, filtered by day and by your interests (food, markets, music, festivals, movies, arts, sports, outdoors, family). An "Open right now" row shows nearby places that are open this minute.
- **Places**: restaurants, cafés, bars, markets, cinemas, theatres, museums, parks, venues and family attractions around you, with open/closed status ("Open · closes 9:00 PM"), search, an "Open now" filter, a map, directions, and a showtimes link for cinemas.
- **Safety**: current weather, time until dark, rain chance and official weather alerts; the nearest emergency room, police station and pharmacies; a check-in timer that asks "Are you OK?" with one tap to text a trusted contact or call the local emergency number; "Share where I am" and "Share plan" buttons.
- **My plan**: saved events and places, plus "Add to calendar" on any event.

## Running it

Serve this folder from any static web host (it uses only relative paths), or for a quick look open `index.html` directly. Installing to the home screen and offline use need it served over HTTPS.

There is no build step. Leaflet 1.9.4 is vendored in `vendor/`.

## Turning on real events

Event listings come from the Ticketmaster Discovery API, which needs a free key from developer.ticketmaster.com. Until a key is set, Discover shows clearly labelled sample events.

- For everyone who uses your copy of the app: put the key in `config.js`.
- Just for yourself on one device: paste it into Settings (⚙️) in the app.

## Data sources

| What | Source | Key needed |
| --- | --- | --- |
| Places, opening hours, help points | OpenStreetMap (Overpass API) | No |
| Map tiles | OpenStreetMap | No |
| Weather, daylight | Open-Meteo | No |
| Weather alerts | US National Weather Service (US only) | No |
| City search, city name from GPS | Open-Meteo geocoding, BigDataCloud | No |
| Events | Ticketmaster Discovery | Yes (free) |

These free services have fair-use limits; a public launch with real traffic should move to paid tiers or its own proxy.

## Privacy

Location, interests, trusted contact, saved plans and settings stay in the browser's localStorage. There is no server of our own. Requests to the services above carry the coordinates being looked up.

## Known limits

- The check-in timer runs only while the app is open. It reminds you; it cannot message your contact by itself. That needs a backend or a native app.
- Opening hours are as written in OpenStreetMap and can be out of date. Unusual formats (seasonal, sunrise-based) are shown as written without an open/closed status.
- Movie showtimes open a web search; there is no free showtimes feed.
- Official weather alerts cover the US only.
- Ticketmaster lists ticketed events, so small free community events may not appear.
