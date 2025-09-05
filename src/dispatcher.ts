import { saveFileSession, setSession, type Session } from "./sessionManager.js";
import { type Message } from "whatsapp-web.js";
import { commandHandlers } from "./start.js";
import { config } from "./config.js";
import mime from "mime-types";
import fs from "fs/promises";
import path from "path";
import {
  appendMessage,
  compressImage,
  enqueueJob,
  sanitizeFolderName,
} from "./utils.js";

export async function messageCommand(message: Message) {
  const commandKey = message.body.split(" ")[0] as keyof typeof commandHandlers;
  const handler = commandHandlers[commandKey];
  if (handler) {
    await handler(message);
    return;
  }
}

export async function noMessageCommand(session: Session, message: Message) {
  if (
    session?.waitingForId &&
    message.from === session.from &&
    !message.body.startsWith("/")
  ) {
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
        waitingForId: false,
      });
      await saveFileSession(session);
      await message.reply(`Sessão para o diretório ${sessionId} ativa.`);
    } catch (err) {
      console.error(err);
      await message.reply("❌ Erro ao criar sessão.");
    }
    return;
  }

  // Recebendo mídia
  if (message.hasMedia) {
    if (!session) {
      await message.reply(
        "⚠️ A mídia não foi armazenada pois não há sessão ativa.\n\nUse */new* para criar.",
      );
      return;
    }
    enqueueJob(session, async () => {
      try {
        const media = await message.downloadMedia();
        if (!media) throw new Error("Falha no download da mídia.");
        const ext = mime.extension(media.mimetype) || "bin";
        const filename = message.id.id + "." + ext;
        const filePath = path.join(session!.sessionPath!, filename);
        await fs.writeFile(filePath, Buffer.from(media.data, "base64"));

        // compressão se for imagem
        if (media.mimetype.startsWith("image/")) {
          const compressedPath = path.join(
            session!.sessionPath!,
            `compressed_${Date.now()}.jpg`,
          );
          try {
            await compressImage(filePath, compressedPath);
            await fs.rename(compressedPath, filePath);
          } catch (err) {
            console.error("Erro ao comprimir imagem:", err);
          }
        }
        await message.reply(`📄 Arquivo salvo em: ${filePath}`);
      } catch (err: any) {
        console.error(err);
        await message.reply(
          `❌ Erro ao salvar ${message.type}: ${err.message || "desconhecido"}`,
        );
      }
    });
  } else if (session && message.from === session.from) {
    if (!message.body.startsWith("/")) {
      await appendMessage(session, message.body);
    }
  }
}
