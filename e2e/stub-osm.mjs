// Stands in for OpenStreetMap's Nominatim (/reverse) and Overpass (/interpreter) during e2e
// runs, so tests never depend on (or send locations to) the real public services.
import http from "http";

const port = Number(process.env.STUB_OSM_PORT || 3102);

const places = (lat, lng) => [
  { type: "node", id: 1, lat: lat + 0.004, lon: lng + 0.003, tags: { amenity: "police", name: "Parliament Street Police Station", phone: "+91 11 2336 1233" } },
  { type: "way", id: 2, center: { lat: lat - 0.006, lon: lng + 0.002 }, tags: { amenity: "hospital", name: "City Care Hospital", opening_hours: "24/7" } },
  { type: "node", id: 3, lat: lat + 0.002, lon: lng - 0.005, tags: { amenity: "pharmacy", name: "Janpath Pharmacy" } },
];

http
  .createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`);
    const json = (body) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(body));
    };
    if (url.pathname === "/health") return json({ ok: true });
    if (url.pathname === "/reverse") {
      return json({ address: { road: "Janpath", suburb: "Connaught Place", city: "New Delhi", country: "India" } });
    }
    if (url.pathname === "/interpreter" && req.method === "POST") {
      let raw = "";
      req.on("data", (c) => (raw += c));
      req.on("end", () => {
        const query = new URLSearchParams(raw).get("data") ?? "";
        const m = /around:\d+,(-?[\d.]+),(-?[\d.]+)/.exec(query);
        json({ elements: m ? places(Number(m[1]), Number(m[2])) : [] });
      });
      return;
    }
    res.writeHead(404);
    res.end();
  })
  .listen(port, () => console.log(`OSM stub on ${port}`));
