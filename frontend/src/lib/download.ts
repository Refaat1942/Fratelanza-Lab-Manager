import { api } from "./api";

function responseContentType(headers: Record<string, unknown>): string | null {
  const raw = headers["content-type"];
  if (typeof raw !== "string") return null;
  return raw.split(";")[0]?.trim() || null;
}

async function parseBlobError(blob: Blob): Promise<string> {
  try {
    const text = await blob.text();
    try {
      const json = JSON.parse(text) as { detail?: string | unknown };
      if (typeof json.detail === "string") return json.detail;
      if (Array.isArray(json.detail)) return json.detail.map((d) => String(d)).join(", ");
    } catch {
      /* not json */
    }
    return text.slice(0, 300) || "Request failed";
  } catch {
    return "Request failed";
  }
}

async function ensurePdfBlob(blob: Blob): Promise<Blob> {
  const buf = await blob.slice(0, 5).arrayBuffer();
  const sig = String.fromCharCode(...new Uint8Array(buf));
  if (!sig.startsWith("%PDF")) {
    throw new Error(await parseBlobError(blob));
  }
  if (blob.type === "application/pdf") return blob;
  return new Blob([await blob.arrayBuffer()], { type: "application/pdf" });
}

/** Fetch binary from API with correct MIME (fixes PDF showing as raw text in print preview). */
export async function fetchApiBlob(path: string, mimeType = "application/octet-stream"): Promise<Blob> {
  const response = await api.get(path, { responseType: "blob" });
  const contentType = responseContentType(response.headers as Record<string, unknown>) || mimeType;

  if (response.status >= 400) {
    const errBlob = response.data instanceof Blob ? response.data : new Blob([response.data]);
    throw new Error(await parseBlobError(errBlob));
  }

  let blob: Blob =
    response.data instanceof Blob ? response.data : new Blob([response.data], { type: contentType });

  if (blob.type !== contentType && contentType !== "application/octet-stream") {
    blob = new Blob([await blob.arrayBuffer()], { type: contentType });
  }

  if (contentType.includes("json")) {
    throw new Error(await parseBlobError(blob));
  }

  if (mimeType === "application/pdf" || contentType === "application/pdf") {
    return ensurePdfBlob(blob);
  }

  return blob;
}

export async function downloadApiFile(path: string, filename: string, mimeType?: string) {
  const blob = await fetchApiBlob(path, mimeType);
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

/** Open PDF in a new browser tab (native PDF viewer — best preview before print). */
export async function openPdfInNewTab(path: string): Promise<void> {
  const blob = await fetchApiBlob(path, "application/pdf");
  const url = window.URL.createObjectURL(blob);
  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (!opened) {
    window.URL.revokeObjectURL(url);
    throw new Error("Pop-up blocked — allow pop-ups for this site or use Download PDF");
  }
  setTimeout(() => window.URL.revokeObjectURL(url), 120_000);
}

function printBlobInIframe(blob: Blob): Promise<void> {
  const url = window.URL.createObjectURL(blob);
  return new Promise((resolve, reject) => {
    const iframe = document.createElement("iframe");
    iframe.title = "Print";
    iframe.style.cssText =
      "position:fixed;top:0;left:0;width:100%;height:100%;border:0;opacity:0;pointer-events:none;z-index:-1";
    iframe.src = url;

    const cleanup = () => {
      window.URL.revokeObjectURL(url);
      iframe.remove();
    };

    iframe.onload = () => {
      try {
        const win = iframe.contentWindow;
        if (!win) {
          cleanup();
          reject(new Error("Print frame unavailable"));
          return;
        }
        win.focus();
        win.print();
        win.onafterprint = () => {
          cleanup();
          resolve();
        };
        setTimeout(() => {
          cleanup();
          resolve();
        }, 60_000);
      } catch (err) {
        cleanup();
        reject(err);
      }
    };

    iframe.onerror = () => {
      cleanup();
      reject(new Error("Failed to load print document"));
    };

    document.body.appendChild(iframe);
  });
}

/** Open PDF and trigger the browser print dialog. */
export async function printApiFile(path: string, mimeType = "application/pdf"): Promise<void> {
  const blob = await fetchApiBlob(path, mimeType);

  if (mimeType === "application/pdf") {
    const pdfBlob = await ensurePdfBlob(blob);
    const url = window.URL.createObjectURL(pdfBlob);
    const win = window.open(url, "_blank", "noopener,noreferrer");
    if (win) {
      return new Promise((resolve) => {
        const done = () => {
          window.URL.revokeObjectURL(url);
          resolve();
        };
        win.addEventListener("load", () => {
          try {
            win.focus();
            win.print();
          } catch {
            /* built-in PDF viewer may restrict print(); user can print manually */
          }
          setTimeout(done, 2_000);
        });
        setTimeout(done, 15_000);
      });
    }
    await printBlobInIframe(pdfBlob);
    return;
  }

  await printBlobInIframe(blob);
}
