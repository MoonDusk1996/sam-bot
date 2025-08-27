import { execFile, exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
const execFileAsync = promisify(execFile);
const execPromise = promisify(exec);
export async function compressImage(inputPath, outputPath) {
    const cmd = `magick "${inputPath}" -strip -interlace Plane -sampling-factor 4:2:0 -quality 85 -define jpeg:extent=600kb "${outputPath}"`;
    await execPromise(cmd);
}
// Salva mensagens em um arquivo de texto da sessão.
export async function appendMessage(session, message) {
    if (!session?.sessionPath)
        return;
    const logFile = path.join(session.sessionPath, "chat.txt");
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] ${message}\n`;
    try {
        await fs.appendFile(logFile, line);
    }
    catch (err) {
        console.error("Erro ao salvar mensagem:", err);
    }
}
// Enfileira jobs assíncronos para execução sequencial dentro da sessão.
export async function enqueueJob(session, job) {
    session.queue = session.queue ? session.queue.then(() => job()) : job();
    session.queue.catch((err) => {
        console.error("Erro na fila:", err);
    });
    return session.queue;
}
// Sanitiza nomes de pastas, trocando caracteres inválidos por "_".
export function sanitizeFolderName(name) {
    return name.replace(/[^a-z0-9-_]/gi, ".");
}
// Gera mosaico de imagens usando o ImageMagick (montage) e Ajusta qualidade até que o arquivo fique dentro do limite definido.
export async function generateMosaic(images, outputPath, cols = 3, maxSizeKB = 600) {
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
            if (stats.size <= maxSizeKB * 1024)
                break;
            quality -= 10; // reduz qualidade até ficar dentro do limite
        }
        catch (err) {
            throw new Error(`Erro ao gerar mosaico: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
}
//# sourceMappingURL=utils.js.map