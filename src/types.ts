export interface Session {
  sessionPath?: string;
  queue?: Promise<any>;
  sessionId?: string;
  images?: string[];
  from?: string;
  waitingForId?: boolean;
}
