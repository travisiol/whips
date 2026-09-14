/**
 * The catalog. 120 cars everyone knows, one token each.
 *
 * `id` is the Merkle leaf id and the launcher's itemId: it never changes once
 * a root is deployed. `ticker` is the token symbol without the `$`. `accel`
 * is 0–100 km/h in seconds, `top` in km/h, `units` the number built — the
 * real rarity; `null` means the maker never disclosed a per-model figure and
 * the site says "not disclosed" instead of inventing one. `approx` flags
 * figures rounded from published tests rather than a factory sheet.
 *
 * The pair is derived from the maker (src/data/pairs.ts): Tesla → TSLA,
 * Ford → F, Rivian → RIVN, everyone else → ETH.
 *
 * `shape` parameterises the die-cast body for the 95 template cars;
 * the 25 grails have a hand-drawn profile in src/data/profiles.ts.
 */
import { pairForMaker, type Pair } from "./pairs.ts";

export type Tier = "jdm" | "muscle" | "exotic" | "hypercar" | "grail";

export type BodyStyle = "coupe" | "sedan" | "roadster" | "pickup" | "wagon" | "hatch";

export type Shape = {
  body: BodyStyle;
  /** Roof line in profile units (0 = top of the box, 76 = ground). Lower number = taller car. */
  roof?: number;
  /** Where the cabin starts and ends, as fractions of the length from the tail. */
  cabin?: [number, number];
  /** Height of the nose tip and of the tail, in profile units. */
  nose?: number;
  tail?: number;
  /** 0 = notchback, 1 = fastback all the way down to the tail. */
  rearDrop?: number;
  /** 0 none, 1 lip, 2 wing. */
  spoiler?: 0 | 1 | 2;
  /** Distance between axles as a fraction of the length. */
  wheelbase?: number;
  /** Wheel radius in profile units. */
  wheel?: number;
  /** Overall scale against the 200-unit box (a kei car is 0.72, a truck 1.15). */
  size?: number;
  /** Extruded width as a fraction of length. */
  width?: number;
  /** Pickups: bed rail height. */
  bed?: number;
};

export type Car = {
  id: number;
  slug: string;
  name: string;
  maker: string;
  year: number;
  ticker: string;
  tier: Tier;
  accel: number;
  top: number;
  units: number | null;
  approx?: boolean;
  blurb: string;
  paint: string;
  shape: Shape;
};

export const TIERS: { id: Tier; label: string; floor: string; line: string }[] = [
  { id: "grail", label: "grail", floor: "p1", line: "the twenty-five we'd hang on the wall. under 500 built, or a legend beyond numbers." },
  { id: "hypercar", label: "hypercar", floor: "p2", line: "the 300 km/h club. built by the dozen, priced like houses." },
  { id: "exotic", label: "exotic", floor: "p3", line: "mid-engines, gullwings and long hoods. the posters of every decade." },
  { id: "muscle", label: "muscle", floor: "p4", line: "american power, any fuel. big blocks, big batteries, straight lines." },
  { id: "jdm", label: "jdm", floor: "p5", line: "japan's golden age. turbos, rotaries and kei cars with more heart than horsepower." },
];

const car = (
  id: number,
  tier: Tier,
  name: string,
  maker: string,
  year: number,
  ticker: string,
  accel: number,
  top: number,
  units: number | null,
  blurb: string,
  paint: string,
  shape: Shape,
  approx = false,
): Car => ({
  id,
  slug: ticker.toLowerCase(),
  name,
  maker,
  year,
  ticker,
  tier,
  accel,
  top,
  units,
  ...(approx ? { approx: true } : {}),
  blurb,
  paint,
  shape,
});

export const CARS: Car[] = [
  // ── grail · p1 (hand-drawn profiles) ─────────────────────────────────
  car(1, "grail", "Ferrari F40", "Ferrari", 1987, "F40", 4.1, 324, 1315, "the last car enzo signed off. no carpets, no radio, 478 horsepower and a lexan window.", "#d0121b", { body: "coupe", width: 0.45 }),
  car(2, "grail", "McLaren F1", "McLaren", 1992, "MCF1", 3.2, 386, 106, "central seat, gold-foil engine bay, still the fastest naturally aspirated car ever made.", "#b9bec7", { body: "coupe", width: 0.42 }),
  car(3, "grail", "Toyota 2000GT", "Toyota", 1967, "2000GT", 8.6, 220, 351, "japan's first supercar. bond drove the one with no roof because he didn't fit in the coupé.", "#f1efe8", { body: "coupe", width: 0.38 }, true),
  car(4, "grail", "Lamborghini Miura", "Lamborghini", 1966, "MIURA", 6.7, 280, 764, "the first mid-engine supercar. a transverse v12 behind your head and eyelashes on the headlights.", "#f5731c", { body: "coupe", width: 0.42 }, true),
  car(5, "grail", "Lamborghini Countach", "Lamborghini", 1974, "COUNTACH", 5.6, 290, 1999, "the wedge on every bedroom wall. scissor doors, and you reverse by sitting on the sill.", "#f4f2ec", { body: "coupe", width: 0.46 }, true),
  car(6, "grail", "Ferrari 250 GTO", "Ferrari", 1962, "250GTO", 5.4, 280, 36, "thirty-six built. the most expensive car ever sold, and it still gets raced.", "#c4101c", { body: "coupe", width: 0.4 }, true),
  car(7, "grail", "Porsche 959", "Porsche", 1986, "959", 3.7, 317, 337, "the eighties' technology showcase: twin turbos, all-wheel drive, and it won the paris-dakar.", "#c9ccd2", { body: "coupe", width: 0.43 }, true),
  car(8, "grail", "Ferrari F50", "Ferrari", 1995, "F50", 3.8, 325, 349, "a formula one v12 bolted to the chassis, roof off. 349 built, one fewer than they thought they could sell.", "#d8121e", { body: "coupe", width: 0.45 }),
  car(9, "grail", "Ferrari Enzo", "Ferrari", 2002, "ENZO", 3.6, 350, 400, "the founder's name on the nose. 399 for customers, one for the pope.", "#f3c400", { body: "coupe", width: 0.46 }),
  car(10, "grail", "Porsche Carrera GT", "Porsche", 2004, "CGT", 3.9, 330, 1270, "a le mans v10 that never raced, a ceramic clutch and no driver aids at all.", "#c7c9ce", { body: "roadster", width: 0.45 }),
  car(11, "grail", "Mercedes-Benz 300 SL", "Mercedes-Benz", 1954, "300SL", 8.8, 260, 1400, "gullwing doors because the tube frame was too tall for normal ones. the first fuel-injected production car.", "#c4c6c9", { body: "coupe", width: 0.4 }, true),
  car(12, "grail", "Jaguar XJ220", "Jaguar", 1992, "XJ220", 3.6, 349, 281, "promised a v12 and four-wheel drive, delivered a twin-turbo v6 and the world speed record anyway.", "#c0c4c8", { body: "coupe", width: 0.48 }),
  car(13, "grail", "Bugatti EB110", "Bugatti", 1991, "EB110", 3.5, 342, 139, "four turbos, a carbon tub in 1991, and the company went bankrupt before the sequel.", "#1f4fd6", { body: "coupe", width: 0.47 }, true),
  car(14, "grail", "Ford GT40", "Ford", 1964, "GT40", 5.3, 265, 105, "forty inches tall, built to beat ferrari at le mans. it did, four years running.", "#1d3fbd", { body: "coupe", width: 0.44 }, true),
  car(15, "grail", "Shelby Cobra 427", "Shelby", 1965, "COBRA", 4.2, 264, 343, "a british roadster with a seven-litre ford v8. the ratio of engine to car has never been worse, or better.", "#1a3fa8", { body: "roadster", width: 0.42 }, true),
  car(16, "grail", "Lexus LFA", "Lexus", 2010, "LFA", 3.7, 325, 500, "a v10 that revs so fast the needle had to be digital. yamaha tuned the exhaust like an instrument.", "#f2f0ea", { body: "coupe", width: 0.44 }),
  car(17, "grail", "Nissan Skyline GT-R Z-Tune", "Nissan", 2005, "ZTUNE", 3.8, 327, 19, "nismo bought back low-mileage r34s and rebuilt them by hand. nineteen exist.", "#c9ccd1", { body: "coupe", width: 0.42 }, true),
  car(18, "grail", "Lancia Stratos", "Lancia", 1973, "STRATOS", 6.8, 232, 492, "a ferrari v6 in a wedge the length of a fiat. three world rally titles, and it fits in a parking space sideways.", "#e2b520", { body: "coupe", width: 0.48 }, true),
  car(19, "grail", "BMW M1", "BMW", 1978, "M1", 5.6, 262, 453, "the only mid-engine bmw. giugiaro drew it, lamborghini was supposed to build it, and then didn't.", "#f4f2ec", { body: "coupe", width: 0.42 }, true),
  car(20, "grail", "Aston Martin DB5", "Aston Martin", 1963, "DB5", 8.1, 233, 1059, "silver birch, an ejector seat in the film and none in the brochure.", "#b8bcc0", { body: "coupe", width: 0.38 }, true),
  car(21, "grail", "Ferrari 288 GTO", "Ferrari", 1984, "288GTO", 4.9, 305, 272, "built for a rally class that got cancelled. 272 owners didn't mind.", "#cc0f1a", { body: "coupe", width: 0.43 }),
  car(22, "grail", "Mercedes-Benz CLK GTR", "Mercedes-Benz", 1997, "CLKGTR", 3.8, 320, 25, "a le mans car with number plates, built in 128 days so it could race at all.", "#b4b8bd", { body: "coupe", width: 0.48 }, true),
  car(23, "grail", "Pagani Zonda Cinque", "Pagani", 2009, "CINQUE", 3.4, 350, 10, "five coupés, five roadsters, a carbon-titanium tub and the loudest amg v12 ever fitted.", "#8fa4bd", { body: "coupe", width: 0.48 }),
  car(24, "grail", "Bugatti Veyron", "Bugatti", 2005, "VEYRON", 2.5, 407, 450, "a thousand horsepower, ten radiators, and a key you turn to unlock the last 30 km/h.", "#0f2a6b", { body: "coupe", width: 0.5 }),
  car(25, "grail", "DeLorean DMC-12", "DeLorean", 1981, "DELOREAN", 10.5, 177, 9000, "brushed stainless steel, gullwing doors, 130 horsepower. it needed the flux capacitor.", "#b9bcc0", { body: "coupe", width: 0.44 }, true),

  // ── hypercar · p2 ────────────────────────────────────────────────────
  car(26, "hypercar", "Bugatti Chiron", "Bugatti", 2016, "CHIRON", 2.4, 420, 500, "sixteen cylinders, four turbos, 1,500 horsepower, and it idles like a limousine.", "#0d1a3d", { body: "coupe", roof: 30, cabin: [0.3, 0.68], nose: 50, tail: 36, rearDrop: 0.7, wheelbase: 0.62, width: 0.5 }),
  car(27, "hypercar", "Koenigsegg Jesko", "Koenigsegg", 2021, "JESKO", 2.5, 412, 125, "named after the founder's father. a nine-speed gearbox with no fixed order of gears.", "#f4f2ec", { body: "coupe", roof: 33, cabin: [0.36, 0.7], nose: 53, tail: 40, rearDrop: 0.6, spoiler: 2, wheelbase: 0.62, width: 0.5 }, true),
  car(28, "hypercar", "Koenigsegg Agera RS", "Koenigsegg", 2015, "AGERARS", 2.9, 447, 25, "the fastest production car for three years, measured on a closed nevada highway.", "#c9ccd2", { body: "coupe", roof: 33, cabin: [0.36, 0.7], nose: 53, tail: 40, rearDrop: 0.6, spoiler: 2, wheelbase: 0.62, width: 0.5 }, true),
  car(29, "hypercar", "Koenigsegg Regera", "Koenigsegg", 2016, "REGERA", 2.8, 400, 80, "no gearbox at all: a twin-turbo v8, three electric motors and a single direct drive.", "#2c3340", { body: "coupe", roof: 33, cabin: [0.36, 0.7], nose: 53, tail: 40, rearDrop: 0.65, spoiler: 1, wheelbase: 0.62, width: 0.5 }),
  car(30, "hypercar", "McLaren P1", "McLaren", 2013, "P1", 2.8, 350, 375, "the f1's successor with a battery. 903 horsepower and a rear wing that hides in the body.", "#f5731c", { body: "coupe", roof: 32, cabin: [0.34, 0.68], nose: 52, tail: 40, rearDrop: 0.7, spoiler: 1, wheelbase: 0.6, width: 0.48 }),
  car(31, "hypercar", "McLaren Senna", "McLaren", 2018, "SENNA", 2.8, 340, 500, "ugly on purpose. glass in the doors so you can watch the apex go by.", "#3a3f48", { body: "coupe", roof: 30, cabin: [0.36, 0.68], nose: 52, tail: 38, rearDrop: 0.3, spoiler: 2, wheelbase: 0.6, width: 0.49 }),
  car(32, "hypercar", "McLaren Speedtail", "McLaren", 2019, "SPEEDTAIL", 3.0, 403, 106, "three seats, a teardrop tail and cameras for mirrors. 106 built, like the f1.", "#7e6a3c", { body: "coupe", roof: 34, cabin: [0.42, 0.72], nose: 54, tail: 48, rearDrop: 1, wheelbase: 0.58, width: 0.46 }, true),
  car(33, "hypercar", "Ferrari LaFerrari", "Ferrari", 2013, "LAFERRARI", 2.9, 350, 499, "ferrari's first hybrid. 963 horsepower and the name says the ferrari.", "#d0121b", { body: "coupe", roof: 31, cabin: [0.34, 0.68], nose: 52, tail: 40, rearDrop: 0.75, wheelbase: 0.6, width: 0.48 }),
  car(34, "hypercar", "Ferrari F80", "Ferrari", 2024, "F80", 2.2, 350, 799, "a v6 with 1,200 horsepower and a passenger seat set slightly behind the driver's.", "#d0121b", { body: "coupe", roof: 32, cabin: [0.34, 0.68], nose: 52, tail: 38, rearDrop: 0.5, spoiler: 1, wheelbase: 0.6, width: 0.5 }),
  car(35, "hypercar", "Porsche 918 Spyder", "Porsche", 2013, "918", 2.6, 345, 918, "a v8 from a le mans prototype, exhausts that exit on top, and it can run silent on battery.", "#c9ccd2", { body: "roadster", roof: 36, cabin: [0.38, 0.66], nose: 53, tail: 42, rearDrop: 0.5, wheelbase: 0.6, width: 0.48 }),
  car(36, "hypercar", "Lamborghini Aventador SVJ", "Lamborghini", 2018, "SVJ", 2.8, 350, 900, "the last big naturally aspirated v12. it held the nürburgring record with a system that stalls the wing.", "#5fc03c", { body: "coupe", roof: 32, cabin: [0.34, 0.66], nose: 52, tail: 38, rearDrop: 0.6, spoiler: 2, wheelbase: 0.6, width: 0.5 }),
  car(37, "hypercar", "Lamborghini Sián", "Lamborghini", 2019, "SIAN", 2.8, 350, 63, "lamborghini's first hybrid used a supercapacitor instead of a battery. sixty-three built.", "#7fbf3a", { body: "coupe", roof: 32, cabin: [0.34, 0.66], nose: 52, tail: 38, rearDrop: 0.6, spoiler: 1, wheelbase: 0.6, width: 0.5 }),
  car(38, "hypercar", "Lamborghini Centenario", "Lamborghini", 2016, "CENTENARIO", 2.8, 350, 40, "built for ferruccio's hundredth birthday. twenty coupés, twenty roadsters, all sold before anyone saw one.", "#3a3f48", { body: "coupe", roof: 32, cabin: [0.34, 0.66], nose: 52, tail: 38, rearDrop: 0.6, spoiler: 1, wheelbase: 0.6, width: 0.5 }),
  car(39, "hypercar", "Pagani Huayra", "Pagani", 2011, "HUAYRA", 3.3, 370, 100, "named after a wind god. four active flaps steer the air, and every bolt is titanium with a logo.", "#c5c8cd", { body: "coupe", roof: 32, cabin: [0.36, 0.68], nose: 52, tail: 42, rearDrop: 0.7, wheelbase: 0.6, width: 0.48 }, true),
  car(40, "hypercar", "Pagani Huayra BC", "Pagani", 2016, "HUAYRABC", 2.8, 350, 20, "for benny caiola, pagani's first customer. 132 kilos lighter than the huayra and twenty built.", "#1f4fd6", { body: "coupe", roof: 32, cabin: [0.36, 0.68], nose: 52, tail: 42, rearDrop: 0.6, spoiler: 2, wheelbase: 0.6, width: 0.48 }, true),
  car(41, "hypercar", "Aston Martin Valkyrie", "Aston Martin", 2021, "VALKYRIE", 2.5, 402, 150, "a formula one car you can register. the v12 revs to 11,100 and you sit with your feet up.", "#1e3c2e", { body: "coupe", roof: 30, cabin: [0.36, 0.66], nose: 54, tail: 40, rearDrop: 0.5, spoiler: 2, wheelbase: 0.62, width: 0.5 }, true),
  car(42, "hypercar", "Mercedes-AMG One", "Mercedes-AMG", 2022, "AMGONE", 2.9, 352, 275, "lewis hamilton's f1 engine in a road car. it took five years to make it idle.", "#c5c8cd", { body: "coupe", roof: 31, cabin: [0.36, 0.68], nose: 53, tail: 40, rearDrop: 0.5, spoiler: 2, wheelbase: 0.62, width: 0.5 }),
  car(43, "hypercar", "Rimac Nevera", "Rimac", 2021, "NEVERA", 1.8, 412, 150, "four motors, 1,914 horsepower, and twenty-three records in one day.", "#1c2536", { body: "coupe", roof: 31, cabin: [0.32, 0.68], nose: 52, tail: 40, rearDrop: 0.7, wheelbase: 0.62, width: 0.5 }),
  car(44, "hypercar", "Hennessey Venom F5", "Hennessey", 2021, "VENOMF5", 2.6, 437, 24, "1,817 horsepower from a twin-turbo v8 named fury. built in texas to chase 500 km/h.", "#c9ccd2", { body: "coupe", roof: 32, cabin: [0.36, 0.7], nose: 53, tail: 40, rearDrop: 0.7, spoiler: 1, wheelbase: 0.62, width: 0.5 }, true),
  car(45, "hypercar", "SSC Tuatara", "SSC", 2020, "TUATARA", 2.5, 455, 100, "a 455 km/h two-way average on a florida runway, the second time, with witnesses.", "#f4f2ec", { body: "coupe", roof: 33, cabin: [0.36, 0.7], nose: 54, tail: 42, rearDrop: 0.8, wheelbase: 0.62, width: 0.5 }, true),
  car(46, "hypercar", "Gordon Murray T.50", "Gordon Murray Automotive", 2022, "T50", 2.8, 350, 100, "the f1 designer's do-over: central seat, 12,100 rpm v12, a fan in the tail and 986 kilos.", "#c5c8cd", { body: "coupe", roof: 30, cabin: [0.34, 0.68], nose: 52, tail: 40, rearDrop: 0.6, wheelbase: 0.6, width: 0.46 }, true),
  car(47, "hypercar", "Czinger 21C", "Czinger", 2021, "21C", 1.9, 407, 80, "3d-printed by robots in los angeles. driver and passenger sit in a line, like a jet.", "#c9ccd2", { body: "coupe", roof: 30, cabin: [0.36, 0.66], nose: 54, tail: 40, rearDrop: 0.4, spoiler: 2, wheelbase: 0.62, width: 0.44 }, true),
  car(48, "hypercar", "Bugatti Divo", "Bugatti", 2018, "DIVO", 2.4, 380, 40, "a chiron built for corners. forty made, all sold at the reveal party.", "#4a7dd6", { body: "coupe", roof: 30, cabin: [0.3, 0.68], nose: 50, tail: 36, rearDrop: 0.6, spoiler: 2, wheelbase: 0.62, width: 0.5 }),
  car(49, "hypercar", "Maserati MC12", "Maserati", 2004, "MC12", 3.8, 330, 50, "an enzo in a longer, wider maserati suit, built so the race car could exist.", "#f4f2ec", { body: "coupe", roof: 31, cabin: [0.36, 0.68], nose: 53, tail: 40, rearDrop: 0.5, spoiler: 2, wheelbase: 0.62, width: 0.5 }),

  // ── exotic · p3 ──────────────────────────────────────────────────────
  car(50, "exotic", "Ferrari Testarossa", "Ferrari", 1984, "TESTAROSSA", 5.3, 290, 7177, "side strakes wide enough to hide a briefcase. the eighties in one car.", "#d0121b", { body: "coupe", roof: 32, cabin: [0.34, 0.64], nose: 52, tail: 40, rearDrop: 0.4, wheelbase: 0.6, width: 0.49 }, true),
  car(51, "exotic", "Ferrari 360 Modena", "Ferrari", 1999, "360", 4.5, 295, 8800, "the first aluminium ferrari, with a glass engine cover so the v8 is always on display.", "#d0121b", { body: "coupe", roof: 31, cabin: [0.34, 0.66], nose: 53, tail: 42, rearDrop: 0.6, wheelbase: 0.6, width: 0.46 }, true),
  car(52, "exotic", "Ferrari F355", "Ferrari", 1994, "F355", 4.7, 295, 11273, "five valves per cylinder, an exhaust note used in films, and the first paddle-shift ferrari.", "#f3c400", { body: "coupe", roof: 32, cabin: [0.34, 0.64], nose: 53, tail: 42, rearDrop: 0.5, wheelbase: 0.6, width: 0.46 }),
  car(53, "exotic", "Ferrari 550 Maranello", "Ferrari", 1996, "550", 4.4, 320, 3083, "the v12 went back to the front, the gearbox stayed a gated manual.", "#1c2540", { body: "coupe", roof: 30, cabin: [0.3, 0.6], nose: 50, tail: 38, rearDrop: 0.4, wheelbase: 0.58, width: 0.45 }),
  car(54, "exotic", "Lamborghini Diablo", "Lamborghini", 1990, "DIABLO", 4.5, 325, 2884, "the countach's successor with 325 km/h and, eventually, headlights borrowed from a nissan.", "#f3c400", { body: "coupe", roof: 31, cabin: [0.36, 0.66], nose: 52, tail: 40, rearDrop: 0.5, spoiler: 1, wheelbase: 0.6, width: 0.5 }),
  car(55, "exotic", "Lamborghini Murciélago", "Lamborghini", 2001, "MURCI", 3.8, 330, 4099, "the first lamborghini audi paid for. named after a bull that refused to die.", "#f5731c", { body: "coupe", roof: 31, cabin: [0.36, 0.66], nose: 52, tail: 40, rearDrop: 0.55, wheelbase: 0.6, width: 0.5 }),
  car(56, "exotic", "Lamborghini Gallardo", "Lamborghini", 2003, "GALLARDO", 4.2, 309, 14022, "the v10 that saved lamborghini. more of these than every earlier model combined.", "#7fbf3a", { body: "coupe", roof: 31, cabin: [0.34, 0.66], nose: 52, tail: 40, rearDrop: 0.45, wheelbase: 0.6, width: 0.48 }),
  car(57, "exotic", "Lamborghini Huracán", "Lamborghini", 2014, "HURACAN", 3.2, 325, 20000, "the gallardo's replacement, and the last lamborghini without a turbo or a battery.", "#5fc03c", { body: "coupe", roof: 31, cabin: [0.34, 0.66], nose: 52, tail: 40, rearDrop: 0.5, wheelbase: 0.6, width: 0.48 }, true),
  car(58, "exotic", "Porsche 911 Turbo", "Porsche", 1975, "930", 5.5, 250, 21589, "the widowmaker. a whale tail, a huge turbo and nothing until it arrived.", "#c9ccd2", { body: "coupe", roof: 26, cabin: [0.28, 0.6], nose: 50, tail: 44, rearDrop: 0.9, spoiler: 2, wheelbase: 0.58, width: 0.43 }),
  car(59, "exotic", "Porsche 911 GT3 RS 4.0", "Porsche", 2011, "GT3RS40", 3.9, 310, 600, "the last of the mezger engines, bored to four litres. six hundred, all gone in weeks.", "#f4f2ec", { body: "coupe", roof: 27, cabin: [0.28, 0.6], nose: 50, tail: 42, rearDrop: 0.85, spoiler: 2, wheelbase: 0.58, width: 0.45 }),
  car(60, "exotic", "Porsche 928", "Porsche", 1977, "928", 6.8, 230, 61056, "the car that was supposed to replace the 911. a v8 up front and pop-up headlights that lie flat.", "#a08c5a", { body: "coupe", roof: 30, cabin: [0.28, 0.6], nose: 52, tail: 44, rearDrop: 0.9, wheelbase: 0.6, width: 0.45 }, true),
  car(61, "exotic", "Audi Quattro", "Audi", 1980, "QUATTRO", 7.1, 220, 11452, "the coupé that brought four-wheel drive to rallying and then to everything else.", "#f4f2ec", { body: "coupe", roof: 26, cabin: [0.3, 0.62], nose: 48, tail: 38, rearDrop: 0.15, wheelbase: 0.58, width: 0.42 }),
  car(62, "exotic", "Aston Martin Vanquish", "Aston Martin", 2001, "VANQUISH", 5.0, 306, 2589, "bonded aluminium, a v12 and a starring role once the db5 had retired.", "#8b9299", { body: "coupe", roof: 29, cabin: [0.3, 0.62], nose: 50, tail: 40, rearDrop: 0.5, wheelbase: 0.6, width: 0.45 }, true),
  car(63, "exotic", "Maserati Ghibli", "Maserati", 1967, "GHIBLI", 6.8, 265, 1274, "giugiaro's long, low coupé with a dry-sump v8. the most beautiful maserati, most days.", "#8b0f1e", { body: "coupe", roof: 32, cabin: [0.28, 0.58], nose: 52, tail: 40, rearDrop: 0.6, wheelbase: 0.6, width: 0.42 }, true),
  car(64, "exotic", "Alfa Romeo 8C Competizione", "Alfa Romeo", 2007, "8C", 4.2, 292, 500, "a ferrari-built v8 in a carbon body that stopped traffic. five hundred coupés.", "#a3111d", { body: "coupe", roof: 30, cabin: [0.3, 0.62], nose: 52, tail: 40, rearDrop: 0.6, wheelbase: 0.6, width: 0.45 }),
  car(65, "exotic", "Lotus Esprit", "Lotus", 1976, "ESPRIT", 8.4, 222, 10675, "a folded-paper wedge that turned into a submarine for roger moore.", "#f4f2ec", { body: "coupe", roof: 34, cabin: [0.36, 0.62], nose: 54, tail: 42, rearDrop: 0.3, wheelbase: 0.6, width: 0.44 }, true),
  car(66, "exotic", "Lotus Elise", "Lotus", 1996, "ELISE", 5.9, 202, 10619, "an extruded aluminium tub glued together and 725 kilos. the reason lightness has a fan club.", "#f3c400", { body: "roadster", roof: 38, cabin: [0.38, 0.62], nose: 54, tail: 44, rearDrop: 0.4, wheelbase: 0.6, size: 0.86, width: 0.44 }),
  car(67, "exotic", "De Tomaso Pantera", "De Tomaso", 1971, "PANTERA", 5.5, 256, 7260, "italian body, ford v8, sold through lincoln dealers. elvis shot his when it wouldn't start.", "#f3c400", { body: "coupe", roof: 32, cabin: [0.34, 0.62], nose: 52, tail: 40, rearDrop: 0.5, wheelbase: 0.6, width: 0.46 }, true),
  car(68, "exotic", "Jaguar E-Type", "Jaguar", 1961, "ETYPE", 7.1, 241, 72515, "enzo called it the most beautiful car ever made. 150 mph for the price of a family saloon.", "#1f4d2b", { body: "coupe", roof: 30, cabin: [0.24, 0.5], nose: 54, tail: 42, rearDrop: 0.7, wheelbase: 0.58, width: 0.38 }, true),
  car(69, "exotic", "Mercedes-Benz SLR McLaren", "Mercedes-Benz", 2003, "SLR", 3.8, 334, 2157, "a supercharged v8 behind the front axle, side exhausts and doors that swing up and forward.", "#c5c8cd", { body: "coupe", roof: 30, cabin: [0.28, 0.58], nose: 50, tail: 42, rearDrop: 0.6, wheelbase: 0.62, width: 0.46 }),
  car(70, "exotic", "BMW Z8", "BMW", 1999, "Z8", 4.7, 250, 5703, "a 507 for the year 2000, with the m5's v8 and a bond film to launch it.", "#c5c8cd", { body: "roadster", roof: 38, cabin: [0.36, 0.6], nose: 52, tail: 42, rearDrop: 0.3, wheelbase: 0.6, width: 0.42 }),
  car(71, "exotic", "Ford GT (2005)", "Ford", 2005, "GT05", 3.8, 330, 4038, "the gt40 remade for ford's centenary, with a supercharged v8 and doors that take a piece of roof.", "#1d3fbd", { body: "coupe", roof: 32, cabin: [0.34, 0.64], nose: 52, tail: 40, rearDrop: 0.5, spoiler: 1, wheelbase: 0.6, width: 0.47 }),
  car(72, "exotic", "Ford GT (2017)", "Ford", 2017, "GT17", 3.3, 348, 1350, "a le mans class winner first, a road car second. flying buttresses and a v6 that sounds like it means it.", "#1d3fbd", { body: "coupe", roof: 31, cabin: [0.34, 0.66], nose: 52, tail: 38, rearDrop: 0.6, spoiler: 2, wheelbase: 0.6, width: 0.48 }, true),
  car(73, "exotic", "Tesla Roadster", "Tesla", 2008, "ROADSTER", 3.9, 201, 2450, "a lotus elise with laptop batteries. the first tesla, and the one now orbiting the sun.", "#d0121b", { body: "roadster", roof: 38, cabin: [0.38, 0.62], nose: 54, tail: 44, rearDrop: 0.4, wheelbase: 0.6, size: 0.86, width: 0.44 }),

  // ── muscle · p4 ──────────────────────────────────────────────────────
  car(74, "muscle", "Ford Mustang", "Ford", 1965, "MUSTANG", 7.8, 195, 559451, "the pony car. half a million sold in the first model year, most of them to people who'd never wanted a car before.", "#1a3fa8", { body: "coupe", roof: 28, cabin: [0.3, 0.6], nose: 46, tail: 38, rearDrop: 0.6, wheelbase: 0.58, width: 0.42 }, true),
  car(75, "muscle", "Shelby GT500", "Shelby", 1967, "GT500", 6.5, 210, 2048, "carroll shelby's big-block mustang. eleanor, before the film made her silver.", "#c9ccd2", { body: "coupe", roof: 28, cabin: [0.3, 0.6], nose: 46, tail: 38, rearDrop: 0.7, spoiler: 1, wheelbase: 0.58, width: 0.42 }, true),
  car(76, "muscle", "Ford SVT Lightning", "Ford", 1999, "LIGHTNING99", 5.4, 235, 28124, "a supercharged pickup that held the record for the fastest production truck in the world.", "#d0121b", { body: "pickup", roof: 18, cabin: [0.44, 0.7], nose: 40, tail: 34, bed: 36, wheelbase: 0.64, wheel: 14, size: 1.12, width: 0.46 }, true),
  car(77, "muscle", "Ford F-150 Lightning", "Ford", 2022, "LIGHTNING", 4.2, 180, null, "the best-selling vehicle in america, with a frunk where the v8 used to be.", "#1e6fd8", { body: "pickup", roof: 18, cabin: [0.42, 0.7], nose: 40, tail: 34, bed: 36, wheelbase: 0.64, wheel: 14, size: 1.15, width: 0.46 }, true),
  car(78, "muscle", "Chevrolet Camaro SS", "Chevrolet", 1969, "CAMARO69", 6.9, 205, 34932, "the year every camaro looked angry. the ss badge meant a 396 under the hood.", "#f5731c", { body: "coupe", roof: 28, cabin: [0.3, 0.6], nose: 46, tail: 38, rearDrop: 0.5, wheelbase: 0.58, width: 0.42 }, true),
  car(79, "muscle", "Chevrolet Corvette Sting Ray", "Chevrolet", 1963, "STINGRAY", 6.0, 230, 117964, "the split rear window lasted one year. the shape lasted forever.", "#1a3fa8", { body: "coupe", roof: 30, cabin: [0.28, 0.56], nose: 52, tail: 40, rearDrop: 0.9, wheelbase: 0.58, width: 0.4 }, true),
  car(80, "muscle", "Chevrolet Corvette ZR1", "Chevrolet", 2019, "ZR1", 3.0, 341, 2953, "755 horsepower, a hood that doesn't quite cover the supercharger, and the last front-engine corvette.", "#1e6fd8", { body: "coupe", roof: 30, cabin: [0.3, 0.6], nose: 50, tail: 40, rearDrop: 0.7, spoiler: 2, wheelbase: 0.6, width: 0.45 }, true),
  car(81, "muscle", "Chevrolet Chevelle SS 454", "Chevrolet", 1970, "CHEVELLE", 5.6, 210, 4475, "the ls6: 450 horsepower from the factory, the most ever in a muscle car until the hellcat.", "#1c1e24", { body: "coupe", roof: 27, cabin: [0.3, 0.6], nose: 46, tail: 38, rearDrop: 0.3, wheelbase: 0.58, width: 0.42 }, true),
  car(82, "muscle", "Pontiac GTO Judge", "Pontiac", 1969, "GTO", 6.5, 200, 6833, "the goat, with a wing, stripes and a name from a tv sketch. the first muscle car, some say.", "#f5731c", { body: "coupe", roof: 27, cabin: [0.3, 0.6], nose: 46, tail: 38, rearDrop: 0.3, spoiler: 1, wheelbase: 0.58, width: 0.42 }, true),
  car(83, "muscle", "Pontiac Firebird Trans Am", "Pontiac", 1977, "TRANSAM", 8.5, 190, 68745, "black and gold with a screaming chicken on the hood. smokey and the bandit sold more of these than any ad.", "#1c1e24", { body: "coupe", roof: 29, cabin: [0.3, 0.6], nose: 48, tail: 40, rearDrop: 0.6, spoiler: 1, wheelbase: 0.6, width: 0.43 }, true),
  car(84, "muscle", "Dodge Charger R/T", "Dodge", 1969, "CHARGER", 6.2, 210, 20057, "the general lee, the bullitt villain, the coke-bottle hips. a 440 magnum was the sensible option.", "#f5731c", { body: "coupe", roof: 27, cabin: [0.3, 0.6], nose: 46, tail: 38, rearDrop: 0.35, wheelbase: 0.6, width: 0.44 }, true),
  car(85, "muscle", "Dodge Challenger SRT Demon", "Dodge", 2018, "DEMON", 2.4, 270, 3300, "840 horsepower on race fuel, one seat as standard, and it lifts its front wheels off the line.", "#d0121b", { body: "coupe", roof: 26, cabin: [0.3, 0.6], nose: 44, tail: 36, rearDrop: 0.3, spoiler: 1, wheelbase: 0.6, width: 0.45 }),
  car(86, "muscle", "Dodge Viper RT/10", "Dodge", 1992, "VIPER", 4.8, 266, 6709, "an eight-litre v10 from a truck, no roof, no windows, no airbags, no traction control.", "#d0121b", { body: "roadster", roof: 36, cabin: [0.36, 0.56], nose: 52, tail: 42, rearDrop: 0.4, wheelbase: 0.6, width: 0.46 }, true),
  car(87, "muscle", "Plymouth Superbird", "Plymouth", 1970, "SUPERBIRD", 5.7, 240, 1935, "a nose cone and a wing tall enough to open the trunk under. built to win nascar; banned the next year.", "#1e6fd8", { body: "coupe", roof: 27, cabin: [0.3, 0.58], nose: 50, tail: 38, rearDrop: 0.3, spoiler: 2, wheelbase: 0.6, width: 0.43 }, true),
  car(88, "muscle", "Plymouth Hemi 'Cuda", "Plymouth", 1970, "CUDA", 5.8, 220, 666, "the 426 hemi in the smallest body it fit. 666 built that year, which sounds about right.", "#a020a8", { body: "coupe", roof: 27, cabin: [0.3, 0.6], nose: 46, tail: 38, rearDrop: 0.35, wheelbase: 0.58, width: 0.42 }, true),
  car(89, "muscle", "Buick GNX", "Buick", 1987, "GNX", 4.9, 200, 547, "a turbo v6 in an all-black buick that out-dragged the corvette and the ferrari of its year.", "#1c1e24", { body: "coupe", roof: 27, cabin: [0.3, 0.6], nose: 46, tail: 38, rearDrop: 0.2, wheelbase: 0.58, width: 0.42 }),
  car(90, "muscle", "Shelby GT350", "Shelby", 1965, "GT350", 6.7, 210, 562, "a mustang stripped, stiffened and painted white with blue stripes. the first shelby mustang.", "#f4f2ec", { body: "coupe", roof: 28, cabin: [0.3, 0.6], nose: 46, tail: 38, rearDrop: 0.6, wheelbase: 0.58, width: 0.42 }, true),
  car(91, "muscle", "GMC Syclone", "GMC", 1991, "SYCLONE", 4.5, 203, 2995, "a small pickup with a turbo v6 and four-wheel drive that beat a ferrari 348 in a magazine drag race.", "#1c1e24", { body: "pickup", roof: 24, cabin: [0.48, 0.7], nose: 44, tail: 38, bed: 40, wheelbase: 0.6, wheel: 12, size: 0.98, width: 0.42 }, true),
  car(92, "muscle", "Chevrolet Camaro ZL1", "Chevrolet", 1969, "ZL1", 5.5, 220, 69, "an all-aluminium 427 that cost more than the car. sixty-nine built through a dealer loophole.", "#f4f2ec", { body: "coupe", roof: 28, cabin: [0.3, 0.6], nose: 46, tail: 38, rearDrop: 0.5, wheelbase: 0.58, width: 0.42 }, true),
  car(93, "muscle", "Tesla Model S Plaid", "Tesla", 2021, "MODELS", 2.1, 322, null, "three motors, 1,020 horsepower, a yoke instead of a wheel. the quickest thing on this floor.", "#c9ccd2", { body: "sedan", roof: 25, cabin: [0.24, 0.64], nose: 50, tail: 40, rearDrop: 0.6, wheelbase: 0.62, size: 1.08, width: 0.43 }, true),
  car(94, "muscle", "Tesla Cybertruck", "Tesla", 2023, "CYBERTRUCK", 2.7, 209, null, "stainless steel, no paint, no curves. cyberbeast numbers, and the window did break at the reveal.", "#b9bcc0", { body: "pickup", roof: 14, cabin: [0.36, 0.7], nose: 42, tail: 34, bed: 30, wheelbase: 0.64, wheel: 15, size: 1.2, width: 0.46 }),
  car(95, "muscle", "Rivian R1T", "Rivian", 2021, "R1T", 3.1, 201, null, "an electric pickup with a gear tunnel through the middle and a camp kitchen that slides out of it.", "#3d6b3a", { body: "pickup", roof: 16, cabin: [0.4, 0.72], nose: 40, tail: 34, bed: 32, wheelbase: 0.64, wheel: 15, size: 1.15, width: 0.46 }),
  car(96, "muscle", "Rivian R1S", "Rivian", 2022, "R1S", 3.1, 201, null, "seven seats, four motors and a tank turn it wasn't allowed to keep.", "#1e3c8c", { body: "wagon", roof: 14, cabin: [0.06, 0.66], nose: 42, tail: 24, rearDrop: 0.05, wheelbase: 0.62, wheel: 15, size: 1.12, width: 0.46 }),
  car(97, "muscle", "Tesla Model 3 Performance", "Tesla", 2024, "MODEL3P", 3.1, 262, null, "the cheapest way to 100 in three seconds. adaptive dampers and a track mode in a family car.", "#d0121b", { body: "sedan", roof: 26, cabin: [0.26, 0.66], nose: 50, tail: 40, rearDrop: 0.6, wheelbase: 0.6, size: 1.0, width: 0.42 }),

  // ── jdm · p5 ─────────────────────────────────────────────────────────
  car(98, "jdm", "Toyota Supra RZ", "Toyota", 1993, "SUPRA", 4.9, 250, null, "the 2jz. a straight six that takes a thousand horsepower on stock internals, if you ask nicely.", "#f4f2ec", { body: "coupe", roof: 29, cabin: [0.32, 0.62], nose: 50, tail: 40, rearDrop: 0.55, spoiler: 2, wheelbase: 0.6, width: 0.43 }, true),
  car(99, "jdm", "Toyota Sprinter Trueno AE86", "Toyota", 1983, "AE86", 8.5, 195, null, "1,200 kilos, rear-wheel drive, 130 horsepower. a tofu delivery car made mountain roads famous.", "#f4f2ec", { body: "hatch", roof: 28, cabin: [0.2, 0.62], nose: 48, tail: 36, rearDrop: 0.6, wheelbase: 0.58, size: 0.88, width: 0.4 }, true),
  car(100, "jdm", "Toyota MR2 Turbo", "Toyota", 1989, "MR2", 6.1, 240, null, "a mid-engine toyota with pop-up lights that people called the poor man's ferrari. they weren't wrong.", "#d0121b", { body: "coupe", roof: 31, cabin: [0.34, 0.62], nose: 52, tail: 40, rearDrop: 0.5, wheelbase: 0.6, size: 0.9, width: 0.43 }, true),
  car(101, "jdm", "Nissan Skyline GT-R R32", "Nissan", 1989, "R32", 5.6, 250, 43937, "godzilla. it won every race in australia until they changed the rules.", "#8e9aa6", { body: "coupe", roof: 27, cabin: [0.3, 0.62], nose: 48, tail: 38, rearDrop: 0.3, spoiler: 1, wheelbase: 0.6, width: 0.43 }, true),
  car(102, "jdm", "Nissan Skyline GT-R R33", "Nissan", 1995, "R33", 5.4, 250, 16668, "the first production car under eight minutes at the nürburgring, and the one people forget.", "#1c2540", { body: "coupe", roof: 27, cabin: [0.3, 0.62], nose: 48, tail: 38, rearDrop: 0.3, spoiler: 1, wheelbase: 0.6, width: 0.43 }, true),
  car(103, "jdm", "Nissan Skyline GT-R R34", "Nissan", 1999, "R34", 4.9, 265, 11578, "bayside blue, a screen showing boost pressure, and the rb26 at its peak. the poster.", "#2a5bff", { body: "coupe", roof: 27, cabin: [0.3, 0.62], nose: 48, tail: 38, rearDrop: 0.3, spoiler: 2, wheelbase: 0.6, width: 0.43 }, true),
  car(104, "jdm", "Nissan GT-R", "Nissan", 2007, "R35", 2.9, 315, null, "a twin-turbo v6, a dual-clutch gearbox and launch control that embarrassed cars costing three times as much.", "#c9ccd2", { body: "coupe", roof: 26, cabin: [0.3, 0.62], nose: 48, tail: 36, rearDrop: 0.4, spoiler: 1, wheelbase: 0.6, width: 0.45 }, true),
  car(105, "jdm", "Nissan Silvia S15", "Nissan", 1999, "S15", 6.0, 240, null, "the drift car. rear-wheel drive, a turbo four, and a face everyone tried to copy.", "#f3c400", { body: "coupe", roof: 29, cabin: [0.3, 0.62], nose: 50, tail: 38, rearDrop: 0.4, spoiler: 1, wheelbase: 0.6, size: 0.95, width: 0.42 }, true),
  car(106, "jdm", "Nissan 300ZX Twin Turbo", "Nissan", 1989, "300ZX", 5.6, 250, 164170, "the z32. a shape from 1989 that still looks like 2005, with a twin-turbo v6 buried under everything.", "#1c1e24", { body: "coupe", roof: 30, cabin: [0.3, 0.6], nose: 52, tail: 40, rearDrop: 0.5, wheelbase: 0.6, width: 0.44 }, true),
  car(107, "jdm", "Datsun 240Z", "Nissan", 1969, "240Z", 8.0, 200, 168000, "an e-type for the price of a beetle. the car that made japan a sports-car country.", "#f5731c", { body: "coupe", roof: 30, cabin: [0.24, 0.52], nose: 52, tail: 42, rearDrop: 0.8, wheelbase: 0.58, size: 0.92, width: 0.4 }, true),
  car(108, "jdm", "Honda NSX", "Honda", 1990, "NSX", 5.7, 270, 18685, "aluminium body, an f-16 cockpit and senna's chassis notes. the supercar you could drive every day.", "#d0121b", { body: "coupe", roof: 31, cabin: [0.32, 0.62], nose: 52, tail: 40, rearDrop: 0.4, spoiler: 1, wheelbase: 0.6, width: 0.44 }, true),
  car(109, "jdm", "Honda S2000", "Honda", 1999, "S2000", 6.2, 240, 110673, "9,000 rpm from two litres and a gearshift people still describe as the best ever made.", "#f4f2ec", { body: "roadster", roof: 36, cabin: [0.38, 0.62], nose: 52, tail: 42, rearDrop: 0.3, wheelbase: 0.6, size: 0.9, width: 0.42 }),
  car(110, "jdm", "Honda Civic Type R EK9", "Honda", 1997, "EK9", 6.7, 225, 16000, "a hand-ported 1.6 that revs to 8,200, red seats, and a hatchback that out-cornered sports cars.", "#f4f2ec", { body: "hatch", roof: 24, cabin: [0.14, 0.6], nose: 48, tail: 32, rearDrop: 0.3, spoiler: 1, wheelbase: 0.58, size: 0.88, width: 0.4 }, true),
  car(111, "jdm", "Acura Integra Type R", "Honda", 1997, "ITR", 6.7, 235, 3822, "the best front-wheel-drive car ever made, by consensus. 3,822 came to america.", "#f3c400", { body: "coupe", roof: 27, cabin: [0.3, 0.62], nose: 48, tail: 36, rearDrop: 0.4, spoiler: 1, wheelbase: 0.6, size: 0.92, width: 0.4 }, true),
  car(112, "jdm", "Mazda RX-7 FD", "Mazda", 1992, "FD", 5.3, 250, 68589, "a twin-turbo rotary in the prettiest japanese body of the nineties. it eats apex seals for breakfast.", "#d0121b", { body: "coupe", roof: 31, cabin: [0.3, 0.6], nose: 52, tail: 40, rearDrop: 0.6, spoiler: 1, wheelbase: 0.6, size: 0.94, width: 0.42 }, true),
  car(113, "jdm", "Mazda MX-5 Miata", "Mazda", 1989, "MIATA", 8.7, 195, 431506, "the answer is always miata. pop-up lights, a stick, and the best-selling roadster in history.", "#d0121b", { body: "roadster", roof: 38, cabin: [0.38, 0.62], nose: 54, tail: 44, rearDrop: 0.3, wheelbase: 0.58, size: 0.84, width: 0.42 }),
  car(114, "jdm", "Subaru Impreza 22B STI", "Subaru", 1998, "22B", 4.9, 250, 424, "a two-door widebody for subaru's fortieth birthday. four hundred, sold out in two days.", "#1e3c8c", { body: "coupe", roof: 26, cabin: [0.3, 0.62], nose: 48, tail: 38, rearDrop: 0.2, spoiler: 2, wheelbase: 0.6, size: 0.92, width: 0.43 }, true),
  car(115, "jdm", "Mitsubishi Lancer Evolution VI Tommi Mäkinen", "Mitsubishi", 1999, "EVO6", 4.7, 240, 2500, "four world titles in a row, so they put his name on the car and painted it his colour.", "#d0121b", { body: "sedan", roof: 26, cabin: [0.28, 0.64], nose: 48, tail: 38, rearDrop: 0.15, spoiler: 2, wheelbase: 0.6, size: 0.94, width: 0.43 }, true),
  car(116, "jdm", "Mitsubishi Lancer Evolution X Final Edition", "Mitsubishi", 2015, "EVOX", 5.0, 250, 2600, "the last evo. a number plaque on the console and a wing to say goodbye with.", "#1c1e24", { body: "sedan", roof: 25, cabin: [0.28, 0.64], nose: 48, tail: 38, rearDrop: 0.15, spoiler: 2, wheelbase: 0.6, size: 0.96, width: 0.44 }, true),
  car(117, "jdm", "Toyota Celica GT-Four ST205", "Toyota", 1994, "GTFOUR", 5.9, 240, 2500, "the homologation celica, with a water spray for the intercooler and a rally ban for a clever restrictor.", "#f4f2ec", { body: "coupe", roof: 28, cabin: [0.28, 0.62], nose: 48, tail: 38, rearDrop: 0.5, spoiler: 2, wheelbase: 0.6, size: 0.92, width: 0.42 }, true),
  car(118, "jdm", "Autozam AZ-1", "Mazda", 1992, "AZ1", 12, 140, 4392, "a kei car with gullwing doors and a mid-mounted turbo. 660 cc of pure theatre.", "#1e6fd8", { body: "coupe", roof: 26, cabin: [0.34, 0.66], nose: 50, tail: 36, rearDrop: 0.4, wheelbase: 0.6, wheel: 11, size: 0.72, width: 0.44 }, true),
  car(119, "jdm", "Suzuki Cappuccino", "Suzuki", 1991, "CAPPUCCINO", 8.0, 140, 28010, "a front-mid-engine, rear-drive kei roadster with a roof in three pieces. 700 kilos of good decisions.", "#d0121b", { body: "roadster", roof: 36, cabin: [0.4, 0.62], nose: 52, tail: 42, rearDrop: 0.3, wheelbase: 0.6, wheel: 11, size: 0.72, width: 0.42 }, true),
  car(120, "jdm", "Mazda Cosmo 110S", "Mazda", 1967, "COSMO", 8.7, 185, 1176, "the first twin-rotor production car. hand-built, one a day, and it looks like a spaceship from a kinder film.", "#f4f2ec", { body: "coupe", roof: 32, cabin: [0.3, 0.58], nose: 54, tail: 42, rearDrop: 0.5, wheelbase: 0.6, size: 0.9, width: 0.4 }, true),
];

if (process.env.NODE_ENV !== "production") {
  const ids = new Set<number>();
  const slugs = new Set<string>();
  for (const c of CARS) {
    if (ids.has(c.id)) throw new Error(`duplicate car id ${c.id}`);
    if (slugs.has(c.slug)) throw new Error(`duplicate ticker ${c.ticker}`);
    ids.add(c.id);
    slugs.add(c.slug);
  }
}

export const CAR_BY_ID = new Map(CARS.map((c) => [c.id, c]));
export const CAR_BY_SLUG = new Map(CARS.map((c) => [c.slug, c]));

export function pairOf(car: Car): Pair {
  return pairForMaker(car.maker);
}

export function decadeOf(car: Car): string {
  return `${Math.floor(car.year / 10) * 10}s`;
}

export const MAKERS = [...new Set(CARS.map((c) => c.maker))].sort((a, b) => a.localeCompare(b));
export const DECADES = [...new Set(CARS.map(decadeOf))].sort();
