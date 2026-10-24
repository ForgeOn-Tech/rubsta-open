import { PDFDocument, StandardFonts, rgb, type Color, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";

import type { CertificateKind, CertificateText } from "@/lib/certificates";

/** The certificate fonts can print only Latin letters and common punctuation. */
export class UnprintableTextError extends Error {
  constructor(cause: unknown) {
    super("The certificate font cannot print some characters in this certificate.", { cause });
    this.name = "UnprintableTextError";
  }
}

/** The PNG images a certificate carries. The signature is null until the organisers supply one. */
export interface CertificateArtwork {
  /** In print order. Each logo fits the same size box. */
  partnerLogos: readonly { name: string; png: Uint8Array }[];
  signature: Uint8Array | null;
}

// A4 landscape, in points.
const PAGE_WIDTH = 841.89;
const PAGE_HEIGHT = 595.28;
const CENTRE = PAGE_WIDTH / 2;
const FRAME = 16;
const INNER_RULE = 30;
const TEXT_MARGIN = 90;
const NAME_SIZE = 46;
const STATEMENT_SIZE = 15;
const NAME_RULE_HALF_WIDTH = 220;
const NAME_RULE_OVERHANG = 24;
const NAME_Y = 316;
// Below the italic descenders (g, y) at full size.
const NAME_RULE_Y = 294;
const MARK_SIZE = 46;
// The seal sits in the top-right corner like a stamp.
const SEAL_RADIUS = 40;
const SEAL_X = PAGE_WIDTH - 96;
const SEAL_Y = 509;
// Text inside the seal stays clear of its inner ring.
const SEAL_TEXT_WIDTH = 2 * SEAL_RADIUS - 28;
const SIGNATURE_WIDTH = 200;
const SIGNATURE_LEFT = CENTRE - SIGNATURE_WIDTH / 2;
const SIGNATURE_RULE_Y = 146;
const SIGNATURE_MAX_HEIGHT = 34;
const SIGNATORY_NAME = "Manvir Randhawa";
const SIGNATORY_TITLE = "Tournament Director";
const FOOTER_Y = 42;
const PARTNERS_LABEL = "IN PARTNERSHIP WITH";
const PARTNERS_LABEL_Y = 98;
const LOGO_BOX_WIDTH = 70;
const LOGO_BOX_HEIGHT = 34;
const LOGO_GAP = 15;
const LOGOS_Y = 54;
// No ForgeLabs logo file exists yet, so it prints as a wordmark in the last box.
const WORDMARK = { first: "Forge", second: "Labs" };

// Club theme colours from globals.css.
const CREAM = rgb(0.957, 0.945, 0.91);
const FOREST = rgb(0.125, 0.235, 0.173);
const INK = rgb(0.137, 0.216, 0.165);
const MUTED = rgb(0.384, 0.412, 0.357);
const SEAL_COLOURS: Record<CertificateKind, Color> = {
  participation: FOREST,
  "runner-up": rgb(0.45, 0.49, 0.51),
  winner: rgb(0.69, 0.55, 0.18),
};

// The Rubsta Open mark from favicon.svg, drawn on a 64-unit square.
const MARK_UNITS = 64;
const MARK_TILE = "M14 0H50A14 14 0 0 1 64 14V50A14 14 0 0 1 50 64H14A14 14 0 0 1 0 50V14A14 14 0 0 1 14 0Z";
const MARK_SEAMS = "M16 18c15 8 15 20 0 28M48 18c-15 8-15 20 0 28";
const MARK_BALL_RADIUS = 21;
const MARK_SEAM_WIDTH = 3.5;

interface TextStyle {
  font: PDFFont;
  size: number;
  color: Color;
  /** Extra space between letters, in points. */
  tracking: number;
}

function widthOf(text: string, style: TextStyle): number {
  try {
    return style.font.widthOfTextAtSize(text, style.size) + style.tracking * Math.max(0, text.length - 1);
  } catch (error) {
    throw new UnprintableTextError(error);
  }
}

function drawAt(page: PDFPage, text: string, style: TextStyle, x: number, y: number): void {
  if (style.tracking === 0) {
    page.drawText(text, { x, y, size: style.size, font: style.font, color: style.color });
    return;
  }
  let cursor = x;
  for (const letter of text) {
    page.drawText(letter, { x: cursor, y, size: style.size, font: style.font, color: style.color });
    cursor += style.font.widthOfTextAtSize(letter, style.size) + style.tracking;
  }
}

function drawCentred(page: PDFPage, text: string, style: TextStyle, centre: number, y: number): void {
  drawAt(page, text, style, centre - widthOf(text, style) / 2, y);
}

/** Shrinks the text to fit `maxWidth`, never above its own size. */
function fitted(text: string, style: TextStyle, maxWidth: number): TextStyle {
  return { ...style, size: Math.min(style.size, (style.size * maxWidth) / widthOf(text, style)) };
}

function drawFrame(page: PDFPage, accent: Color): void {
  page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, color: FOREST });
  page.drawRectangle({
    x: FRAME,
    y: FRAME,
    width: PAGE_WIDTH - 2 * FRAME,
    height: PAGE_HEIGHT - 2 * FRAME,
    color: CREAM,
  });
  page.drawRectangle({
    x: INNER_RULE,
    y: INNER_RULE,
    width: PAGE_WIDTH - 2 * INNER_RULE,
    height: PAGE_HEIGHT - 2 * INNER_RULE,
    borderColor: accent,
    borderWidth: 1.25,
  });
}

function drawMark(page: PDFPage, x: number, top: number): void {
  const scale = MARK_SIZE / MARK_UNITS;
  page.drawSvgPath(MARK_TILE, { x, y: top, scale, color: FOREST });
  page.drawCircle({ x: x + MARK_SIZE / 2, y: top - MARK_SIZE / 2, size: MARK_BALL_RADIUS * scale, color: CREAM });
  page.drawSvgPath(MARK_SEAMS, { x, y: top, scale, borderColor: FOREST, borderWidth: MARK_SEAM_WIDTH * scale });
}

function drawSeal(page: PDFPage, text: CertificateText, fonts: { sans: PDFFont; sansBold: PDFFont }): void {
  const colour = SEAL_COLOURS[text.kind];
  page.drawCircle({ x: SEAL_X, y: SEAL_Y, size: SEAL_RADIUS, color: colour });
  page.drawCircle({ x: SEAL_X, y: SEAL_Y, size: SEAL_RADIUS - 5, borderColor: CREAM, borderWidth: 0.75 });
  const brand = "RUBSTA OPEN";
  drawCentred(page, brand, fitted(brand, { font: fonts.sans, size: 6.5, color: CREAM, tracking: 1.6 }, SEAL_TEXT_WIDTH - 8), SEAL_X, SEAL_Y + 14);
  const word = text.seal.toUpperCase();
  drawCentred(page, word, fitted(word, { font: fonts.sansBold, size: 12, color: CREAM, tracking: 1.2 }, SEAL_TEXT_WIDTH), SEAL_X, SEAL_Y - 4);
  page.drawLine({
    start: { x: SEAL_X - 14, y: SEAL_Y - 14 },
    end: { x: SEAL_X + 14, y: SEAL_Y - 14 },
    thickness: 0.75,
    color: CREAM,
  });
}

function drawSignature(page: PDFPage, signature: PDFImage | null, sans: PDFFont): void {
  if (signature !== null) {
    const scaled = signature.scaleToFit(SIGNATURE_WIDTH, SIGNATURE_MAX_HEIGHT);
    page.drawImage(signature, {
      x: SIGNATURE_LEFT + (SIGNATURE_WIDTH - scaled.width) / 2,
      y: SIGNATURE_RULE_Y + 4,
      width: scaled.width,
      height: scaled.height,
    });
  }
  page.drawLine({
    start: { x: SIGNATURE_LEFT, y: SIGNATURE_RULE_Y },
    end: { x: SIGNATURE_LEFT + SIGNATURE_WIDTH, y: SIGNATURE_RULE_Y },
    thickness: 0.75,
    color: INK,
  });
  const centre = SIGNATURE_LEFT + SIGNATURE_WIDTH / 2;
  drawCentred(page, SIGNATORY_NAME, { font: sans, size: 11, color: INK, tracking: 0 }, centre, SIGNATURE_RULE_Y - 15);
  drawCentred(page, SIGNATORY_TITLE, { font: sans, size: 9, color: MUTED, tracking: 0 }, centre, SIGNATURE_RULE_Y - 28);
}

/** Six equal boxes under one label: each partner logo scaled to fit its box, then the ForgeLabs wordmark. */
function drawPartners(page: PDFPage, logos: readonly PDFImage[], sansBold: PDFFont): void {
  const boxes = logos.length + 1;
  const left = CENTRE - (boxes * LOGO_BOX_WIDTH + (boxes - 1) * LOGO_GAP) / 2;
  const boxCentre = (index: number): number => left + index * (LOGO_BOX_WIDTH + LOGO_GAP) + LOGO_BOX_WIDTH / 2;
  drawCentred(page, PARTNERS_LABEL, { font: sansBold, size: 6.5, color: MUTED, tracking: 1.6 }, CENTRE, PARTNERS_LABEL_Y);
  logos.forEach((logo, index) => {
    const { width, height } = logo.scaleToFit(LOGO_BOX_WIDTH, LOGO_BOX_HEIGHT);
    page.drawImage(logo, { x: boxCentre(index) - width / 2, y: LOGOS_Y + (LOGO_BOX_HEIGHT - height) / 2, width, height });
  });
  const first: TextStyle = { font: sansBold, size: 13, color: INK, tracking: 0 };
  const second: TextStyle = { ...first, color: SEAL_COLOURS.winner };
  const start = boxCentre(logos.length) - (widthOf(WORDMARK.first, first) + widthOf(WORDMARK.second, second)) / 2;
  const baseline = LOGOS_Y + LOGO_BOX_HEIGHT / 2 - 4.5;
  drawAt(page, WORDMARK.first, first, start, baseline);
  drawAt(page, WORDMARK.second, second, start + widthOf(WORDMARK.first, first), baseline);
}

/** A one-page A4 certificate. Throws UnprintableTextError for text the fonts cannot print. */
export async function certificatePdf(text: CertificateText, artwork: CertificateArtwork): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  document.setTitle(text.title);
  document.setAuthor("Rubsta Open");
  const page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const serif = await document.embedFont(StandardFonts.TimesRoman);
  const serifItalic = await document.embedFont(StandardFonts.TimesRomanItalic);
  const sans = await document.embedFont(StandardFonts.Helvetica);
  const sansBold = await document.embedFont(StandardFonts.HelveticaBold);
  const partnerLogos = await Promise.all(artwork.partnerLogos.map((logo) => document.embedPng(logo.png)));
  const signature = artwork.signature === null ? null : await document.embedPng(artwork.signature);
  const accent = SEAL_COLOURS[text.kind];
  const textWidth = PAGE_WIDTH - 2 * TEXT_MARGIN;

  drawFrame(page, accent);
  drawMark(page, CENTRE - MARK_SIZE / 2, 530);
  drawCentred(page, "RUBSTA OPEN", { font: sansBold, size: 10, color: MUTED, tracking: 3 }, CENTRE, 466);
  drawCentred(page, text.title, { font: serif, size: 36, color: INK, tracking: 0.5 }, CENTRE, 410);
  drawCentred(page, text.lead, { font: sans, size: 12, color: MUTED, tracking: 0 }, CENTRE, 370);

  // A long name or statement shrinks to fit between the margins.
  const nameStyle = fitted(text.name, { font: serifItalic, size: NAME_SIZE, color: INK, tracking: 0 }, textWidth);
  drawCentred(page, text.name, nameStyle, CENTRE, NAME_Y);
  const ruleHalfWidth = Math.min(
    textWidth / 2 + NAME_RULE_OVERHANG,
    Math.max(NAME_RULE_HALF_WIDTH, widthOf(text.name, nameStyle) / 2 + NAME_RULE_OVERHANG),
  );
  page.drawLine({
    start: { x: CENTRE - ruleHalfWidth, y: NAME_RULE_Y },
    end: { x: CENTRE + ruleHalfWidth, y: NAME_RULE_Y },
    thickness: 1,
    color: accent,
  });
  const statementStyle = fitted(text.statement, { font: sans, size: STATEMENT_SIZE, color: INK, tracking: 0 }, textWidth);
  drawCentred(page, text.statement, statementStyle, CENTRE, 264);
  if (text.detail !== null) drawCentred(page, text.detail, { font: sans, size: 11, color: MUTED, tracking: 0 }, CENTRE, 242);

  drawSignature(page, signature, sans);
  drawSeal(page, text, { sans, sansBold });
  drawPartners(page, partnerLogos, sansBold);

  const footer: TextStyle = { font: sans, size: 8, color: MUTED, tracking: 0.3 };
  if (text.number !== null) drawAt(page, `Certificate no. ${text.number}`, footer, INNER_RULE + 18, FOOTER_Y);
  drawAt(page, text.footer, footer, PAGE_WIDTH - INNER_RULE - 18 - widthOf(text.footer, footer), FOOTER_Y);

  return document.save();
}
