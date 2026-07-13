import { api } from "./api";

async function fetchApiBlob(path: string): Promise<Blob> {
  const response = await api.get(path, { responseType: "blob" });
  return new Blob([response.data]);
}

export async function downloadApiFile(path: string, filename: string) {
  const blob = await fetchApiBlob(path);
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

/** Open PDF in a hidden frame and trigger the browser print dialog (thermal printer). */
export async function printApiFile(path: string): Promise<void> {
  const blob = await fetchApiBlob(path);
  const url = window.URL.createObjectURL(blob);
  return new Promise((resolve, reject) => {
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "none";
    iframe.src = url;
    const cleanup = () => {
      window.URL.revokeObjectURL(url);
      iframe.remove();
    };
    iframe.onload = () => {
      try {
        const win = iframe.contentWindow;
        if (!win) {
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
        }, 60000);
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
