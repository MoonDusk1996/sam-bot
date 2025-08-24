const venom = require("venom-bot");
const fs = require("fs").promises;
const path = require("path");
const {
  appendMessage,
  enqueueJob,
  sanitizeFolderName,
  generateMosaic,
} = require("./utils");

const workPath = process.env.SAM_WORKDIR;
const allowedIds = process.env.SAM_ALLOWED_IDS;

let session = null; // Sessão única por instância

venom
  .create({
    session: "SAM",
    multidevice: true,
    browserArgs: ["--headless=new", "--no-sandbox", "--disable-setuid-sandbox"],
  })
  .then((client) => start(client))
  .catch((err) => console.error(err));

function start(client) {
  client.onMessage(async (message) => {
    if (message.chatId !== allowedIds) return; // se não for um usuario autorizado, retorna.

    // --- commando/handles ---
    // comando /new
    if (message.body === "/new") {
      session = { waitingForId: true, from: message.from };
      await client.sendText(message.from, "Digite a OS:");
      return;
    }
    // caso esperando o número do chamado
    if (session?.waitingForId && message.from === session.from) {
      const folderId = sanitizeFolderName(message.body.trim()).toLowerCase();
      const folderPath = path.join(workPath, folderId);

      try {
        await fs.mkdir(folderPath, { recursive: true });

        const existingImages = (await fs.readdir(folderPath))
          .filter((f) => f !== "mosaic.jpg" && /\.(jpeg|jpg|png)$/i.test(f))
          .map((f) => path.join(folderPath, f));

        session = {
          from: message.from,
          folderId,
          folderPath,
          images: existingImages,
          waitingForId: false,
        };

        await client.sendText(
          message.from,
          `Sessão para o chamado ${folderId} ativa. Envie arquivos agora.`,
        );
      } catch (err) {
        console.error(err);
        await client.sendText(message.from, "❌ Erro ao criar sessão.");
      }
      return;
    }

    // recebendo imagem
    if (message.isMedia || message.isMMS || message.type === "image") {
      if (!session || message.from !== session.from) {
        return client.sendText(
          message.from,
          "⚠️ A imagem não foi armazenada em nenhum chamado pois não existem sessões carregadas no momento.\n\nCaso queria armazenar uma imagem a um chamado use *new*",
        );
      }

      enqueueJob(session, async () => {
        try {
          const buffer = await client.decryptFile(message);
          const imgPath = path.join(session.folderPath, `${Date.now()}.jpg`);
          await fs.writeFile(imgPath, buffer);

          await client.sendText(
            message.from,
            `📄 Imagem salva em ${imgPath}\n${session.images}`,
          );
        } catch (err) {
          console.error(err);
          await client.sendText(message.from, "❌ Erro ao salvar imagem.");
        }
      });
      return;
    } else {
      // recebendo texto
      if (session && message.from === session.from) {
        // ignora comandos específicos
        if (!["/new", "/mosaic"].includes(message.body)) {
          await appendMessage(session, message.body);
        }
      }
    }

    // comando mosaic
    if (message.body === "/mosaic") {
      if (!session || message.from !== session.from) {
        return client.sendText(
          message.from,
          "⚠️ A imagem não foi armazenada em nenhum chamado pois não existem sessões ativas no momento.\n\nCaso queria armazenar uma imagem a um chamado use *new* primeiro.",
        );
      }

      enqueueJob(session, async () => {
        try {
          const files = await fs.readdir(session.folderPath);
          const images = files
            .filter((f) => /\.(jpe?g|png)$/i.test(f))
            .filter((f) => f !== "mosaic.jpg")
            .map((f) => path.join(session.folderPath, f));

          if (images.length === 0) {
            return client.sendText(
              message.from,
              "⚠️ Nenhuma imagem encontrada.",
            );
          }

          const mosaicPath = path.join(session.folderPath, "mosaic.jpg");
          await client.sendText(message.from, "⏳ Gerando mosaico...");
          await generateMosaic(images, mosaicPath);

          await client.sendImage(
            message.from,
            mosaicPath,
            "mosaic.jpg",
            `mosaico de imagens da OS *${session.folderId}* `,
          );
        } catch (err) {
          console.error(err);
          await client.sendText(message.from, "❌ Erro ao gerar mosaico.");
        }
      });
    }
  });
}
