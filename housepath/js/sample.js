import { sampleCsv, uid } from "./logic.js";

export function buildPdf(title) {
  const safe = String(title).replace(/[()\\]/g, "");
  const stream = `BT /F1 18 Tf 72 720 Td (${safe}) Tj ET`;
  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n",
    `4 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`,
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
  ];
  let body = "%PDF-1.4\n";
  const offsets = [0];
  for (const object of objects) {
    offsets.push(body.length);
    body += object;
  }
  const startxref = body.length;
  let xref = `xref\n0 ${objects.length + 1}\n`;
  xref += "0000000000 65535 f \n";
  for (let index = 1; index < offsets.length; index += 1) {
    xref += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  xref += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${startxref}\n%%EOF`;
  const bytes = body + xref;
  for (let index = 1; index < offsets.length; index += 1) {
    if (!bytes.startsWith(`${index} 0 obj`, offsets[index])) {
      throw new Error("The example plan file is invalid.");
    }
  }
  return bytes;
}

function drawPlan() {
  if (typeof document === "undefined") return Promise.resolve(null);
  const canvas = document.createElement("canvas");
  canvas.width = 920;
  canvas.height = 640;
  const context = canvas.getContext("2d");
  if (!context) return Promise.resolve(null);
  context.fillStyle = "#f7f4ee";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "#1d5c40";
  context.fillStyle = "#221e18";
  context.lineWidth = 2;
  context.font = "22px Georgia, serif";
  const rooms = [
    [48, 56, 400, 280, "Living"],
    [448, 56, 420, 160, "Kitchen"],
    [448, 216, 200, 120, "Bath"],
    [648, 216, 220, 120, "Entry"],
    [48, 336, 270, 240, "Bedroom"],
    [318, 336, 270, 240, "Bedroom"],
    [588, 336, 280, 240, "First-floor bedroom"],
  ];
  for (const [x, y, width, height, label] of rooms) {
    context.strokeRect(x, y, width, height);
    context.fillText(label, x + 16, y + 36);
  }
  context.font = "16px Georgia, serif";
  context.fillStyle = "#5c564c";
  context.fillText("Maple Street example. Not a real plan.", 48, 36);
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png"));
}

export async function sampleFiles() {
  const addedAt = "2026-04-02T15:00:00.000Z";
  const sheet = new Blob([sampleCsv()], { type: "text/csv" });
  const pdfBytes = buildPdf("Maple Street example. Not a real plan.");
  const pdf = new Blob([pdfBytes], { type: "application/pdf" });
  const files = [
    {
      id: uid(),
      stepId: "plans",
      kind: "plan",
      name: "maple-street-plan.pdf",
      type: "application/pdf",
      size: pdf.size,
      addedAt,
      blob: pdf,
    },
    {
      id: uid(),
      stepId: "sheet",
      kind: "build-sheet",
      name: "maple-street-build-sheet.csv",
      type: "text/csv",
      size: sheet.size,
      addedAt,
      blob: sheet,
    },
  ];
  const picture = await drawPlan();
  if (picture) {
    files.unshift({
      id: uid(),
      stepId: "plans",
      kind: "plan",
      name: "maple-street-rooms.png",
      type: "image/png",
      size: picture.size,
      addedAt,
      blob: picture,
    });
  }
  return files;
}
