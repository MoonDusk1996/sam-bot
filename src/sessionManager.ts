// ---Tuddo isso aqui é experimentarimentação --- \\
let session: Session | null = null; //start null

export type Mode = "waiting_session" | "dev" | "ret" | null;

export interface Session {
  sessionId?: string;
  sessionPath?: string;
  from?: string;
  images?: string[];
  queue?: Promise<any>;
  mode?: Mode;
}

export const setSession = async (newSession: Session) => (session = newSession);
export const clearSession = () => (session = null);
export const getSession = (): Session | null => session;
