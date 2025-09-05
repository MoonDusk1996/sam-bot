import path from "path";

const WORK_DIR = process.env.SAM_WORKDIR as string;
const CHROMIUM_PATH = process.env.CHROMIUM_PATH as string;
const LASTSESSIONFILE = path.join(WORK_DIR, "lastsession.json");
const ALLOWED_IDS = new Set(
  (process.env.SAM_ALLOWED_IDS || "")
    .split(",")
    .map((id) => id.trim() + "@c.us")
    .filter(Boolean),
);

export const config = {
  WORK_DIR,
  LASTSESSIONFILE,
  CHROMIUM_PATH,
  ALLOWED_IDS,
};

console.log("configs:", config);
