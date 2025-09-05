import fs from "fs/promises";
import path from "path";
import { config } from "./config.js";

export interface Session {
  sessionPath?: string;
  queue?: Promise<any>;
  sessionId?: string;
  images?: string[];
  from?: string;
  waitingForId?: boolean;
}

let session: Session | null = null;

export async function setSession(newSession: Session) {
  session = newSession;
  await saveFileSession(session);
}

export function getSession(): Session | null {
  return session;
}

export function clearSession() {
  session = null;
}

// --- Funções para salvar e carregar a última sessão ---
export async function saveFileSession(session: Session) {
  if (!session.sessionId || !session.sessionPath) return;
  await fs.writeFile(
    config.LASTSESSIONFILE,
    JSON.stringify(
      {
        sessionId: session.sessionId,
        sessionPath: session.sessionPath,
        from: session.from,
      },
      null,
      2,
    ),
  );
}

export async function loadFileSession(): Promise<Session | null> {
  try {
    const data = await fs.readFile(config.LASTSESSIONFILE, "utf-8");
    const obj = JSON.parse(data);
    const images = (await fs.readdir(obj.sessionPath))
      .filter((f: string) => /\.(jpe?g|png)$/i.test(f) && f !== "mosaic.jpg")
      .map((f: string) => path.join(obj.sessionPath, f));
    return {
      sessionId: obj.sessionId,
      sessionPath: obj.sessionPath,
      from: obj.from,
      images,
      waitingForId: false,
    };
  } catch {
    return null;
  }
}
