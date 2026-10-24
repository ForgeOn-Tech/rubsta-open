import fs from "node:fs/promises";
import path from "node:path";

import type { CertificateArtwork } from "@/lib/certificate-pdf";

// Outside public/, so the signature cannot be downloaded from the site. deploy/Dockerfile copies it.
const ARTWORK_DIR = path.join(process.cwd(), "assets", "certificate");
/** The partners in the order they print, each in the same size box. ForgeLabs is set as text. */
const PARTNER_LOGOS = [
  { name: "Nerul Gymkhana", file: "nerul-gymkhana.png" },
  { name: "SP Cards", file: "sp-cards.png" },
  { name: "Team Leader Logistics", file: "team-leader.png" },
  { name: "Heath Matthews Physio", file: "heath-matthews-physio.png" },
  { name: "Heartfull", file: "heartfull.png" },
];
/** Optional: certificates print a blank signature line until this file is added. */
const SIGNATURE = "signature.png";

async function readArtwork(name: string): Promise<Uint8Array> {
  return new Uint8Array(await fs.readFile(path.join(ARTWORK_DIR, name)));
}

async function readSignature(): Promise<Uint8Array | null> {
  try {
    return await readArtwork(SIGNATURE);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

/** Read from disk on every call, so a newly added signature shows without a restart. */
export async function loadCertificateArtwork(): Promise<CertificateArtwork> {
  const [partnerLogos, signature] = await Promise.all([
    Promise.all(PARTNER_LOGOS.map(async ({ name, file }) => ({ name, png: await readArtwork(file) }))),
    readSignature(),
  ]);
  return { partnerLogos, signature };
}
