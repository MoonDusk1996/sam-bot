import { setSession, type Session } from "./sessionManager.js";
import { commandHandlers } from "./commands.js";
import { type Message } from "whatsapp-web.js";
import { config } from "./config.js";
import fs from "fs/promises";
import path from "path";
import {
  checkOrigin,
  handleMediaMessage,
  insertData,
  processTextMessage,
  sanitizeFolderName,
} from "./helpers.js";

export async function dispatchers(session: Session | null, message: Message) {
  const fromOrigin = checkOrigin(session, message);

  // --- Comandos explícitos iniciados por "/" ---\\
  const [commandKey] = message.body.toLowerCase().split(" ");
  const handler = commandHandlers[commandKey as keyof typeof commandHandlers];
  if (handler) {
    await handler(message, session);
    return;
  }

  // --- Verifica o modo da sessão e age com base na resposta ---
  switch (session?.mode) {
    case "aguardando sessão":
      if (!fromOrigin) break;
      if (message.hasMedia) break;
      const sessionId = sanitizeFolderName(message.body.trim()).toLowerCase();
      const sessionPath = path.join(config.WORK_DIR, sessionId);

      try {
        await fs.mkdir(sessionPath, { recursive: true });

        const existingImages = (await fs.readdir(sessionPath))
          .filter((f) => f !== "mosaic.jpg" && /\.(jpe?g|png)$/i.test(f))
          .map((f) => path.join(sessionPath, f));

        setSession({
          from: message.from,
          sessionId,
          sessionPath,
          images: existingImages,
        });

        await message.reply(
          `✅ Sessão para o diretório *${sessionId}* ativada.`,
        );
      } catch (err) {
        console.error("Erro ao criar diretório:", err);
        await message.reply("❌ Erro ao criar diretório.");
      }
      break;

    case "devolução":
      if (!fromOrigin) break;
      if (message.hasMedia) break;
      await insertData("devolução");
      break;

    case "retirada":
      if (!fromOrigin) break;
      if (message.hasMedia) break;
      await insertData("retirada");
      break;
  }

  // --- Outros textos em sessão para o chat-log.txt ---
  if (session?.sessionId && fromOrigin) processTextMessage(message, session);

  // --- Mídia ---
  if (message.hasMedia) handleMediaMessage(message, session);
}
