import fs from "fs/promises";
import path from "path";
import { appendMessage, enqueueJob, sanitizeFolderName, generateMosaic, } from "./utils.js";
import { Whatsapp } from "venom-bot";
export const commands = {
    "/new": handleNew,
    "/session": handleSession,
    "/mosaic": handleMosaic,
    "/exit": handleExit,
};
export async function handleNew(client, message, session) {
    console.log("comando /new: ", session, message);
    session = { waitingForId: true, from: message.from };
    await client.sendText(message.from, "Digite a Nova sessão:");
}
export async function handleSession(client, message, session) {
    console.log("comando /session: ", session, message);
    if (!session ||
        message.from !== session.from ||
        session.folderId == undefined) {
        await client.sendText(message.from, "⚠️ Sem sessões carregadas no momento.");
    }
    else {
        await client.sendText(message.from, `Sessão ativa!`);
    }
}
export async function handleMosaic(client, message, session) {
    console.log("comando /mosaic: ", session, message);
    if (!session || message.from !== session.from) {
        await client.sendText(message.from, "⚠️ A imagem não foi armazenada em nenhum diretorio pois não existem sessões ativas no momento.\n\nCaso queria armazenar uma imagem a um diretorio use */new* primeiro.");
        return;
    }
    enqueueJob(session, async () => {
        try {
            const files = await fs.readdir(session.folderPath);
            const images = files
                .filter((f) => /\.(jpe?g|png)$/i.test(f))
                .filter((f) => f !== "mosaic.jpg")
                .map((f) => path.join(session.folderPath, f));
            if (images.length === 0) {
                return client.sendText(message.from, "⚠️ Nenhuma imagem encontrada.");
            }
            const mosaicPath = path.join(session.folderPath, "mosaic.jpg");
            await client.sendText(message.from, "⏳ Gerando mosaico...");
            await generateMosaic(images, mosaicPath);
            await client.sendImage(message.from, mosaicPath, "mosaic.jpg", `mosaico de imagens da sessão *${session.folderId}* `);
        }
        catch (err) {
            console.error(err);
            await client.sendText(message.from, "❌ Erro ao gerar mosaico.");
        }
    });
}
export async function handleExit(client, message, session) {
    console.log("comando /exit: ", session, message);
    if (!session ||
        message.from !== session.from ||
        session.folderId == undefined) {
        session = null;
        await client.sendText(message.from, "⚠️ Sem sessões carregadas no momento.");
    }
    else {
        const currentSession = session.folderId;
        session = null;
        await client.sendText(message.from, `Saiu da sessão ${currentSession}.`);
    }
}
//# sourceMappingURL=commands.js.map