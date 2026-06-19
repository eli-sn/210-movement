// Vercel serverless function — fetches BOM Pearce observations server-side (no CORS)
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=300'); // cache 5 min

  const FEEDS = [
    'https://www.bom.gov.au/fwo/IDW60801/IDW60801.94608.json',
    'https://www.bom.gov.au/fwo/IDW60901/IDW60901.94608.json',
  ];

  for (const feed of FEEDS) {
    try {
      const r = await fetch(feed, {
        headers: {
          // BOM blocks requests without a browser-like UA
          'User-Agent': 'Mozilla/5.0 (compatible; 210bwc-movement/1.0)',
          'Accept': 'application/json',
        },
      });
      if (!r.ok) continue;
      const data = await r.json();
      const obs = data?.observations?.data?.[0];
      if (!obs) continue;

      let kts = null;
      if (obs.gust_kt != null) kts = obs.gust_kt;
      else if (obs.gust_kmh != null) kts = Math.round(obs.gust_kmh * 0.539957);

      return res.status(200).json({
        feelsLike: obs.apparent_t,
        windGust: kts,
        airTemp: obs.air_temp,
        time: obs.local_date_time,
        source: feed,
      });
    } catch (e) {
      // try next feed
    }
  }

  return res.status(502).json({ error: 'Could not reach BOM' });
}
