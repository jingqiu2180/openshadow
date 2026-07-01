import { homedir } from "node:os";
import { join } from "node:path";

export function defaultDevShadowHome() {
  return join(homedir(), ".openshadow-dev");
}

export function applyDevEnvironment(env = process.env, {
  nodeBin = process.execPath,
} = {}) {
  env.SHADOW_HOME = defaultDevShadowHome();
  env.SHADOW_DEV_NODE_BIN = nodeBin;
  return env;
}
