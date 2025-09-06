import path from "path";
import envPaths from "env-paths";

const paths = envPaths("sam-bot");
const INDEX_FILE = path.join(paths.config, "index.json");
// envs configs
const WORK_DIR = process.env.SAM_WORKDIR || paths.data;
const CHROMIUM_PATH = process.env.CHROMIUM_PATH || "chromium";
const ALLOWED_IDS = new Set(
  (process.env.SAM_ALLOWED_IDS || "")
    .split(",")
    .map((id) => id.trim() + "@c.us")
    .filter(Boolean),
);

export const config = {
  WORK_DIR,
  CHROMIUM_PATH,
  ALLOWED_IDS,
  INDEX_FILE,
};
