import {
  setSession,
  getSession,
  clearSession,
  type Session,
} from "./sessionManager.js";
import pkg, { type Message } from "whatsapp-web.js";
import { config } from "./config.js";
import fs from "fs/promises";
import path from "path";
import {
  enqueueJob,
  generateMosaic,
  loadIndexFile,
  sanitizeFolderName,
  saveIndexFile,
} from "./helpers.js";

type CommandHandler = (
  message: Message,
  session: Session | null,
) => Promise<void>;
const { MessageMedia } = pkg;
// --- Descrições de cada comando ---
const commandDescriptions: Record<string, string> = {
  "/help": "this help",
  "/new": "new directory",
  "/ld": "list directories",
  "/mosaic": "generate mosaic",
  "/last": "load last directory",
  "/exit": "exit session",
};

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
        const newSession = {
          from: message.from,
          sessionId,
          sessionPath,
          images: existingImages,
          waitingForId: false,
        };
        setSession(newSession);
        saveIndexFile(newSession);
        await message.reply(`Diretório *${sessionId}* ativo.`);
      } catch (err) {
        console.error(err);
        await message.reply("❌ Erro ao criar diretório.");
      }
    } else {
      // Fluxo em argumento
      setSession({ mode: "aguardando sessão", from: message.from });
      await message.reply("Digite a Nova sessão:");
    }
  },

  "/dev": async (message) => {
    setSession({ mode: "devolução", from: message.from }); // salva a nova sessão
    await message.reply(`Modo de devolução ativo.`);
  },
  "/ret": async (message) => {
    setSession({ mode: "retirada", from: message.from });
    await message.reply(`Modo de retirada ativo.`);
  },

  "/help": async (message, session) => {
    if (!session?.sessionId) {
      await message.reply(`Modo ${session?.mode} ativo.\n\nComandos:\n${commandList}`);
      return;
    }
    await message.reply(
      `Modo diretório *${session.sessionId}* ativo.\n\nComandos:\n${commandList}`,
    );
  },

  "/last": async (message) => {
    const last = loadIndexFile();
    if (!last) {
      await message.reply("⚠️ Nenhum diretório anterior encontrado.");
      return;
    }
    setSession(last);
    await message.reply(`ultimo diretório *${last.sessionId}* ativo.`);
  },

  "/mosaic": async (message, session) => {
    if (!session) {
      await message.reply("⚠️ Nenhum diretório ativo. Use */new*");
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
        await message.reply(media);
      } catch (err) {
        console.error(err);
        await message.reply("❌ Erro ao gerar mosaico.");
      }
    });
  },

  "/ld": async (message) => {
    // TODO: da pra fazer listar o quem tem no diretorio da sesão tambem aqui
    try {
      const items = await fs.readdir(config.WORK_DIR, { withFileTypes: true });

      // Filtra apenas diretórios
      const directories = items.filter((item) => item.isDirectory());

      if (directories.length === 0) {
        await message.reply("⚠️ Nenhum diretório encontrado em workdir.");
        return;
      }

      // Obtemos help de modificação de cada diretório
      const dirsWithStats = await Promise.all(
        directories.map(async (dir) => {
          const fullPath = path.join(config.WORK_DIR, dir.name);
          const stats = await fs.stat(fullPath);
          return { name: dir.name, mtime: stats.mtime };
        }),
      );

      // Ordena do mais recente para o mais antigo
      dirsWithStats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

      // Cria a mensagem de resposta
      const replyMessage =
        `📂 Total de diretórios: ${dirsWithStats.length}\n` +
        dirsWithStats.map((dir) => `- ${dir.name}`).join("\n");

      await message.reply(replyMessage);
    } catch (err) {
      console.error(err);
      await message.reply("❌ Erro ao listar diretórios.");
    }
  },

  "/exit": async (message, session) => {
    if (!session?.sessionId) {
      clearSession();
      await message.reply("⚠️ Sem sessões carregadas.");
      return;
    }
    const current = session.sessionId;
    clearSession();
    await message.reply(`Saiu do diretório ${current}.`);
  },
};

// --- Gera dinamicamente a lista de comandos --- \\
export const commandList = Object.keys(commandHandlers)
  .map(
    (cmd) => `${cmd} = ${commandDescriptions[cmd] || "Em testes (desativado)"}`,
  )
  .join("\n");
