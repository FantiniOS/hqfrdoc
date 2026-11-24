import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { formatBRL, formatDateBR } from "@/lib/format";
import { formatSetupInstallmentsLabel } from "@/lib/contract";

export interface PdfContractRecord {
  id: string;
  token: string;
  status: string;
  contentSnapshot: string;
  documentHash: string;
  planSnapshot: string;
  monthlyFeeSnapshot: number;
  setupFeeSnapshot: number;
  setupInstallments: number;
  isFounderSnapshot: boolean;
  dueDaySnapshot: number;
  infraSnapshot: string;
  penaltyPctSnapshot: number;
  courtSnapshot: string;
  clinicLegalNameSnapshot: string | null;
  clinicCnpjSnapshot: string | null;
  clinicSubdomainSnapshot: string | null;
  hqLegalNameSnapshot: string | null;
  hqCnpjSnapshot: string | null;
  fidelityMonths: number;
  startDate: Date | string;
  endDate: Date | string;
  signedAt: Date | string | null;
  signerName: string | null;
  signerCpf: string | null;
  signerIp: string | null;
  signerUserAgent: string | null;
  signatureDataUrl: string | null;
  createdAt: Date | string;
}

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const MARGIN_X = 50;
const MARGIN_TOP = 64;
const MARGIN_BOTTOM = 58;
const CONTENT_WIDTH = A4_WIDTH - MARGIN_X * 2;

const COLOR_SLATE_900 = rgb(0.059, 0.09, 0.165); // #0F172A
const COLOR_SLATE_700 = rgb(0.204, 0.255, 0.333); // #334155
const COLOR_SLATE_500 = rgb(0.392, 0.455, 0.545); // #64748B
const COLOR_BORDER = rgb(0.886, 0.91, 0.941); // #E2E8F0
const COLOR_BG_SOFT = rgb(0.973, 0.98, 0.988); // #F8FAFC
const COLOR_EMERALD = rgb(0.02, 0.588, 0.412); // #059669
const COLOR_EMERALD_BG = rgb(0.925, 0.992, 0.961); // #ECFDF5

/**
 * Sanitiza caracteres fora do WinAnsi para evitar falha de codificação na StandardFont.
 */
function sanitizeWinAnsi(text: string): string {
  return text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2026/g, "...")
    .replace(/\u00A0/g, " ")
    // Mantém tabela ISO-8859-1 / Windows-1252 comum (incluindo —, –, •, º, ª, §, acentos pt-BR)
    .replace(/[^\x20-\x7E\xA0-\xFF•—–]/g, "");
}

function wrapLines(
  text: string,
  font: PDFFont,
  fontSize: number,
  maxWidth: number
): string[] {
  const clean = sanitizeWinAnsi(text.trim());
  if (!clean) return [""];

  const words = clean.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      // Palavra muito longa (ex.: hash ou URL)
      if (font.widthOfTextAtSize(word, fontSize) > maxWidth) {
        let chunk = "";
        for (const ch of word) {
          if (font.widthOfTextAtSize(chunk + ch, fontSize) <= maxWidth) {
            chunk += ch;
          } else {
            if (chunk) lines.push(chunk);
            chunk = ch;
          }
        }
        current = chunk;
      } else {
        current = word;
      }
    }
  }
  if (current) lines.push(current);
  return lines;
}

function formatDateTimeSignBR(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(d);
}

export async function generateContractPdfBytes(
  contract: PdfContractRecord
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(
    sanitizeWinAnsi(
      `Contrato FRdoc 2.0 - ${contract.clinicLegalNameSnapshot || "Clinica"}`
    )
  );
  pdfDoc.setProducer("FRdoc HQ Native Contract Engine");
  pdfDoc.setCreator("FRdoc HQ");

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontMono = await pdfDoc.embedFont(StandardFonts.Courier);

  const refCode = `FRDOC-${contract.id.slice(-6).toUpperCase()}`;

  const addNewPage = (): { page: PDFPage; y: number } => {
    const page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);

    // Cabeçalho discreto FRdoc 2.0
    page.drawText("FRdoc 2.0", {
      x: MARGIN_X,
      y: A4_HEIGHT - 36,
      size: 10,
      font: fontBold,
      color: COLOR_EMERALD,
    });
    page.drawText("  |  Instrumento Contratual SaaS & Infraestrutura Dedicada", {
      x: MARGIN_X + fontBold.widthOfTextAtSize("FRdoc 2.0", 10),
      y: A4_HEIGHT - 36,
      size: 8.5,
      font: fontRegular,
      color: COLOR_SLATE_500,
    });

    const rightHeader = sanitizeWinAnsi(`REF: ${refCode}`);
    page.drawText(rightHeader, {
      x: A4_WIDTH - MARGIN_X - fontMono.widthOfTextAtSize(rightHeader, 8.5),
      y: A4_HEIGHT - 36,
      size: 8.5,
      font: fontMono,
      color: COLOR_SLATE_500,
    });

    page.drawLine({
      start: { x: MARGIN_X, y: A4_HEIGHT - 44 },
      end: { x: A4_WIDTH - MARGIN_X, y: A4_HEIGHT - 44 },
      thickness: 0.75,
      color: COLOR_BORDER,
    });

    return { page, y: A4_HEIGHT - MARGIN_TOP };
  };

  let { page, y } = addNewPage();

  const ensureSpace = (neededHeight: number) => {
    if (y - neededHeight < MARGIN_BOTTOM) {
      const next = addNewPage();
      page = next.page;
      y = next.y;
    }
  };

  // Divide o snapshot pelas quebras de página (Principal / Anexo I / Anexo II)
  const sections = contract.contentSnapshot.split("=== PAGE_BREAK ===");

  sections.forEach((rawSection, sectionIdx) => {
    if (sectionIdx > 0) {
      const next = addNewPage();
      page = next.page;
      y = next.y;
    }

    const lines = rawSection.trim().split("\n");

    // Tratamento especial de tabela executiva para Anexo I
    const isAnexoI = lines[0]?.trim().startsWith("ANEXO I");
    if (isAnexoI) {
      const titleLine = sanitizeWinAnsi(lines[0].trim());
      page.drawText(titleLine, {
        x: MARGIN_X,
        y,
        size: 12,
        font: fontBold,
        color: COLOR_SLATE_900,
      });
      y -= 24;

      const summaryRows: Array<[string, string]> = [
        [
          "Clinica Contratante",
          `${contract.clinicLegalNameSnapshot || "-"} (CNPJ ${contract.clinicCnpjSnapshot || "-"})`,
        ],
        [
          "Endereco de Acesso Dedicado",
          contract.clinicSubdomainSnapshot || "-",
        ],
        ["Faixa / Porte Contratado", contract.planSnapshot],
        [
          "Clinica Fundadora",
          contract.isFounderSnapshot
            ? "Sim (condicao especial aplicada)"
            : "Nao",
        ],
        ["Valor da Mensalidade", formatBRL(contract.monthlyFeeSnapshot)],
        [
          "Dia de Vencimento",
          `Todo dia ${String(contract.dueDaySnapshot).padStart(2, "0")} de cada mes`,
        ],
        [
          "Taxa de Implantacao (Setup)",
          `${formatBRL(contract.setupFeeSnapshot)} (${formatSetupInstallmentsLabel(
            contract.setupFeeSnapshot,
            contract.setupInstallments
          )})`,
        ],
        [
          "Prazo de Fidelidade",
          `${contract.fidelityMonths} meses (${formatDateBR(
            contract.startDate
          )} a ${formatDateBR(contract.endDate)})`,
        ],
        [
          "Multa por Rescisao Antecipada",
          `${contract.penaltyPctSnapshot}% sobre as mensalidades restantes`,
        ],
        [
          "Infraestrutura Alocada",
          `Servidor Dedicado Isolado (${contract.infraSnapshot})`,
        ],
      ];

      const col1Width = 175;
      const col2Width = CONTENT_WIDTH - col1Width;

      summaryRows.forEach(([label, val], idx) => {
        const valLines = wrapLines(val, fontRegular, 9.5, col2Width - 20);
        const rowHeight = Math.max(26, valLines.length * 13 + 12);
        ensureSpace(rowHeight + 4);

        if (idx % 2 === 0) {
          page.drawRectangle({
            x: MARGIN_X,
            y: y - rowHeight,
            width: CONTENT_WIDTH,
            height: rowHeight,
            color: COLOR_BG_SOFT,
          });
        }

        page.drawRectangle({
          x: MARGIN_X,
          y: y - rowHeight,
          width: CONTENT_WIDTH,
          height: rowHeight,
          borderColor: COLOR_BORDER,
          borderWidth: 0.6,
        });

        page.drawLine({
          start: { x: MARGIN_X + col1Width, y },
          end: { x: MARGIN_X + col1Width, y: y - rowHeight },
          thickness: 0.6,
          color: COLOR_BORDER,
        });

        page.drawText(sanitizeWinAnsi(label), {
          x: MARGIN_X + 10,
          y: y - 16,
          size: 9,
          font: fontBold,
          color: COLOR_SLATE_700,
        });

        valLines.forEach((vLine, lIdx) => {
          page.drawText(vLine, {
            x: MARGIN_X + col1Width + 10,
            y: y - 16 - lIdx * 13,
            size: 9.5,
            font: fontRegular,
            color: COLOR_SLATE_900,
          });
        });

        y -= rowHeight;
      });

      y -= 18;
      const noteLines = wrapLines(
        "Este Quadro Resumo Comercial integra o Contrato de Licenciamento de Uso de Software (SaaS) FRdoc 2.0 para todos os fins de direito, prevalecendo os valores e condições comerciais nele descritos.",
        fontRegular,
        9,
        CONTENT_WIDTH
      );
      for (const nl of noteLines) {
        page.drawText(nl, {
          x: MARGIN_X,
          y,
          size: 9,
          font: fontRegular,
          color: COLOR_SLATE_500,
        });
        y -= 13;
      }
      return;
    }

    for (const rawLine of lines) {
      const trimmed = rawLine.trim();
      if (!trimmed) {
        y -= 7;
        continue;
      }

      const isDocTitle = trimmed.startsWith("CONTRATO DE LICENCIAMENTO") || trimmed.startsWith("ANEXO II");
      const isClauseHeader = trimmed.startsWith("CLÁUSULA ") || trimmed.startsWith("CLAUSULA ");

      if (isDocTitle) {
        const wrapped = wrapLines(trimmed, fontBold, 11, CONTENT_WIDTH);
        ensureSpace(wrapped.length * 15 + 10);
        for (const w of wrapped) {
          page.drawText(w, {
            x: MARGIN_X,
            y,
            size: 11,
            font: fontBold,
            color: COLOR_SLATE_900,
          });
          y -= 15;
        }
        y -= 6;
      } else if (isClauseHeader) {
        y -= 4;
        const wrapped = wrapLines(trimmed, fontBold, 9.8, CONTENT_WIDTH);
        ensureSpace(wrapped.length * 14 + 20);
        for (const w of wrapped) {
          page.drawText(w, {
            x: MARGIN_X,
            y,
            size: 9.8,
            font: fontBold,
            color: COLOR_SLATE_900,
          });
          y -= 14;
        }
        y -= 2;
      } else {
        const isPartyLine =
          trimmed.startsWith("CONTRATADA:") || trimmed.startsWith("CONTRATANTE:");
        const usedFont = isPartyLine ? fontBold : fontRegular;
        const wrapped = wrapLines(trimmed, usedFont, 9.5, CONTENT_WIDTH);
        ensureSpace(wrapped.length * 13.5 + 4);
        for (const w of wrapped) {
          page.drawText(w, {
            x: MARGIN_X,
            y,
            size: 9.5,
            font: isPartyLine ? fontRegular : fontRegular,
            color: COLOR_SLATE_700,
          });
          y -= 13.5;
        }
        y -= 2;
      }
    }

    // No final do Contrato Principal, desenha campos de assinatura das partes
    if (sectionIdx === 0) {
      ensureSpace(95);
      y -= 28;
      const colW = (CONTENT_WIDTH - 40) / 2;

      page.drawLine({
        start: { x: MARGIN_X, y },
        end: { x: MARGIN_X + colW, y },
        thickness: 0.75,
        color: COLOR_SLATE_500,
      });
      page.drawLine({
        start: { x: MARGIN_X + colW + 40, y },
        end: { x: MARGIN_X + CONTENT_WIDTH, y },
        thickness: 0.75,
        color: COLOR_SLATE_500,
      });

      page.drawText("CONTRATADA", {
        x: MARGIN_X,
        y: y - 13,
        size: 8.5,
        font: fontBold,
        color: COLOR_SLATE_900,
      });
      page.drawText(
        sanitizeWinAnsi(contract.hqLegalNameSnapshot || "FRdoc").slice(0, 42),
        {
          x: MARGIN_X,
          y: y - 24,
          size: 8,
          font: fontRegular,
          color: COLOR_SLATE_500,
        }
      );

      page.drawText("CONTRATANTE", {
        x: MARGIN_X + colW + 40,
        y: y - 13,
        size: 8.5,
        font: fontBold,
        color: COLOR_SLATE_900,
      });
      page.drawText(
        sanitizeWinAnsi(contract.clinicLegalNameSnapshot || "Clinica").slice(0, 42),
        {
          x: MARGIN_X + colW + 40,
          y: y - 24,
          size: 8,
          font: fontRegular,
          color: COLOR_SLATE_500,
        }
      );
      y -= 40;
    }
  });

  // Página Final: Certificado de Assinatura Eletrônica (Lei nº 14.063/2020) quando ASSINADO
  if (contract.status === "SIGNED" && contract.signedAt) {
    const certPageSetup = addNewPage();
    const certPage = certPageSetup.page;
    let cy = certPageSetup.y;

    // Banner Verde Sóbrio
    certPage.drawRectangle({
      x: MARGIN_X,
      y: cy - 48,
      width: CONTENT_WIDTH,
      height: 48,
      color: COLOR_EMERALD_BG,
      borderColor: COLOR_EMERALD,
      borderWidth: 1,
    });

    certPage.drawText(
      "CERTIFICADO DE ASSINATURA ELETRONICA (LEI No 14.063/2020)",
      {
        x: MARGIN_X + 14,
        y: cy - 20,
        size: 11,
        font: fontBold,
        color: COLOR_EMERALD,
      }
    );
    certPage.drawText(
      "Documento assinado eletronicamente com validade juridica nos termos da MP 2.200-2/2001 e Lei 14.063/2020.",
      {
        x: MARGIN_X + 14,
        y: cy - 35,
        size: 8.5,
        font: fontRegular,
        color: COLOR_SLATE_700,
      }
    );

    cy -= 70;

    const auditItems: Array<[string, string]> = [
      ["Codigo de Referencia", refCode],
      ["Token de Verificacao", contract.token],
      ["Contratada", `${contract.hqLegalNameSnapshot || "-"} (CNPJ ${contract.hqCnpjSnapshot || "-"})`],
      ["Contratante", `${contract.clinicLegalNameSnapshot || "-"} (CNPJ ${contract.clinicCnpjSnapshot || "-"})`],
      ["Signatario (Representante)", contract.signerName || "-"],
      ["CPF do Signatario", contract.signerCpf || "-"],
      [
        "Data e Hora da Assinatura",
        `${formatDateTimeSignBR(contract.signedAt)} (Horario Oficial de Brasilia)`,
      ],
      [
        "Registro UTC (ISO 8601)",
        (typeof contract.signedAt === "string"
          ? new Date(contract.signedAt)
          : contract.signedAt
        ).toISOString(),
      ],
      ["Endereco IP de Origem", contract.signerIp || "-"],
      ["Navegador / Dispositivo", contract.signerUserAgent || "-"],
    ];

    for (const [k, val] of auditItems) {
      const wrappedVal = wrapLines(val, fontRegular, 9, CONTENT_WIDTH - 155);
      const itemH = Math.max(20, wrappedVal.length * 12 + 8);

      certPage.drawLine({
        start: { x: MARGIN_X, y: cy - itemH },
        end: { x: A4_WIDTH - MARGIN_X, y: cy - itemH },
        thickness: 0.5,
        color: COLOR_BORDER,
      });

      certPage.drawText(sanitizeWinAnsi(k), {
        x: MARGIN_X,
        y: cy - 13,
        size: 8.8,
        font: fontBold,
        color: COLOR_SLATE_700,
      });

      wrappedVal.forEach((line, idx) => {
        certPage.drawText(line, {
          x: MARGIN_X + 150,
          y: cy - 13 - idx * 12,
          size: 9,
          font: k.includes("Token") || k.includes("UTC") || k.includes("IP") ? fontMono : fontRegular,
          color: COLOR_SLATE_900,
        });
      });

      cy -= itemH;
    }

    // Bloco do Hash SHA-256
    cy -= 18;
    certPage.drawRectangle({
      x: MARGIN_X,
      y: cy - 48,
      width: CONTENT_WIDTH,
      height: 48,
      color: COLOR_BG_SOFT,
      borderColor: COLOR_BORDER,
      borderWidth: 0.8,
    });
    certPage.drawText("HASH CRIPTOGRAFICO SHA-256 DO CONTEUDO CONGELADO:", {
      x: MARGIN_X + 12,
      y: cy - 17,
      size: 8,
      font: fontBold,
      color: COLOR_SLATE_500,
    });
    certPage.drawText(contract.documentHash, {
      x: MARGIN_X + 12,
      y: cy - 33,
      size: 8.8,
      font: fontMono,
      color: COLOR_SLATE_900,
    });

    cy -= 70;

    // Rubrica / Assinatura Manuscrita em Canvas (se presente)
    certPage.drawText("REGISTRO GRAFICO DA ASSINATURA / ACEITE EXPRESSO:", {
      x: MARGIN_X,
      y: cy,
      size: 8.5,
      font: fontBold,
      color: COLOR_SLATE_700,
    });
    cy -= 10;

    certPage.drawRectangle({
      x: MARGIN_X,
      y: cy - 105,
      width: 280,
      height: 100,
      color: rgb(1, 1, 1),
      borderColor: COLOR_BORDER,
      borderWidth: 0.8,
    });

    if (
      contract.signatureDataUrl &&
      contract.signatureDataUrl.startsWith("data:image/png;base64,")
    ) {
      try {
        const base64 = contract.signatureDataUrl.replace(
          /^data:image\/png;base64,/,
          ""
        );
        const pngBytes = Buffer.from(base64, "base64");
        const pngImage = await pdfDoc.embedPng(pngBytes);
        const dims = pngImage.scaleToFit(256, 78);
        certPage.drawImage(pngImage, {
          x: MARGIN_X + (280 - dims.width) / 2,
          y: cy - 95 + (80 - dims.height) / 2,
          width: dims.width,
          height: dims.height,
        });
      } catch {
        certPage.drawText("Aceite eletronico validado via token criptografico", {
          x: MARGIN_X + 16,
          y: cy - 55,
          size: 8.5,
          font: fontRegular,
          color: COLOR_SLATE_500,
        });
      }
    } else {
      certPage.drawText("Aceite eletronico expresso registrado com sucesso.", {
        x: MARGIN_X + 16,
        y: cy - 55,
        size: 9,
        font: fontBold,
        color: COLOR_EMERALD,
      });
    }

    certPage.drawText(
      sanitizeWinAnsi(`${contract.signerName || ""} — CPF ${contract.signerCpf || ""}`),
      {
        x: MARGIN_X,
        y: cy - 118,
        size: 8.5,
        font: fontBold,
        color: COLOR_SLATE_900,
      }
    );
  }

  // Numeração de páginas e rodapé de integridade em TODAS as páginas
  const pages = pdfDoc.getPages();
  const totalPages = pages.length;
  pages.forEach((p, idx) => {
    p.drawLine({
      start: { x: MARGIN_X, y: 38 },
      end: { x: A4_WIDTH - MARGIN_X, y: 38 },
      thickness: 0.5,
      color: COLOR_BORDER,
    });

    const hashShort = `SHA-256: ${contract.documentHash.slice(0, 24)}...`;
    p.drawText(hashShort, {
      x: MARGIN_X,
      y: 25,
      size: 7.5,
      font: fontMono,
      color: COLOR_SLATE_500,
    });

    const pageLabel = `Pagina ${idx + 1} de ${totalPages}`;
    p.drawText(pageLabel, {
      x: A4_WIDTH - MARGIN_X - fontRegular.widthOfTextAtSize(pageLabel, 8),
      y: 25,
      size: 8,
      font: fontRegular,
      color: COLOR_SLATE_500,
    });
  });

  return pdfDoc.save();
}
