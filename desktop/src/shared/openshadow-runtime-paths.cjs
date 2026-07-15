const os = require("os");
const path = require("path");
const fs = require("fs");

const OPEN_SHADOW_SDK_AGENT_DIR_ENV = "PI_CODING_AGENT_DIR";

function expandHome(input, homeDir = os.homedir()) {
  if (!input) return input;
  if (input === "~") return homeDir;
  if (input.startsWith("~/") || input.startsWith("~" + path.sep)) {
    return path.join(homeDir, input.slice(2));
  }
  return input;
}

function resolveOpenShadowHome(input, homeDir = os.homedir()) {
  const raw = input || path.join(homeDir, ".openshadow");
  return path.resolve(expandHome(raw, homeDir));
}

function resolveOpenShadowPiRoot(openShadowHome) {
  if (!openShadowHome || typeof openShadowHome !== "string") {
    throw new Error("resolveOpenShadowPiRoot: openShadowHome is required");
  }
  return path.join(openShadowHome, ".pi");
}

function resolveOpenShadowPiAgentDir(openShadowHome) {
  return path.join(resolveOpenShadowPiRoot(openShadowHome), "agent");
}

function resolveOpenShadowPiProjectDir(openShadowHome) {
  return path.join(resolveOpenShadowPiRoot(openShadowHome), "project");
}

function withOpenShadowPiSdkEnv(env, openShadowHome) {
  return {
    ...env,
    [OPEN_SHADOW_SDK_AGENT_DIR_ENV]: resolveOpenShadowPiAgentDir(openShadowHome),
  };
}

function ensureOpenShadowPiSdkDirs(openShadowHome) {
  fs.mkdirSync(resolveOpenShadowPiAgentDir(openShadowHome), { recursive: true });
  fs.mkdirSync(resolveOpenShadowPiProjectDir(openShadowHome), { recursive: true });
}

function configureProcessPiSdkEnv(openShadowHome, env = process.env) {
  const agentDir = resolveOpenShadowPiAgentDir(openShadowHome);
  env[OPEN_SHADOW_SDK_AGENT_DIR_ENV] = agentDir;
  return agentDir;
}

module.exports = {
  OPEN_SHADOW_SDK_AGENT_DIR_ENV,
  configureProcessPiSdkEnv,
  ensureOpenShadowPiSdkDirs,
  resolveOpenShadowHome,
  resolveOpenShadowPiAgentDir,
  resolveOpenShadowPiProjectDir,
  resolveOpenShadowPiRoot,
  withOpenShadowPiSdkEnv,
};
