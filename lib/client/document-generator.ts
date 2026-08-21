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
      context.fillText("✓", PAGE_WIDTH * .118, PAGE_HEIGHT * .629);
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

  const consentPages = await Promise.all(
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
  );

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
