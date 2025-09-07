import { setSession, type Session } from "./sessionManager.js";
import type { Message } from "whatsapp-web.js";
import { config } from "./config.js";
import mime from "mime-types";
import ExcelJS from "exceljs";
import fs from "fs/promises";
import sharp from "sharp";
import path from "path";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "fs";

interface Item {
  cod: string;
  desc: string;
  qtd: string;
  obs: string;
  lote: string;
}

export const isOrigin = (session: Session, message: Message): boolean => {
  return message.from === session.from ? true : false;
};

export async function insertData(dados: Item[]): Promise<void> {
  const partManagment = "Devolução";
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile("/home/dusk/Repo/sam-bot/template.xlsx");
  const sheet = workbook.getWorksheet(1);
  if (!sheet) throw new Error("Planilha não encontrada no template.xlsx");

  console.log("ok");
  const startLine = 6; // agora começa da linha 7

  // Inserir dados fixos
  sheet.getCell("A1").value = partManagment;
  sheet.getCell("A2").value = "Washington Lopes";
  sheet.getCell("A7").value =
    `Data da ${partManagment.toLowerCase()}: 06/09/2025`;

  const baseRow = sheet.getRow(startLine);

  for (const [index, item] of dados.entries()) {
    const targetRowNumber = startLine + 1 + index;
    const newRow = sheet.insertRow(targetRowNumber, [
      item.cod,
      item.desc,
      item.qtd,
      item.obs,
      item.lote,
    ]);

    baseRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const newCell = newRow.getCell(colNumber);

      if (cell.border) newCell.border = { ...cell.border };
      if (cell.alignment)
        newCell.alignment = { ...cell.alignment, wrapText: true };
      // if (cell.font) newCell.font = { ...cell.font };
      // if (cell.fill) newCell.fill = { ...cell.fill };
    });

    newRow.commit();
  }

  console.log("ok");
  await workbook.xlsx.writeFile("saida.xlsx");
  console.log("Planilha gerada com sucesso!");
}

// Comprime imagem individualmente
export async function compressImage(
  inputPath: string,
  outputPath: string,
  maxSizeKB = 600,
) {
  let quality = 85;
  while (quality >= 10) {
    const buffer = await sharp(inputPath)
      .jpeg({
        quality,
        mozjpeg: true,
        progressive: true,
      })
      .toBuffer();
    // Converte Buffer para Uint8Array
    await fs.writeFile(outputPath, new Uint8Array(buffer));
    const stats = await fs.stat(outputPath);
    if (stats.size <= maxSizeKB * 1024) break;
    quality -= 5;
  }
}
// Salva mensagens em um arquivo de texto da sessão.
export async function appendMessage(
  session: Session,
  message: string,
): Promise<void> {
  if (!session?.sessionPath) return;
  const logFile = path.join(session.sessionPath, "chat-log.txt");
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${message}\n`;
  try {
    await fs.appendFile(logFile, line);
  } catch (err) {
    console.error("Erro ao salvar mensagem:", err);
  }
}

// Enfileira jobs assíncronos dentro da sessão.
export async function enqueueJob(
  session: Session,
  job: () => Promise<void>,
): Promise<any> {
  session.queue = session.queue ? session.queue.then(() => job()) : job();
  session.queue.catch((err) => {
    console.error("Erro na fila:", err);
  });
  return session.queue;
}

// Sanitiza nomes de pastas, trocando caracteres inválidos por "_".
export function sanitizeFolderName(name: string): string {
  name = name.trim().replace(/\s+/g, "_");
  return name.replace(/[^a-z0-9-_]/gi, "");
}

export async function generateMosaic(
  images: string[],
  outputPath: string,
  cols = 3,
  maxSizeKB = 600,
): Promise<void> {
  const cellWidth = 400;
  const cellHeight = 400;
  const rows = Math.ceil(images.length / cols);
  const canvasWidth = cols * cellWidth;
  const canvasHeight = rows * cellHeight;

  // Redimensiona todas as imagens para o tamanho da célula
  const resizedBuffers = await Promise.all(
    images.map((img) =>
      sharp(img).resize(cellWidth, cellHeight, { fit: "cover" }).toBuffer(),
    ),
  );

  // Gera lista de overlays com posição calculada
  const composites = resizedBuffers.map((buf, i) => {
    const x = (i % cols) * cellWidth;
    const y = Math.floor(i / cols) * cellHeight;
    return { input: buf, left: x, top: y };
  });

  let quality = 70;
  let outputBuffer: Buffer = Buffer.alloc(0); // inicializa vazio

  while (quality >= 10) {
    try {
      // Cria a tela preta e aplica os overlays
      outputBuffer = await sharp({
        create: {
          width: canvasWidth,
          height: canvasHeight,
          channels: 3,
          background: "black",
        },
      })
        .composite(composites)
        .jpeg({ quality })
        .toBuffer();

      // Verifica o tamanho em memória
      if (outputBuffer.byteLength <= maxSizeKB * 1024) break;

      quality -= 5; // reduz qualidade e tenta novamente
    } catch (err: unknown) {
      throw new Error(
        `Erro ao gerar mosaico: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // Grava apenas uma vez, após atingir o limite de tamanho
  await fs.writeFile(outputPath, new Uint8Array(outputBuffer));
}

// Cria/ativa uma sessão com base no texto enviado.
export async function activateSession(message: Message) {
  const sessionId = sanitizeFolderName(message.body.trim()).toLowerCase();
  const sessionPath = path.join(config.WORK_DIR, sessionId);

  try {
    await fs.mkdir(sessionPath, { recursive: true });

    const existingImages = (await fs.readdir(sessionPath))
      .filter((f) => f !== "mosaic.jpg" && /\.(jpeg|jpg|png)$/i.test(f))
      .map((f) => path.join(sessionPath, f));

    setSession({
      from: message.from,
      sessionId,
      sessionPath,
      images: existingImages,
      mode: null,
    });

    await message.reply(`✅ Sessão para o diretório *${sessionId}* ativada.`);
  } catch (err) {
    console.error("Erro ao criar sessão:", err);
    await message.reply("❌ Erro ao criar sessão.");
  }
}

// Salva mídia enviada em uma sessão.
export async function saveMedia(message: Message, session: Session) {
  try {
    const media = await message.downloadMedia();
    if (!media) throw new Error("Falha no download da mídia.");

    const ext = mime.extension(media.mimetype) || "bin";
    const filename = `${message.id.id}.${ext}`;
    const filePath = path.join(session.sessionPath!, filename);

    // Convertendo Buffer para Uint8Array para satisfazer TypeScript
    await fs.writeFile(
      filePath,
      new Uint8Array(Buffer.from(media.data, "base64")),
    );

    if (media.mimetype.startsWith("image/")) {
      await compressAndReplace(filePath, session.sessionPath!);
    }

    await message.reply(`📄 Arquivo salvo em: ${filePath}`);
  } catch (err: any) {
    console.error("Erro ao salvar mídia:", err);
    await message.reply(
      `❌ Erro ao salvar ${message.type}: ${err.message || "desconhecido"}`,
    );
  }
}

// Comprime imagem e substitui a original.
export async function compressAndReplace(
  filePath: string,
  sessionPath: string,
) {
  const compressedPath = path.join(sessionPath, `compressed_${Date.now()}.jpg`);
  try {
    await compressImage(filePath, compressedPath);
    await fs.rename(compressedPath, filePath);
  } catch (err) {
    console.error("Erro ao comprimir imagem:", err);
  }
}

// Anexa mensagem de texto a uma sessão ativa.
export async function processTextMessage(message: Message, session: Session) {
  try {
    await appendMessage(session, message.body);
  } catch (err) {
    console.error("Erro ao processar mensagem de texto:", err);
  }
}

// INFO: como muito provavelmente teremos poucas instancias do bot, foi decidido fazer sincrono
export function loadIndexFile(): Session | null {
  try {
    // Verifica se o arquivo de sessão existe
    if (!existsSync(config.INDEX_FILE)) {
      return null;
    }

    const data = readFileSync(config.INDEX_FILE, "utf-8");
    const obj = JSON.parse(data);

    // Verifica se o diretório da sessão existe
    if (!existsSync(obj.sessionPath)) {
      return null;
    }

    const images = readdirSync(obj.sessionPath)
      .filter((f: string) => /\.(jpe?g|png)$/i.test(f) && f !== "mosaic.jpg")
      .map((f: string) => path.join(obj.sessionPath, f));

    return {
      sessionId: obj.sessionId,
      sessionPath: obj.sessionPath,
      from: obj.from,
      images,
      mode: null,
    };
  } catch {
    return null;
  }
}

export async function saveIndexFile(newSession: Session) {
  // Garante que o diretório exista
  const dir = path.dirname(config.INDEX_FILE);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    config.INDEX_FILE,
    JSON.stringify(
      {
        from: newSession.from,
        sessionId: newSession.sessionId,
        sessionPath: newSession.sessionPath,
      },
      null,
      2,
    ),
  );
}
