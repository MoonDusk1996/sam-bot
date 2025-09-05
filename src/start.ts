import { enqueueJob, sanitizeFolderName, generateMosaic } from "./utils.js";
import { messageCommand, noMessageCommand } from "./dispatcher.js";
import pkg, { type Message } from "whatsapp-web.js";
import { config } from "./config.js";
import qrcode from "qrcode-terminal";
import fs from "fs/promises";
import path from "path";
import {
  setSession,
  loadFileSession,
  getSession,
  clearSession,
} from "./sessionManager.js";

type CommandHandler = (message: Message) => Promise<unknown>;

const { Client, LocalAuth, MessageMedia } = pkg;
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    executablePath: config.CHROMIUM_PATH,
  },
});

// --- Registro de comandos --- \\
export const commandHandlers: Record<string, CommandHandler> = {
  "/new": async (message) => {
    const parts = message.body.trim().split(/\s+/);
    const arg = parts[1];
    if (arg) {
      const sessionId = sanitizeFolderName(arg).toLowerCase();
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
        await message.reply(`Sessão para o diretório ${sessionId} ativa.`);
      } catch (err) {
        console.error(err);
        await message.reply("❌ Erro ao criar sessão.");
      }
    } else {
      // Fluxo sem argumento
      setSession({ waitingForId: true, from: message.from });
      await message.reply("Digite a Nova sessão:");
    }
  },

  "/session": async (message) => {
    const session = getSession();
    if (!session?.sessionId) {
      await message.reply("⚠️ Sem sessões carregadas no momento.");
      return;
    }
    await message.reply(`Sessão para o diretório ${session.sessionId} ativa.`);
  },

  "/last": async (message) => {
    const last = await loadFileSession();
    if (!last) {
      await message.reply("⚠️ Nenhuma sessão anterior encontrada.");
      return;
    }
    setSession(last);
    await message.reply(
      `Sessão anterior *${getSession()?.sessionId}* ativada.`,
    );
  },

  "/mosaic": async (message) => {
    const session = getSession();
    if (!session) {
      await message.reply("⚠️ Nenhuma sessão ativa. Use */new* para criar.");
      return;
    }
    enqueueJob(session, async () => {
      try {
        const files = await fs.readdir(session!.sessionPath!);
        const images = files
          .filter((f) => /\.(jpe?g|png)$/i.test(f))
          .filter((f) => f !== "mosaic.jpg")
          .map((f) => path.join(session!.sessionPath!, f));

        if (images.length === 0) {
          await message.reply("⚠️ Nenhuma imagem encontrada.");
          return;
        }

        const mosaicPath = path.join(session!.sessionPath!, "mosaic.jpg");
        await message.reply("⏳ Gerando mosaico...");
        await generateMosaic(images, mosaicPath);

        const media = MessageMedia.fromFilePath(mosaicPath);
        await client.sendMessage(message.from, media, {
          caption: `Mosaico da sessão *${session!.sessionId}*`,
        });
      } catch (err) {
        console.error(err);
        await message.reply("❌ Erro ao gerar mosaico.");
      }
    });
  },

  "/exit": async (message) => {
    const session = getSession();
    if (!session?.sessionId) {
      clearSession();
      await message.reply("⚠️ Sem sessões carregadas.");
      return;
    }
    const current = session.sessionId;
    clearSession();
    await message.reply(`Saiu da sessão ${current}.`);
  },
};

// --- Eventos do cliente --- \\
client.on("qr", (qr: string) => {
  qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
  console.log("Cliente pronto!");
});

client.on("message", async (message: Message) => {
  const session = getSession();
  if (!config.ALLOWED_IDS.has(message.from.trim())) return;
  messageCommand(message);
  noMessageCommand(session, message);
});

client.initialize();
