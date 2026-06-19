// Vercel serverless function — fetches nearest BOM observation to Pearce (3Q85)
// Note: BOM's beta Pearce page blends data; this returns the closest real
// station observation as a starting estimate. Always verify/override manually.
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  // Pearce RAAF area stations, nearest first
  const FEEDS = [
    'https://www.bom.gov.au/fwo/IDW60801/IDW60801.94614.json', // Pearce RAAF
    'https://www.bom.gov.au/fwo/IDW60901/IDW60901.94608.json', // Perth (fallback)
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

      let obs = rows[0];
      for (const row of rows) {
        if ((row.sort_order ?? 999) < (obs.sort_order ?? 999)) obs = row;
      }

      if (debug) {
        return res.status(200).json({ source: feed, name: obs.name, chosen: obs });
      }

      let kts = null;
      if (obs.gust_kt != null) kts = obs.gust_kt;
      else if (obs.gust_kmh != null) kts = Math.round(obs.gust_kmh * 0.539957);

      return res.status(200).json({
        feelsLike: obs.apparent_t,
        windGust: kts,
        airTemp: obs.air_temp,
        time: obs.local_date_time,
        station: obs.name,
      });
    } catch (e) {
      // try next feed
    }
  }

  return res.status(502).json({ error: 'Could not reach BOM' });
}
