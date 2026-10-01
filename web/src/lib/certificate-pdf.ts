import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

import type { CertificateText } from "@/lib/certificates";

/** The certificate fonts can print only Latin letters and common punctuation. */
export class UnprintableTextError extends Error {
  constructor(cause: unknown) {
    super("The certificate font cannot print some characters in this certificate.", { cause });
    this.name = "UnprintableTextError";
  }
}

// A4 landscape, in points.
const PAGE_WIDTH = 841.89;
const PAGE_HEIGHT = 595.28;
const OUTER_MARGIN = 24;
const INNER_MARGIN = 34;
const TEXT_MARGIN = 90;
const NAME_SIZE = 46;
const RULE_HALF_WIDTH = 210;

// Club theme colours from globals.css.
const CREAM = rgb(0.973, 0.961, 0.922);
const FOREST = rgb(0.161, 0.31, 0.208);
const INK = rgb(0.125, 0.239, 0.165);
const MUTED = rgb(0.365, 0.412, 0.337);

function widthOf(font: PDFFont, text: string, size: number): number {
  try {
    return font.widthOfTextAtSize(text, size);
  } catch (error) {
    throw new UnprintableTextError(error);
  }
}

function drawCentred(
  page: PDFPage,
  text: string,
  style: { font: PDFFont; size: number; y: number; color: ReturnType<typeof rgb> },
): void {
  const width = widthOf(style.font, text, style.size);
  page.drawText(text, {
    x: (PAGE_WIDTH - width) / 2,
    y: style.y,
    size: style.size,
    font: style.font,
    color: style.color,
  });
}

/** A one-page A4 certificate. Throws UnprintableTextError for text the fonts cannot print. */
export async function certificatePdf(text: CertificateText): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  document.setTitle(text.title);
  document.setAuthor("Rubsta Open");
  const page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const serif = await document.embedFont(StandardFonts.TimesRoman);
  const serifItalic = await document.embedFont(StandardFonts.TimesRomanItalic);
  const sans = await document.embedFont(StandardFonts.Helvetica);

  page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, color: CREAM });
  page.drawRectangle({
    x: OUTER_MARGIN,
    y: OUTER_MARGIN,
    width: PAGE_WIDTH - 2 * OUTER_MARGIN,
    height: PAGE_HEIGHT - 2 * OUTER_MARGIN,
    borderColor: FOREST,
    borderWidth: 2,
  });
  page.drawRectangle({
    x: INNER_MARGIN,
    y: INNER_MARGIN,
    width: PAGE_WIDTH - 2 * INNER_MARGIN,
    height: PAGE_HEIGHT - 2 * INNER_MARGIN,
    borderColor: FOREST,
    borderWidth: 0.75,
  });

  drawCentred(page, "RUBSTA OPEN", { font: sans, size: 11, y: 500, color: MUTED });
  drawCentred(page, text.title, { font: serif, size: 40, y: 432, color: INK });
  drawCentred(page, text.lead, { font: sans, size: 13, y: 378, color: MUTED });

  // A long name shrinks to fit between the margins.
  const nameWidth = widthOf(serifItalic, text.name, NAME_SIZE);
  const nameSize = Math.min(NAME_SIZE, (NAME_SIZE * (PAGE_WIDTH - 2 * TEXT_MARGIN)) / nameWidth);
  drawCentred(page, text.name, { font: serifItalic, size: nameSize, y: 318, color: INK });
  page.drawLine({
    start: { x: PAGE_WIDTH / 2 - RULE_HALF_WIDTH, y: 302 },
    end: { x: PAGE_WIDTH / 2 + RULE_HALF_WIDTH, y: 302 },
    thickness: 0.75,
    color: FOREST,
  });

  drawCentred(page, text.statement, { font: sans, size: 15, y: 262, color: INK });
  if (text.detail !== null) drawCentred(page, text.detail, { font: sans, size: 12, y: 238, color: MUTED });
  drawCentred(page, text.footer, { font: sans, size: 10, y: 66, color: MUTED });

  return document.save();
}
