// @vitest-environment node
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { UnprintableTextError, certificatePdf } from "@/lib/certificate-pdf";
import type { CertificateText } from "@/lib/certificates";

const TEXT: CertificateText = {
  title: "Winner's certificate",
  lead: "This certifies that",
  name: "Gaurav Pillai",
  statement: "won the men's singles at Rubsta Open 2026",
  detail: "25–27 Sept 2026 · Deccan Gymkhana, Pune",
  footer: "Player ID FL-2026-0117 · Powered by ForgeLabs",
};

describe("certificatePdf", () => {
  it("makes a one-page PDF titled after the certificate", async () => {
    const bytes = await certificatePdf(TEXT);

    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    const document = await PDFDocument.load(bytes);
    expect(document.getPageCount()).toBe(1);
    expect(document.getTitle()).toBe("Winner's certificate");
  });

  it("fits a very long name and leaves out a missing detail line", async () => {
    const bytes = await certificatePdf({ ...TEXT, name: "Gaurav ".repeat(20).trim(), detail: null });

    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  });

  it("refuses a name the fonts cannot print", async () => {
    await expect(certificatePdf({ ...TEXT, name: "गौरव पिल्लई" })).rejects.toThrow(UnprintableTextError);
  });
});
