// utils.js
import fs from "fs/promises";
import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";

const execFileAsync = promisify(execFile);

export async function appendMessage(session, message) {
  if (!session?.folderPath) return;

  const logFile = path.join(session.folderPath, "chat.txt");
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${message}\n`;

  try {
    await fs.appendFile(logFile, line);
  } catch (err) {
    console.error("Erro ao salvar mensagem:", err);
  }
}
// Enfileirador
export async function enqueueJob(session, job) {
  // Se já existe fila, encadeia o novo job
  session.queue = session.queue ? session.queue.then(() => job()) : job();
  session.queue.catch((err) => {
    console.error("Erro na fila:", err);
  });
  return session.queue;
}

// Sanitiza nome de pastas para evitar caracteres inválidos.
export function sanitizeFolderName(name) {
  return name.replace(/[^a-z0-9-_]/gi, "_");
}

// Gera mosaico de imagens usando ImageMagick e ajusta o tamanho e qualidade para o assist (montage).
export async function generateMosaic(
  images,
  outputPath,
  cols = 3,
  maxSizeKB = 600,
) {
  let quality = 70; // qualidade inicial
  while (quality >= 10) {
    try {
      await execFileAsync("montage", [
        ...images,
        "-tile",
        `${cols}x`,
        "-geometry",
        "400x400+0+0",
        "-quality",
        String(quality),
        "-font",
        "/nix/store/0fhfxh09gnlc6zx8d83p84qp0lqlyj4s-gyre-fonts-2.005/share/fonts/truetype/texgyrecursor-bold.otf",
        "-background",
        "black",
        outputPath,
      ]);
      const stats = await fs.stat(outputPath);
      if (stats.size <= maxSizeKB * 1024) break;

      quality -= 10; // reduz qualidade até ficar dentro do limite
    } catch (err) {
      throw new Error("Erro ao gerar mosaico: " + err.message);
    }
  }
}
