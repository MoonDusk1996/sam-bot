// import fs from "fs";
import path from "path";
// import envPaths from "env-paths";

// const paths = envPaths("SAM");
const WORK_DIR = process.env.SAM_WORKDIR as string;
const CHROMIUM_PATH = process.env.CHROMIUM_PATH as string;
const LASTSESSIONFILE = path.join(WORK_DIR, "lastsession.json");
// const configFile = path.join(paths.config, "config.json");
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

// // carrega config do arquivo, se existir
// export function loadUserConfig() {
//   try {
//     if (fs.existsSync(configFile)) {
//       const raw = fs.readFileSync(configFile, "utf-8");
//       return { ...config, ...JSON.parse(raw) };
//     }
//   } catch (err) {
//     console.error("Erro ao ler config:", err);
//   }
//   return config;
// }
//
// // salva config do usuário
// export function saveUserConfig(cfg: object) {
//   try {
//     fs.mkdirSync(paths.config, { recursive: true });
//     fs.writeFileSync(configFile, JSON.stringify(cfg, null, 2), "utf-8");
//   } catch (err) {
//     console.error("Erro ao salvar config:", err);
//   }
// }
//
// export const configFilePath = configFile;
