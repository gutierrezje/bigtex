import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

if (process.platform !== "darwin") process.exit(0);

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const appName = pkg.productName ?? "BigTeX";
const plist = join(root, "node_modules/electron/dist/Electron.app/Contents/Info.plist");

if (!existsSync(plist)) process.exit(0);

for (const key of ["CFBundleName", "CFBundleDisplayName"]) {
  execFileSync("plutil", ["-replace", key, "-string", appName, plist]);
}

console.log(`Patched Electron.app menu name → ${appName}`);
