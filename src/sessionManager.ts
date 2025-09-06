// ---Tuddo isso aqui é experimentarimentação --- \\
let session: BaseSession | ActiveSession | null = null; //start null

export type PartManagment = "none" | "getParts" | "returnParts";
export interface BaseSession {
  sessionId?: string;
  sessionPath?: string;
  from?: string;
  images?: string[];
  queue?: Promise<any>;
  waitingForId?: boolean;
  partManagment?: PartManagment;
}
export interface ActiveSession extends BaseSession {
  sessionId: string;
}
export interface WaitingSession extends BaseSession {
  waitingForId: true;
  from: string;
}
export const getSession = (): BaseSession | null => session;
export const clearSession = () => (session = null);
export const setSession = async (newSession: BaseSession) =>
  (session = newSession);
