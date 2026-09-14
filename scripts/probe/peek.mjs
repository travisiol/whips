// Downloads small thumbs of Commons files and tiles them for a quick look.
import { writeFileSync } from "node:fs";
const UA = "whips-catalog/0.1 (car launcher prototype; contact: tdrtravis@gmail.com)";
const titles = process.argv.slice(2);
const info = await (await fetch("https://commons.wikimedia.org/w/api.php?" + new URLSearchParams({ format: "json", action: "query", prop: "imageinfo", titles: titles.map((t) => "File:" + t).join("|"), iiprop: "url", iiurlwidth: "400" }), { headers: { "User-Agent": UA } })).json();
let i = 0;
for (const p of Object.values(info.query.pages)) {
  const url = p.imageinfo?.[0]?.thumburl; if (!url) continue;
  const buf = Buffer.from(await (await fetch(url, { headers: { "User-Agent": UA } })).arrayBuffer());
  writeFileSync(`C:/Users/wowo2/AppData/Local/Temp/claude/C--Users-wowo2-Documents-GitHub-dustland/d381df4e-4a46-45ef-bc26-e2c691a4b06a/scratchpad/peek-${i++}.jpg`, buf);
  console.log(i - 1, p.title);
}
