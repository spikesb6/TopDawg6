# What's Happening

A mobile-first web app for finding things to do wherever you are, with safety built in.

- **Discover**: events near you, filtered by day and by your interests (markets, live music, festivals, movies, food, arts, outdoors, family).
- **Places**: real nearby markets, cinemas, theatres, museums and venues with opening hours, directions and a showtimes link for cinemas.
- **Safety**: live weather, sunset countdown, rain chance and official weather alerts; a check-in timer that asks "Are you OK?" and offers one-tap text to a trusted contact or a call to emergency services; "Share plan" on every event.
- **My plan**: saved events and places.

Open `index.html` in a browser. No build step, no accounts, no API keys. Everything personal (location, interests, trusted contact, saved items) stays in the browser's localStorage.

## Data

| What | Source | Status |
| --- | --- | --- |
| Places and opening hours | OpenStreetMap (Overpass API) | Live |
| Weather, daylight | Open-Meteo | Live |
| Weather alerts | US National Weather Service (US only) | Live |
| City search / city name | Open-Meteo geocoding, BigDataCloud | Live |
| Events | `SAMPLE` array in `index.html` | Placeholder, labelled "Sample" in the UI |

Events need a real feed (for example Ticketmaster Discovery, Eventbrite or a city calendar) before launch; replace `buildEvents()` with a loader that returns the same shape.

## Known limits

- The check-in timer only runs while the page is open; it cannot notify anyone by itself. Doing that needs a backend or a native app.
- Opening hours are shown as written in OpenStreetMap and may be stale.
