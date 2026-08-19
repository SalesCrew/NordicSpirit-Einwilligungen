import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const values = {};
for (const line of (await readFile(new URL("../.dev.vars", import.meta.url), "utf8")).split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const separator = trimmed.indexOf("=");
  if (separator < 1) continue;
  values[trimmed.slice(0, separator).trim()] = trimmed.slice(separator + 1).trim();
}

const child = spawn(
  process.execPath,
  [fileURLToPath(new URL("../node_modules/vinext/dist/cli.js", import.meta.url)), "start", ...process.argv.slice(2)],
  {
    cwd: fileURLToPath(new URL("../", import.meta.url)),
    env: { ...process.env, ...values },
    stdio: "inherit",
  },
);

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
