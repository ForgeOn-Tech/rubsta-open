// @vitest-environment node
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { loadCertificateArtwork } from "@/lib/certificate-artwork";
import { UnprintableTextError, certificatePdf } from "@/lib/certificate-pdf";
import { CERTIFICATE_KINDS, type CertificateText } from "@/lib/certificates";

const TEXT: CertificateText = {
  kind: "winner",
  title: "Winner's certificate",
  lead: "This certifies that",
  name: "Gaurav Pillai",
  statement: "won the Open singles at Rubsta Open 2026",
  detail: "24–25 Oct 2026 · Nerul Gymkhana, Navi Mumbai",
  seal: "Winner",
  number: "FL-2026-0117-OS-W",
  footer: "Powered by ForgeLabs",
};

describe("certificatePdf", () => {
  it("makes a one-page PDF titled after the certificate, for every kind", async () => {
    const artwork = await loadCertificateArtwork();
    for (const kind of CERTIFICATE_KINDS) {
      const bytes = await certificatePdf({ ...TEXT, kind }, artwork);

      expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
      const document = await PDFDocument.load(bytes);
      expect(document.getPageCount()).toBe(1);
      expect(document.getTitle()).toBe("Winner's certificate");
    }
  });

  it("fits a very long name and statement and leaves out a missing detail line and number", async () => {
    const bytes = await certificatePdf(
      { ...TEXT, name: "Gaurav ".repeat(20).trim(), statement: "won ".repeat(60).trim(), detail: null, number: null },
      await loadCertificateArtwork(),
    );

    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  });

  it("prints a signature image when one is supplied", async () => {
    const artwork = await loadCertificateArtwork();
    const without = await certificatePdf(TEXT, { ...artwork, signature: null });
    const withSignature = await certificatePdf(TEXT, { ...artwork, signature: artwork.partnerLogos[0].png });

    expect(withSignature.length).toBeGreaterThan(without.length);
  });

  it("refuses a name the fonts cannot print", async () => {
    await expect(certificatePdf({ ...TEXT, name: "गौरव पिल्लई" }, await loadCertificateArtwork())).rejects.toThrow(UnprintableTextError);
  });
});
