import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Cross-platform alternative to a POSIX-only inline environment assignment.
const next = fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url));
const result = spawnSync(process.execPath, [next, "build"], {
  stdio: "inherit",
  env: { ...process.env, NEXT_EXPORT: "1" },
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
