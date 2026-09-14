const UA = "whips-catalog/0.1 (car launcher prototype; contact: tdrtravis@gmail.com)";
async function api(params) {
  const url = "https://commons.wikimedia.org/w/api.php?" + new URLSearchParams({ format: "json", origin: "*", ...params });
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  return res.json();
}
for (const q of ["Ferrari F40", "Toyota Supra A80", "Nissan Skyline GT-R R34"]) {
  const s = await api({ action: "query", list: "search", srsearch: `${q} filetype:bitmap`, srnamespace: 6, srlimit: 8 });
  const titles = s.query.search.map((r) => r.title);
  const info = await api({ action: "query", prop: "imageinfo", titles: titles.join("|"), iiprop: "url|size|mime|extmetadata", iiextmetadatafilter: "LicenseShortName|Artist|LicenseUrl|Credit|Attribution", iiurlwidth: 1600 });
  console.log("\n==", q);
  for (const page of Object.values(info.query.pages)) {
    const ii = page.imageinfo?.[0];
    if (!ii) continue;
    const m = ii.extmetadata ?? {};
    console.log(" ", page.title, ii.width + "x" + ii.height, ii.mime, "|", m.LicenseShortName?.value, "|", (m.Artist?.value ?? "").replace(/<[^>]+>/g, "").slice(0, 40));
  }
}
