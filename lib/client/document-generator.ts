import {
  Document,
  HorizontalPositionRelativeFrom,
  ImageRun,
  Packer,
  Paragraph,
  SectionType,
  VerticalPositionRelativeFrom,
} from "docx";

import type { ConsentSourceData } from "@/lib/contracts";

const PAGE_WIDTH = 1489;
const PAGE_HEIGHT = 2106;
const CROPPED_FORM_HEIGHT = 520;
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const SOURCES = {
  liability: [
    "/documents/haftung/page-1.png",
    "/documents/haftung/page-2.png",
    "/documents/haftung/page-3.png",
  ],
  consent: [
    "/documents/einwilligung/page-1.png",
    "/documents/einwilligung/page-2.png",
  ],
} as const;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("de-AT").format(new Date(`${value}T12:00:00`));
}

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Document page could not be loaded"));
    image.src = source;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Document page could not be rendered")), "image/png");
  });
}

function drawField(context: CanvasRenderingContext2D, x: number, y: number, value: string) {
  context.save();
  context.font = "500 22px Arial, sans-serif";
  context.textBaseline = "top";
  const width = context.measureText(value).width;
  context.fillStyle = "rgba(255,255,255,.97)";
  context.fillRect(x - 3, y - 2, width + 7, 28);
  context.fillStyle = "#111820";
  context.fillText(value, x, y);
  context.restore();
}

function drawContainedImage(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  context.drawImage(image, x, y + (height - drawHeight) / 2, drawWidth, drawHeight);
}

function drawWrappedText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  let line = "";
  let cursorY = y;
  for (const word of text.split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word;
    if (context.measureText(candidate).width > maxWidth && line) {
      context.fillText(line, x, cursorY);
      line = word;
      cursorY += lineHeight;
    } else {
      line = candidate;
    }
  }
  if (line) context.fillText(line, x, cursorY);
  return cursorY + lineHeight;
}

async function renderNoConsentDecision(data: ConsentSourceData, signature: HTMLImageElement) {
  const canvas = document.createElement("canvas");
  canvas.width = PAGE_WIDTH;
  canvas.height = PAGE_HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is unavailable");

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
  const left = 165;
  const width = PAGE_WIDTH - left * 2;

  context.fillStyle = "#111820";
  context.textBaseline = "top";
  context.font = "700 30px Arial, sans-serif";
  context.fillText("FREQUENCY FESTIVAL 2026 · GEH MA STEIL!", left, 170);
  context.font = "700 58px Arial, sans-serif";
  let y = drawWrappedText(
    context,
    "Nachweis: Keine Foto- und Videoeinwilligung",
    left,
    245,
    width,
    70,
  );

  context.fillStyle = "#5f6872";
  context.font = "400 25px Arial, sans-serif";
  y = drawWrappedText(
    context,
    "Entscheidung zur Aufnahme, Verarbeitung und kommerziellen Nutzung erkennbarer Foto- und Videoaufnahmen",
    left,
    y + 10,
    width,
    38,
  );

  context.strokeStyle = "#cfd5d9";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(left, y + 35);
  context.lineTo(left + width, y + 35);
  context.stroke();

  context.fillStyle = "#111820";
  context.font = "700 31px Arial, sans-serif";
  context.fillText("Keine Einwilligung erteilt", left, y + 85);
  context.font = "400 27px Arial, sans-serif";
  y = drawWrappedText(
    context,
    "Die unten genannte Person hat keine Einwilligung zur Aufnahme, Veröffentlichung oder kommerziellen Nutzung von Foto- oder Videoaufnahmen erteilt, auf denen sie erkennbar ist. Die Teilnahme an der Aktivität bleibt davon unberührt.",
    left,
    y + 140,
    width,
    42,
  );

  context.font = "700 26px Arial, sans-serif";
  context.fillText("Wichtig", left, y + 35);
  context.font = "400 25px Arial, sans-serif";
  y = drawWrappedText(
    context,
    "Dieses Dokument ist keine Einwilligung. Es hält ausschließlich die freiwillige Auswahl „Nein“ fest, damit keine Nutzung auf Grundlage einer Foto-/Videoeinwilligung erfolgt.",
    left,
    y + 78,
    width,
    39,
  );

  const fieldY = y + 95;
  context.font = "700 25px Arial, sans-serif";
  context.fillText("Vor- und Nachname", left, fieldY);
  context.fillText("Geburtsdatum", left, fieldY + 100);
  context.fillText("Datum", left, fieldY + 200);
  context.fillText("Unterschrift", left, fieldY + 330);

  context.font = "400 27px Arial, sans-serif";
  context.fillText(data.fullName, left + 300, fieldY - 2);
  context.fillText(formatDate(data.birthDate), left + 300, fieldY + 98);
  context.fillText(formatDate(data.signedDate), left + 300, fieldY + 198);

  context.strokeStyle = "#8e969d";
  context.lineWidth = 2;
  for (const offset of [40, 140, 240]) {
    context.beginPath();
    context.moveTo(left + 300, fieldY + offset);
    context.lineTo(left + width, fieldY + offset);
    context.stroke();
  }
  context.beginPath();
  context.moveTo(left + 300, fieldY + 430);
  context.lineTo(left + width, fieldY + 430);
  context.stroke();
  drawContainedImage(context, signature, left + 300, fieldY + 285, 520, 140);

  context.fillStyle = "#5f6872";
  context.font = "400 23px Arial, sans-serif";
  drawWrappedText(
    context,
    `Datenschutzinformation: Version ${data.privacyNoticeVersion}. Die Auswahl und Unterzeichnung werden zur Teilnahmeabwicklung und beweissicheren Nachweisführung dokumentiert.`,
    left,
    fieldY + 510,
    width,
    35,
  );

  return canvasToBlob(canvas);
}

async function renderPage(
  source: string,
  decorate?: (context: CanvasRenderingContext2D) => Promise<void> | void,
) {
  const image = await loadImage(source);
  const canvas = document.createElement("canvas");
  canvas.width = PAGE_WIDTH;
  canvas.height = PAGE_HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is unavailable");
  context.fillStyle = "white";
  context.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
  context.drawImage(image, 0, 0, PAGE_WIDTH, PAGE_HEIGHT);
  await decorate?.(context);
  return canvasToBlob(canvas);
}

async function makeDocx(pageBlobs: Blob[]) {
  const images = await Promise.all(pageBlobs.map(async (blob) => new Uint8Array(await blob.arrayBuffer())));
  const file = new Document({
    sections: images.map((image, index) => ({
      properties: {
        type: index === 0 ? undefined : SectionType.NEXT_PAGE,
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 0, right: 0, bottom: 0, left: 0, header: 0, footer: 0, gutter: 0 },
        },
      },
      children: [
        new Paragraph({
          spacing: { before: 0, after: 0 },
          children: [
            new ImageRun({
              type: "png",
              data: image,
              transformation: { width: 794, height: 1123 },
              floating: {
                horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, offset: 0 },
                verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, offset: 0 },
                behindDocument: true,
                allowOverlap: true,
              },
            }),
          ],
        }),
      ],
    })),
  });
  const blob = await Packer.toBlob(file);
  return new Blob([blob], { type: DOCX_MIME });
}

export async function sha256Blob(blob: Blob) {
  const hash = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function generateConsentDocuments(data: ConsentSourceData) {
  const signature = await loadImage(data.signatureDataUrl);
  const liabilityPages = await Promise.all(
    SOURCES.liability.map((source, index) => renderPage(source, index === 0 ? (context) => {
      context.save();
      context.font = "800 28px Arial, sans-serif";
      context.textBaseline = "top";
      context.fillStyle = "#111820";
      context.fillText("✓", PAGE_WIDTH * .118, PAGE_HEIGHT * (data.photoChoice === "yes" ? .629 : .670));
      context.restore();
      drawField(context, PAGE_WIDTH * .317, PAGE_HEIGHT * .798, data.fullName);
      drawField(context, PAGE_WIDTH * .234, PAGE_HEIGHT * .825, formatDate(data.birthDate));
      drawField(context, PAGE_WIDTH * .782, PAGE_HEIGHT * .798, formatDate(data.signedDate));
      drawContainedImage(
        context,
        signature,
        PAGE_WIDTH * .634,
        PAGE_HEIGHT * .795,
        PAGE_WIDTH * .24,
        PAGE_HEIGHT * .055,
      );
    } : undefined)),
  );

  const consentPages = data.photoChoice === "yes"
    ? await Promise.all(
        SOURCES.consent.map((source, index) => renderPage(source, index === 1 ? (context) => {
          drawField(context, PAGE_WIDTH * .338, CROPPED_FORM_HEIGHT * .355, data.fullName);
          drawField(context, PAGE_WIDTH * .237, CROPPED_FORM_HEIGHT * .422, formatDate(data.birthDate));
          drawField(context, PAGE_WIDTH * .178, CROPPED_FORM_HEIGHT * .483, formatDate(data.signedDate));
          drawContainedImage(
            context,
            signature,
            PAGE_WIDTH * .48,
            CROPPED_FORM_HEIGHT * .36,
            PAGE_WIDTH * .29,
            CROPPED_FORM_HEIGHT * .20,
          );
        } : undefined)),
      )
    : [await renderNoConsentDecision(data, signature)];

  const [haftungDocx, einwilligungDocx] = await Promise.all([
    makeDocx(liabilityPages),
    makeDocx(consentPages),
  ]);
  const [haftungSha256, einwilligungSha256] = await Promise.all([
    sha256Blob(haftungDocx),
    sha256Blob(einwilligungDocx),
  ]);
  return { haftungDocx, einwilligungDocx, haftungSha256, einwilligungSha256 };
}
