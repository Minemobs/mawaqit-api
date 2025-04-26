# Mawaqit-api

A simple rest api for mawaqit

A public testing instance is at: `https://mawaqit.thesimpleteam.net/`

### Paths:
- `/times/:mosquee`: Returns an array of 5 ISO 8601 datetimes
- `/nextPrayer/:mosquee`: Returns an ISO 8601 datetime for the next prayer
- `/nextPrayer/relative/:mosquee`: Returns a formatted string

All paths except relative ones accept a `timeZone` query such as `/nextPrayer/:mosquee?timeZone=Etc/UTC`
