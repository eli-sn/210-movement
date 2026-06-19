// Vercel serverless function — fetches BOM Pearce observations server-side (no CORS)
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  // Pearce RAAF candidate feeds (different products / station numbers)
  const FEEDS = [
    'https://www.bom.gov.au/fwo/IDW60801/IDW60801.94614.json', // Pearce half-hourly
    'https://www.bom.gov.au/fwo/IDW60901/IDW60901.94614.json', // Pearce one-minute
    'https://www.bom.gov.au/fwo/IDW60801/IDW60801.95614.json', // Pearce AWS alt
    'https://www.bom.gov.au/fwo/IDW60801/IDW60801.94615.json', // Pearce alt
  ];

  const debug = req.query && req.query.debug;
  const tried = [];

  for (const feed of FEEDS) {
    try {
      const r = await fetch(feed, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; 210bwc-movement/1.0)',
          'Accept': 'application/json',
        },
      });
      tried.push({ feed, status: r.status });
      if (!r.ok) continue;
      const data = await r.json();
      const rows = data?.observations?.data;
      if (!rows || !rows.length) continue;

      let obs = rows[0];
      for (const row of rows) {
        if ((row.sort_order ?? 999) < (obs.sort_order ?? 999)) obs = row;
      }

      // Only accept if it's actually Pearce
      if (obs.name && !/pearce/i.test(obs.name)) {
        tried[tried.length - 1].name = obs.name + ' (rejected)';
        continue;
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
        source: feed,
      });
    } catch (e) {
      tried.push({ feed, error: String(e) });
    }
  }

  return res.status(502).json({ error: 'No Pearce feed found', tried });
}
