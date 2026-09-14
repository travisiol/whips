const UA = "whips-catalog/0.1 (car launcher prototype; contact: tdrtravis@gmail.com)";
async function api(params) {
  const url = "https://commons.wikimedia.org/w/api.php?" + new URLSearchParams({ format: "json", ...params });
  return (await fetch(url, { headers: { "User-Agent": UA } })).json();
}
for (const q of process.argv.slice(2)) {
  const s = await api({ action: "query", list: "search", srsearch: `${q} filetype:bitmap`, srnamespace: 6, srlimit: 15 });
  const titles = (s.query?.search ?? []).map((r) => r.title);
  console.log("\n== " + q + " (" + titles.length + ")");
  if (!titles.length) continue;
  const info = await api({ action: "query", prop: "imageinfo", titles: titles.join("|"), iiprop: "size|extmetadata", iiextmetadatafilter: "LicenseShortName" });
  for (const p of Object.values(info.query.pages)) { const ii = p.imageinfo?.[0]; if (ii) console.log("  ", p.title, ii.width + "x" + ii.height, "|", ii.extmetadata?.LicenseShortName?.value); }
}
