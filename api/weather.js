// Vercel serverless function — fetches BOM Pearce observations server-side (no CORS)
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=60');

  const FEEDS = [
    'https://www.bom.gov.au/fwo/IDW60901/IDW60901.94608.json',
    'https://www.bom.gov.au/fwo/IDW60801/IDW60801.94608.json',
  ];

  const debug = req.query && req.query.debug;

  for (const feed of FEEDS) {
    try {
      const r = await fetch(feed, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; 210bwc-movement/1.0)',
          'Accept': 'application/json',
        },
      });
      if (!r.ok) continue;
      const data = await r.json();
      const rows = data?.observations?.data;
      if (!rows || !rows.length) continue;

      const obs = rows[0];

      // Debug mode: dump the full first observation to inspect field names
      if (debug) {
        return res.status(200).json({ source: feed, raw: obs });
      }

      let kts = null;
      if (obs.gust_kt != null) kts = obs.gust_kt;
      else if (obs.wind_gust_kt != null) kts = obs.wind_gust_kt;
      else if (obs.gust_kmh != null) kts = Math.round(obs.gust_kmh * 0.539957);
      else if (obs.wind_gust_spd_kmh != null) kts = Math.round(obs.wind_gust_spd_kmh * 0.539957);

      return res.status(200).json({
        feelsLike: obs.apparent_t,
        windGust: kts,
        airTemp: obs.air_temp,
        time: obs.local_date_time,
        source: feed.includes('IDW60901') ? 'one-minute' : 'half-hourly',
      });
    } catch (e) {
      // try next feed
    }
  }

  return res.status(502).json({ error: 'Could not reach BOM' });
}
