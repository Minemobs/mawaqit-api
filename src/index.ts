import { DateTime } from "luxon";
import { Elysia } from "elysia";
import cron, { Patterns } from "@elysiajs/cron";

type Times = [string, string, string, string, string];

const prayers = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"] as const;
const timeCache: Map<string, [Times, string]> = new Map();

function getDateFromTime(time: string, timeZone: string) {
  const [hours, minutes] = time.split(":").map(it => Number(it));
  const dateTime = DateTime.fromObject({ hour: hours, minute: minutes }, { zone: timeZone });
  if(dateTime.invalidReason !== null) throw new Error(dateTime.invalidReason + "\n" + dateTime.invalidExplanation);
  return dateTime;
}

async function getTimesMosquee(mosquee: string): Promise<DateTime[]> {
  const [cachedTimes, cachedTimeZone] = timeCache.get(mosquee) ?? [undefined];
  if(cachedTimes !== undefined) return cachedTimes.map(it => getDateFromTime(it, cachedTimeZone));
  
  const res = await fetch(`https://mawaqit.net/fr/${mosquee}`)
    .then(it => {
      if(!it.ok) { throw new Error("Invalid mosquee") } else { return it.text() } 
    })
    .catch(_ => undefined);
  
  if(typeof res !== "string") {
    throw new Error("Invalid mosquee");
  }
  
  const timesMatch = (/"times":\s*(\[("\d{2}:\d{2}",){4}("\d{2}:\d{2}")])/gm).exec(res)?.[0];
  const timeZoneMatch = (/"timezone":"[^"]+"/gm).exec(res)?.[0]?.replaceAll("\\", "");
  if(timesMatch === undefined || timeZoneMatch === undefined) {
    throw new Error("An error occured while parsing");
  }
  
  const { times, timezone } = JSON.parse(`{${timesMatch}, ${timeZoneMatch}}`);
  timeCache.set(mosquee, [times, timezone]);
  return (times as Times).map(it => getDateFromTime(it, timezone));
}

async function getNextPrayer(mosquee: string): Promise<[string, DateTime]> {
  const currentDate = DateTime.now();
  const times = await getTimesMosquee(mosquee);
  
  const index = times.findIndex(it => {
    const date = it;
    return date >= currentDate;
  });
  if(index === -1) {
    return [prayers[0], times[0]];
  }
  
  return [prayers[index], times[index]];
}

async function getNextPrayerFormatted(mosquee: string, relative: boolean, userTimeZone?: string): Promise<string | null> {
  const [nextPrayer, date] = await getNextPrayer(mosquee);
  
  if(relative) {  
    //TODO: May be a bug if currentDate > date
    const timeLeft = date.diffNow(["hour", "minute"]).mapUnits(n => Math.floor(n));
    const lessThanAnHour = timeLeft.hours === 0;
    if(lessThanAnHour && timeLeft.minutes === 0) {
      return `${nextPrayer} now`;
    }
    
    const unit = lessThanAnHour ? "min" : "hours";
    return `${nextPrayer} in ${lessThanAnHour ? "" : (timeLeft.hours + ":")}${(timeLeft.minutes < 10 ? "0" : "") + timeLeft.minutes} ${unit}`;
  }
  
  if(userTimeZone === undefined) return date.toISO(); // Etc/UTC timestamp
  const newDate = date.setZone(userTimeZone);
  if(newDate.invalidReason !== null) {
    throw new Error(newDate.invalidReason + "\n" + newDate.invalidExplanation);
  }
  return newDate.toISO();
}

const app = new Elysia()
  .use(
    cron({
      name: "Clear cache",
      pattern: Patterns.EVERY_DAY_AT_MIDNIGHT,
      run() {
        timeCache.clear();
        console.info("Cache cleared");
      }
    })
  )
  .get("/", () => "Hello Elysia")
  .get("/times/:mosquee", async ({params: { mosquee }}) => await getTimesMosquee(mosquee))
  .get("/nextPrayer/:mosquee", async ({params: { mosquee }, query}) => await getNextPrayerFormatted(mosquee, false, query["timeZone"]))
  .get("/nextPrayer/relative/:mosquee", async ({params: { mosquee }}) => await getNextPrayerFormatted(mosquee, true))
  .listen(3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);

