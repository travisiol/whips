/**
 * Real photos for the catalog, from Wikimedia Commons — free licences only
 * (CC0, public domain, CC BY, CC BY-SA), credited on the site. Google
 * Images is not a source: those photos belong to their photographers.
 *
 *   npm run photos:fetch            everything not yet in src/data/photos.json
 *   npm run photos:fetch -- f40 r34 refetch these slugs (after editing QUERIES or PICKS)
 *
 * For each car: a Commons search (query below), toys / renders / details
 * filtered out, landscape ≥ 1200 px preferred, "front" or "three-quarter"
 * shots first. The chosen file, its author and licence go to
 * src/data/photos.json; the image lands in public/cars/raw/<slug>.jpg for
 * scripts/cutout-photos.py to detour. To force a specific file, add its
 * Commons title to PICKS.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { CARS } from "../src/data/catalog.ts";

const UA = "whips-catalog/0.1 (car launcher prototype; contact: tdrtravis@gmail.com)";
const OUT_DIR = new URL("../public/cars/raw/", import.meta.url);
const DATA = new URL("../src/data/photos.json", import.meta.url);

const QUERIES: Record<string, string> = {
  mcf1: "McLaren F1",
  cgt: "Porsche Carrera GT",
  "2000gt": "Toyota 2000GT front",
  "250gto": "Ferrari 250 GTO front",
  "300sl": "Mercedes-Benz 300 SL W198 coupe",
  stratos: "Lancia Stratos HF Stradale",
  cobra: "Shelby Cobra 427",
  ztune: "Nissan Skyline GT-R R34 Nismo Z-tune",
  cinque: "Pagani Zonda Cinque",
  delorean: "DeLorean DMC-12",
  svj: "Lamborghini Aventador SVJ",
  sian: "Lamborghini Sián",
  huayrabc: "Pagani Huayra BC",
  amgone: "Mercedes-AMG One",
  t50: "Gordon Murray T.50",
  "21c": "Czinger 21C front",
  nevera: "Rimac Nevera front",
  jesko: "Koenigsegg Jesko front",
  "360": "Ferrari 360 Modena",
  "550": "Ferrari 550 Maranello",
  murci: "Lamborghini Murciélago",
  huracan: "Lamborghini Huracán",
  "930": "Porsche 911 Turbo 930 coupe front",
  gt3rs40: "Porsche 997 GT3 RS 4.0",
  quattro: "Audi Ur-Quattro",
  vanquish: "Aston Martin V12 Vanquish",
  ghibli: "Maserati Ghibli 1967",
  "8c": "Alfa Romeo 8C Competizione",
  esprit: "Lotus Esprit S1",
  elise: "Lotus Elise S1",
  etype: "Jaguar E-Type Series 1 fixed head coupe",
  z8: "BMW Z8 front",
  gt05: "Ford GT 2005 supercar front",
  gt17: "Ford GT 2017",
  roadster: "Tesla Roadster 2008",
  mustang: "Ford Mustang 1965",
  gt500: "Shelby GT500 1967",
  lightning99: "Ford F-150 SVT Lightning 1999",
  lightning: "Ford F-150 Lightning",
  camaro69: "Chevrolet Camaro SS 1969",
  stingray: "Chevrolet Corvette Sting Ray 1963",
  zr1: "Chevrolet Corvette ZR1 C7",
  chevelle: "Chevrolet Chevelle SS 1970",
  gto: "Pontiac GTO Judge 1969",
  transam: "Pontiac Firebird Trans Am 1977",
  charger: "Dodge Charger 1969",
  demon: "Dodge Challenger SRT Demon 2018",
  viper: "Dodge Viper RT/10",
  superbird: "Plymouth Superbird",
  cuda: "Plymouth Hemi Cuda 1970",
  gnx: "Buick GNX 1987",
  gt350: "Shelby GT350 1965",
  syclone: "GMC Syclone",
  zl1: "Chevrolet Camaro ZL1 1969",
  models: "Tesla Model S Plaid",
  model3p: "Tesla Model 3 Performance",
  supra: "Toyota Supra A80",
  ae86: "Toyota Sprinter Trueno AE86",
  mr2: "Toyota MR2 W20",
  r32: "Nissan Skyline GT-R BNR32 front",
  r33: "Nissan Skyline GT-R R33",
  r34: "Nissan Skyline GT-R R34",
  r35: "Nissan GT-R R35",
  s15: "Nissan Silvia S15",
  "300zx": "Nissan 300ZX Z32",
  "240z": "Datsun 240Z",
  nsx: "Honda NSX NA1",
  ek9: "Honda Civic Type R EK9",
  itr: "Acura Integra Type R",
  fd: "Mazda RX-7 FD3S",
  miata: "Mazda MX-5 NA 1990 front",
  "22b": "Subaru Impreza 22B STi",
  evo6: "Mitsubishi Lancer Evolution VI Tommi Makinen",
  evox: "Mitsubishi Lancer Evolution X",
  gtfour: "Toyota Celica GT-Four ST205",
  az1: "Autozam AZ-1",
  cosmo: "Mazda Cosmo 110S",
};

/** Force a specific Commons file for a slug (title without the "File:" prefix). */
const PICKS: Record<string, string> = {
  "2000gt": "1968 Toyota 2000GT White.jpg",
  nevera: "Rimac Nevera.jpg",
  "21c": "Czinger 21C FOS2022.jpg",
  "930": "1988 Porsche 911 930 Turbo.jpg",
  gt05: "2005 Ford GT GT101.jpg",
  agerars: "Koenigsegg Agera RS N.jpg",
  mr2: "1991 Toyota MR2 Turbo.jpg",
  "300sl": "Mercedes-Benz 300 SL, TC 24, Essen (TCE43470).jpg",
  mustang: "1st Ford Mustang coupe.jpg",
  enzo: "Ferrari Enzo, TC 24, Essen (TCE42953).jpg",
  cgt: "Porsche Carrera GT Front 3-4.JPG",
  "300sl": "Mercedes-Benz 300 SL Gullwing Petersen.jpg",
  stratos: "1974 Lancia Stratos Stradale at Greenwich 2021, front left.jpg",
  clkgtr: "Paris - Bonhams 2016 - Mercedes-Benz CLK GTR coupé - 2000 - 001.jpg",
  chiron: "2018 Bugatti Chiron in Exposed Blue Carbon, front right.jpg",
  svj: "Lamborghini Aventador SVJ Gangnam 01.jpg",
  huayra: "Pagani Huayra in London - February 2014 - front view.JPG",
  quattro: "1980s Audi Coupe Quattro (15216435798).jpg",
  lightning: "2022 Ford F-150 Lightning Lariat in Atlas Blue Metallic, Front Right, 08-06-2022.jpg",
  camaro69: "1969 Chevrolet Camaro SS Sport Coupe, front left, 09-07-2024.jpg",
  charger: "1969 Dodge Charger R-T SE in Charger Red, Front Right, 06-11-2022.jpg",
  demon: "Dodge Challenger Demon 1 Genf 2018.jpg",
  superbird: "Plymouth Road Runner Superbird.jpg",
  gnx: "1987 Buick Regal Grand National, front left (2022 Back to the 50's Weekend).jpg",
  zl1: "1969 Chevrolet Camaro COPO 9560 ZL1 (21363646465).jpg",
  supra: "1994 Toyota Supra Sport Roof in Red, front left.jpg",
  mr2: "Toyota MR2 G-Limited (SW20) front.JPG",
  r34: "Nissan Skyline GT-R (R34) in Blue, front left 2.jpg",
  nsx: "Honda NSX (NA1) front.JPG",
  gt500: "Shelby Mustang GT500 \"Eleanor\" 1967.jpeg",
};

const BAD = /INNO64|1:64|1\/64|1:18|1\/18|1:43|1\/43|1:24|1\/24|diecast|die-cast|model car|modelcar|Modell|toy|LEGO|Hot Wheels|Tomica|Minichamps|Kyosho|AUTOart|Matchbox|CMC|scale model|Armaturenbrett|Innenraum|Motorraum|Heck|Cockpit|suspension|concept|convertible|cabrio|spyder|spider|roadster(?! )|Gran Turismo|Forza|render|drawing|sketch|logo|badge|emblem|interior|engine|dashboard|steering|seat|gauge|brochure|advert|poster|cutaway|chassis|rear|back|taillight|exhaust|trunk|boot|wheel|rim|tyre|tire|underside|door|mirror|sticker|plate|key|manual|book|magazine|replica|kit car|crash|wreck|racing number|race car|rally car|police|taxi|limousine|hearse|ambulance/i;
const GOOD = /front|three.?quarter|3\/4|side|profile/i;
const FREE = /^(CC0|Public domain|CC BY( |-)|CC BY-SA)/i;

type Candidate = { title: string; width: number; height: number; url: string; page: string; author: string; license: string; licenseUrl: string; score: number };

async function api(params: Record<string, string>) {
  const url = "https://commons.wikimedia.org/w/api.php?" + new URLSearchParams({ format: "json", ...params });
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

function strip(html: string | undefined): string {
  return (html ?? "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

async function candidates(query: string): Promise<Candidate[]> {
  const s = await api({ action: "query", list: "search", srsearch: `${query} filetype:bitmap`, srnamespace: "6", srlimit: "25" });
  const titles: string[] = (s.query?.search ?? []).map((r: { title: string }) => r.title);
  if (!titles.length) return [];
  const info = await api({
    action: "query",
    prop: "imageinfo",
    titles: titles.join("|"),
    iiprop: "url|size|mime|extmetadata",
    iiextmetadatafilter: "LicenseShortName|Artist|LicenseUrl|Credit",
    iiurlwidth: "1800",
  });
  const out: Candidate[] = [];
  for (const page of Object.values(info.query?.pages ?? {}) as { title: string; imageinfo?: Record<string, unknown>[] }[]) {
    const ii = page.imageinfo?.[0] as { width: number; height: number; mime: string; thumburl?: string; url: string; descriptionurl: string; extmetadata?: Record<string, { value: string }> } | undefined;
    if (!ii) continue;
    const meta = ii.extmetadata ?? {};
    const license = strip(meta.LicenseShortName?.value);
    if (!FREE.test(license)) continue;
    if (!/image\/(jpeg|png)/.test(ii.mime)) continue;
    if (ii.width < 1000 || ii.width < ii.height * 1.05) continue;
    if (BAD.test(page.title)) continue;
    let score = 0;
    if (GOOD.test(page.title)) score += 3;
    if (/front/i.test(page.title)) score += 2;
    if (ii.width >= 2000) score += 1;
    if (/^CC0|Public domain/i.test(license)) score += 0.5;
    // Keep the search's own relevance order as the tie-breaker.
    score -= titles.indexOf(page.title) * 0.05;
    out.push({
      title: page.title,
      width: ii.width,
      height: ii.height,
      url: ii.thumburl ?? ii.url,
      page: ii.descriptionurl,
      author: strip(meta.Artist?.value) || "unknown",
      license,
      licenseUrl: meta.LicenseUrl?.value ?? "",
      score,
    });
  }
  return out.sort((a, b) => b.score - a.score);
}

async function pick(title: string): Promise<Candidate | null> {
  const info = await api({ action: "query", prop: "imageinfo", titles: title.startsWith("File:") ? title : `File:${title}`, iiprop: "url|size|mime|extmetadata", iiextmetadatafilter: "LicenseShortName|Artist|LicenseUrl|Credit", iiurlwidth: "1800" });
  const page = Object.values(info.query?.pages ?? {})[0] as { title: string; imageinfo?: Record<string, unknown>[] } | undefined;
  const ii = page?.imageinfo?.[0] as { width: number; height: number; thumburl?: string; url: string; descriptionurl: string; extmetadata?: Record<string, { value: string }> } | undefined;
  if (!page || !ii) return null;
  const meta = ii.extmetadata ?? {};
  return { title: page.title, width: ii.width, height: ii.height, url: ii.thumburl ?? ii.url, page: ii.descriptionurl, author: strip(meta.Artist?.value) || "unknown", license: strip(meta.LicenseShortName?.value), licenseUrl: meta.LicenseUrl?.value ?? "", score: 99 };
}

async function download(url: string, to: URL) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`download ${res.status} ${url}`);
  writeFileSync(to, Buffer.from(await res.arrayBuffer()));
}

type Photo = { slug: string; file: string; author: string; license: string; licenseUrl: string; page: string; width: number; height: number; query: string };

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const existing: Photo[] = existsSync(DATA) ? JSON.parse(readFileSync(DATA, "utf8")) : [];
  const only = process.argv.slice(2);
  const bySlug = new Map(existing.map((p) => [p.slug, p]));
  let done = 0;
  for (const car of CARS) {
    if (only.length ? !only.includes(car.slug) : bySlug.has(car.slug)) continue;
    const query = QUERIES[car.slug] ?? car.name;
    try {
      const chosen = PICKS[car.slug] ? await pick(PICKS[car.slug]) : (await candidates(query))[0] ?? null;
      if (!chosen) {
        console.log(`✗ ${car.slug.padEnd(12)} no free photo for "${query}"`);
        continue;
      }
      await download(chosen.url, new URL(`${car.slug}.jpg`, OUT_DIR));
      bySlug.set(car.slug, { slug: car.slug, file: chosen.title, author: chosen.author, license: chosen.license, licenseUrl: chosen.licenseUrl, page: chosen.page, width: chosen.width, height: chosen.height, query });
      done++;
      console.log(`✓ ${car.slug.padEnd(12)} ${chosen.title} · ${chosen.license} · ${chosen.author}`);
    } catch (e) {
      console.log(`✗ ${car.slug.padEnd(12)} ${(e as Error).message}`);
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  const photos = CARS.map((c) => bySlug.get(c.slug)).filter((p): p is Photo => Boolean(p));
  writeFileSync(DATA, JSON.stringify(photos, null, 1) + "\n");
  console.log(`\n${photos.length}/${CARS.length} cars have a photo (${done} fetched now) → src/data/photos.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
