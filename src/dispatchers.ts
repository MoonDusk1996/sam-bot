import { commandHandlers } from "./commands.js";
import { type Message } from "whatsapp-web.js";
import {
  activateSession,
  enqueueJob,
  insertData,
  isOrigin,
  processTextMessage,
  saveMedia,
} from "./helpers.js";
import type { Session } from "./sessionManager.js";
interface Item {
  cod: string;
  desc: string;
  qtd: string;
  obs: string;
  lote: string;
}
//WARNING: Fazer toda a logica de encaminhamento aqui e tirar o que for possivel de helpers
export async function dispatchers(session: Session | null, message: Message) {
  console.log(session, message); // Debug

  // Verifica verifica em que modo o usuario e encontra e enchaminha
  switch (session?.mode) {
    case "waiting_session":
      if (isOrigin(session, message)) await activateSession(message);
      break;

    case "dev":
      if (isOrigin(session, message)) {
        const dados: Item[] = [
          {
            cod: "000000000001508097",
            desc: "POS MAST C4400 H3-4377 MON M2300, MOUSE",
            qtd: "4",
            obs: "usado 600007252222",
            lote: "123651",
          },
          {
            cod: "2asdjadahgdsj7351",
            desc: "prasdalkjsdhakjdajsdhasaskoc",
            qtd: "1",
            obs: "novo",
            lote: "12",
          },
          { cod: "27351", desc: "proc", qtd: "1", obs: "ok", lote: "12" },
        ];

        await insertData(dados);
      }
      break;

    case "ret":
      console.log("Você escolheu laranja 🍊");
      break;
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
  if (session?.sessionId && message.from === session.from) {
    await processTextMessage(message, session); //chat-log.txt
  } else {
  }

  //---Comandos explícitos iniciadas por "/") ---\\
  const [commandKey] = message.body.toLowerCase().split(" ");
  const handler = commandHandlers[commandKey as keyof typeof commandHandlers];
  if (!handler) return;
  await handler(message);
}
