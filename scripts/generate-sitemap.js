const fs = require("fs");
const path = require("path");

const baseUrl = "https://www.superfilm.uk";
const outPath = path.join(__dirname, "..", "public", "sitemap.xml");

const routes = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/discover", changefreq: "weekly", priority: "0.8" },
  { path: "/clubs", changefreq: "weekly", priority: "0.8" },
  { path: "/movies", changefreq: "weekly", priority: "0.7" },
  { path: "/events", changefreq: "weekly", priority: "0.7" },
  { path: "/leaderboard", changefreq: "weekly", priority: "0.6" },
  { path: "/about", changefreq: "monthly", priority: "0.4" },
  { path: "/terms", changefreq: "monthly", priority: "0.3" },
];

const urls = routes
  .map((route) => {
    const loc = `${baseUrl}${route.path}`;
    return [
      "  <url>",
      `    <loc>${loc}</loc>`,
      `    <changefreq>${route.changefreq}</changefreq>`,
      `    <priority>${route.priority}</priority>`,
      "  </url>",
    ].join("\n");
  })
  .join("\n");

const xml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  urls,
  "</urlset>",
  "",
].join("\n");

fs.writeFileSync(outPath, xml, "utf8");
console.log(`sitemap written to ${outPath}`);
