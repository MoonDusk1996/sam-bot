import { Commands, Messages } from "./dispatchers.js";
import pkg, { type Message } from "whatsapp-web.js";
import { getSession } from "./sessionManager.js";
import { config } from "./config.js";
import qrcode from "qrcode-terminal";

const { Client, LocalAuth } = pkg;
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    executablePath: config.CHROMIUM_PATH,
  },
});

// --- Eventos do cliente --- \\
client.on("qr", (qr: string) => {
  qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
  console.log("Cliente pronto!");
});

client.on("message", async (message: Message) => {
  if (!config.ALLOWED_IDS.has(message.from.trim())) return; //filter authorized IDs
  const session = getSession(); // start null
  Messages(message, session);
  Commands(message);
});

client.initialize();
