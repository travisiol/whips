import photosJson from "./photos.json";
import type { Car } from "./catalog";

/**
 * Real photos, one per car, from Wikimedia Commons under free licences —
 * picked by scripts/fetch-photos.mts, detoured by scripts/cutout-photos.py.
 * Every one is credited on the car's sheet and on /credits; that credit is
 * the licence's only condition and it stays with the photo.
 */
export type Photo = {
  slug: string;
  /** Commons file title ("File:…"). */
  file: string;
  author: string;
  license: string;
  licenseUrl: string;
  /** The file's page on Commons. */
  page: string;
  width: number;
  height: number;
  query: string;
};

export const PHOTOS: Photo[] = photosJson as Photo[];
const bySlug = new Map(PHOTOS.map((p) => [p.slug, p]));

export function photoOf(car: Pick<Car, "slug">): Photo | null {
  return bySlug.get(car.slug) ?? null;
}

/** The transparent cutout served from public/cars (WebP with alpha, 1200 px). */
export function photoSrc(car: Pick<Car, "slug">): string {
  return `/cars/${car.slug}.webp`;
}

/** "photo: author · licence" for a credit line. */
export function photoCredit(p: Photo): string {
  const author = p.author.length > 40 ? `${p.author.slice(0, 38)}…` : p.author;
  return `photo: ${author} · ${p.license}`;
}
