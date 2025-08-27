import venom, { Whatsapp, type Message } from "venom-bot";
import mime from "mime-types";
import fs from "fs/promises";
import path from "path";
import {
  appendMessage,
  enqueueJob,
  sanitizeFolderName,
  generateMosaic,
  compressImage,
} from "./utils.js";

import type { Session } from "./types.js";

let session: Session | null = null; // Sessão única por instância
const workDir = process.env.SAM_WORKDIR as string; // Diretório da sessão
const allowedId = process.env.SAM_ALLOWED_ID as string; // Usuários permitidos

venom
  .create({
    session: "SAM",
    browserArgs: ["--headless=new", "--no-sandbox", "--disable-setuid-sandbox"],
  })
  .then((client) => start(client))
  .catch((err) => console.error(err));

function start(client: Whatsapp) {
  client.onMessage(async (message: Message) => {
    console.log(session, message);
    if (message.chatId !== allowedId) return; // se não for um usuario autorizado, retorna.

    // --- comandos/handlers ---
    if (message.body === "/new") {
      session = { waitingForId: true, from: message.from };
      await client.sendText(message.from, "Digite a Nova sessão:");
      return;
    }

    if (message.body === "/session") {
      if (
        !session ||
        message.from !== session.from ||
        session.sessionId == undefined
      ) {
        return client.sendText(
          message.from,
          "⚠️ Sem sessões carregadas no momento.",
        );
      }
      await client.sendText(
        message.from,
        `Sessão para o diretorio ${session.sessionId} ativa.`,
      );
      return;
    }

    if (message.body === "/mosaic") {
      if (!session || message.from !== session.from) {
        return client.sendText(
          message.from,
          "⚠️ A imagem não foi armazenada em nenhum diretorio pois não existem sessões ativas no momento.\n\nCaso queria armazenar uma imagem a um diretorio use */new* primeiro.",
        );
      }
      enqueueJob(session, async () => {
        try {
          const files = await fs.readdir(session!.sessionPath!);
          const images = files
            .filter((f) => /\.(jpe?g|png)$/i.test(f))
            .filter((f) => f !== "mosaic.jpg")
            .map((f) => path.join(session!.sessionPath!, f));

          if (images.length === 0) {
            return client.sendText(
              message.from,
              "⚠️ Nenhuma imagem encontrada.",
            );
          }

          const mosaicPath = path.join(session!.sessionPath!, "mosaic.jpg");
          await client.sendText(message.from, "⏳ Gerando mosaico...");
          await generateMosaic(images, mosaicPath);

          await client.sendImage(
            message.from,
            mosaicPath,
            "mosaic.jpg",
            `mosaico de imagens da sessão *${session!.sessionId}* `,
          );
        } catch (err) {
          console.error(err);
          await client.sendText(message.from, "❌ Erro ao gerar mosaico.");
        }
      });
    }

    if (message.body === "/exit") {
      if (
        !session ||
        message.from !== session.from ||
        session.sessionId == undefined
      ) {
        session = null;
        return client.sendText(
          message.from,
          "⚠️ Sem sessões carregadas no momento.",
        );
      } else {
        const currentSession = session.sessionId;
        session = null;
        return client.sendText(
          message.from,
          `Saiu da sessão ${currentSession}.`,
        );
      }
    }

    // caso esperando nome da sessão
    if (
      session?.waitingForId &&
      message.from === session.from &&
      !message.body.startsWith("/")
    ) {
      const sessionId = sanitizeFolderName(message.body.trim()).toLowerCase();
      const sessionPath = path.join(workDir, sessionId);
      try {
        await fs.mkdir(sessionPath, { recursive: true });
        const existingImages = (await fs.readdir(sessionPath))
          .filter((f) => f !== "mosaic.jpg" && /\.(jpeg|jpg|png)$/i.test(f))
          .map((f) => path.join(sessionPath, f));

        session = {
          from: message.from,
          sessionId,
          sessionPath,
          images: existingImages,
          waitingForId: false,
        };

        await client.sendText(
          message.from,
          `Sessão para o diretorio ${sessionId} ativa.`,
        );
      } catch (err) {
        console.error(err);
        await client.sendText(message.from, "❌ Erro ao criar sessão.");
      }
      return;
    }

    // --- Recebendo midia durante a sessão ---
    // --- Recebendo midia durante a sessão ---
    if (
      message.isMedia ||
      message.isMMS ||
      ["image", "video", "audio", "ptt", "document"].includes(message.type)
    ) {
      if (!session || message.from !== session.from) {
        return client.sendText(
          message.from,
          "⚠️ A mídia não foi armazenada pois não há sessão ativa.\n\nUse */new* para criar uma nova sessão.",
        );
      }

      enqueueJob(session, async () => {
        if (session)
          try {
            const buffer = await client.decryptFile(message);

            let filename: string;
            if (message.filename) {
              filename = sanitizeFolderName(path.basename(message.filename));
            } else if (message.mimetype) {
              const ext = mime.extension(message.mimetype) || "bin";
              filename = `${Date.now()}.${ext}`;
            } else {
              filename = `${Date.now()}.bin`;
            }

            const filePath = path.join(session.sessionPath!, filename);
            await fs.writeFile(filePath, buffer);

            // Se for imagem, comprimir com imagemagick
            if (message.mimetype?.startsWith("image/")) {
              const compressedPath = path.join(
                session.sessionPath!,
                `compressed_${Date.now()}.jpg`,
              );

              try {
                await compressImage(filePath, compressedPath);

                // Substitui o original pelo comprimido
                await fs.rename(compressedPath, filePath);
              } catch (err) {
                console.error("Erro ao comprimir imagem:", err);
              }
            }

            await client.sendText(
              message.from,
              `📄 Arquivo salvo em: ${filePath}`,
            );
          } catch (err: any) {
            console.error(err);
            await client.sendText(
              message.from,
              `❌ Erro ao salvar ${message.type}: ${err.message || "desconhecido"}`,
            );
          }
      });
    } else if (session && message.from === session.from) {
      const commands = new Set(["/new", "/mosaic", "/session", "/exit"]);
      if (!commands.has(message.body)) {
        await appendMessage(session, message.body);
      }
    }
  });
}
