import pkg, { type Message } from "whatsapp-web.js";
import { getSession } from "./sessionManager.js";
import { config } from "./config.js";
import qrcode from "qrcode-terminal";
import { dispatchers } from "./dispatchers.js";

const { Client, LocalAuth } = pkg;
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    executablePath: config.CHROMIUM_PATH,
  },
});

client.on("qr", (qr: string) => qrcode.generate(qr, { small: true }));
client.on("ready", () => console.log("Cliente pronto!"));
client.on("message", async (message: Message) => {
  if (!config.ALLOWED_IDS.has(message.from.trim())) return; //filter authorized IDs
  let session = getSession(); // start null
  dispatchers(session, message); // handles
  console.log(session); // Debug
});

client.initialize();
