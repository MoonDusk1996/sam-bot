import { type BaseSession } from "./sessionManager.js";
import { commandHandlers } from "./commands.js";
import { type Message } from "whatsapp-web.js";
import {
  activateSession,
  enqueueJob,
  processTextMessage,
  saveMedia,
  shouldActivateSession,
} from "./helpers.js";

// Comandos explícitos enviados pelo usuário (mensagens iniciadas por "/").
export async function Commands(message: Message) {
  const [commandKey] = message.body.toLowerCase().split(" ");
  const handler = commandHandlers[commandKey as keyof typeof commandHandlers];
  if (!handler) return;
  await handler(message);
}

// Mensagens genéricas (texto ou mídia).
export async function Messages(message: Message, session: BaseSession | null) {
  // Ativação de sessão via texto
  if (shouldActivateSession(message, session)) {
    await activateSession(message);
    return;
  }

  // Mídia
  if (message.hasMedia) {
    if (!session) {
      await message.reply(
        "⚠️ A mídia não foi armazenada pois não há sessão ativa.\n\nUse */new* para criar.",
      );
      return;
    }
    enqueueJob(session, () => saveMedia(message, session));
    return;
  }

  // Texto
  if (
    session &&
    message.from === session.from &&
    !message.body.startsWith("/")
  ) {
    switch (session.partManagment) {
      case "getParts":
        // await preencherTemplate();
        break;

      case "returnParts":
        // await processReturnPartsMessage(message, session);
        break;

      default:
        await processTextMessage(message, session);
        break;
    }
  }
}
