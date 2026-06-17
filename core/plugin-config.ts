import fs from "fs";
import path from "path";

// ── Schema 规范化 ─────────────────────────────────────────────────────────

const SUPPORTED_TYPES = new Set(["string", "number", "integer", "boolean"]);
const REDACTED_VALUE = "********";

export interface PluginConfigProperty {
  type: "string" | "number" | "integer" | "boolean";
  title?: string;
  description?: string;
  default?: unknown;
  enum?: unknown[];
  sensitive?: boolean;
}

export interface PluginConfigSchema {
  pluginId: string;
  type: "object";
  properties: Record<string, PluginConfigProperty>;
  required?: string[];
}

function normalizeProperty(
  key: string,
  raw: Record<string, unknown> = {}
): PluginConfigProperty {
  const type = SUPPORTED_TYPES.has(raw.type as string)
    ? (raw.type as PluginConfigProperty["type"])
    : inferType(raw.default);
  return {
    type,
    title: typeof raw.title === "string" ? raw.title : key,
    description: typeof raw.description === "string" ? raw.description : "",
    default: raw.default,
    enum: Array.isArray(raw.enum) ? [...raw.enum] : undefined,
    sensitive: raw.sensitive === true,
  };
}

function inferType(defaultValue: unknown): PluginConfigProperty["type"] {
  if (typeof defaultValue === "boolean") return "boolean";
  if (typeof defaultValue === "number") {
    return Number.isInteger(defaultValue) ? "integer" : "number";
  }
  return "string";
}

export function normalizePluginConfigSchema(
  pluginId: string,
  rawSchema: Record<string, unknown> = {}
): PluginConfigSchema {
  const rawProperties =
    rawSchema?.properties && typeof rawSchema.properties === "object"
      ? (rawSchema.properties as Record<string, unknown>)
      : {};
  const properties: Record<string, PluginConfigProperty> = {};
  for (const [key, rawProperty] of Object.entries(rawProperties)) {
    if (!rawProperty || typeof rawProperty !== "object") continue;
    properties[key] = normalizeProperty(key, rawProperty as Record<string, unknown>);
  }
  return {
    pluginId,
    type: "object",
    properties,
    required: Array.isArray(rawSchema.required)
      ? (rawSchema.required as string[]).filter((k) => k in properties)
      : [],
  };
}

// ── 配置存储 ─────────────────────────────────────────────────────────────

export interface PluginConfigStore {
  get(key?: string, options?: { scope?: string }): unknown;
  getAll(options?: { redacted?: boolean }): Record<string, unknown>;
  set(key: string, value: unknown, options?: { scope?: string }): void;
  setMany(values: Record<string, unknown>, options?: { scope?: string }): Record<string, unknown>;
  getSchema(): PluginConfigSchema;
}

export function createPluginConfigStore(opts: {
  dataDir: string;
  schema: PluginConfigSchema;
}): PluginConfigStore {
  const { dataDir, schema } = opts;
  const configPath = path.join(dataDir, "config.json");

  function readState(): Record<string, unknown> {
    try {
      const raw = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw;
    } catch {
      // file not found or invalid JSON → return defaults
    }
    // apply defaults
    const state: Record<string, unknown> = {};
    for (const [key, prop] of Object.entries(schema.properties)) {
      if (prop.default !== undefined) state[key] = prop.default;
    }
    return state;
  }

  function writeState(state: Record<string, unknown>): void {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify(state, null, 2) + "\n", "utf-8");
  }

  function validatePatch(values: Record<string, unknown>): string[] {
    const errors: string[] = [];
    for (const [key, value] of Object.entries(values)) {
      const prop = schema.properties[key];
      if (!prop) {
        errors.push(`Unknown config field "${key}"`);
        continue;
      }
      if (prop.enum && !prop.enum.includes(value)) {
        errors.push(`Config field "${key}" must be one of: ${prop.enum.join(", ")}`);
        continue;
      }
      if (prop.type === "boolean" && typeof value !== "boolean") {
        errors.push(`Config field "${key}" must be boolean`);
      } else if (prop.type === "integer" && !Number.isInteger(value)) {
        errors.push(`Config field "${key}" must be integer`);
      } else if (prop.type === "number" && typeof value !== "number") {
        errors.push(`Config field "${key}" must be number`);
      } else if (prop.type === "string" && typeof value !== "string") {
        errors.push(`Config field "${key}" must be string`);
      }
    }
    return errors;
  }

  function redactValue(prop: PluginConfigProperty, value: unknown): unknown {
    if (prop.sensitive && value !== undefined && value !== null && value !== "") {
      return REDACTED_VALUE;
    }
    return value;
  }

  return {
    get(key?: string, _options?: { scope?: string }): unknown {
      const state = readState();
      if (!key) return { ...state };
      return state[key];
    },

    getAll(options?: { redacted?: boolean }): Record<string, unknown> {
      const state = readState();
      if (options?.redacted) {
        const redacted: Record<string, unknown> = {};
        for (const [key, prop] of Object.entries(schema.properties)) {
          redacted[key] = redactValue(prop, state[key]);
        }
        return redacted;
      }
      return { ...state };
    },

    set(key: string, value: unknown, _options?: { scope?: string }): void {
      const errors = validatePatch({ [key]: value });
      if (errors.length > 0) throw new Error(errors.join("; "));
      const state = readState();
      if (value === undefined) delete state[key];
      else state[key] = value;
      writeState(state);
    },

    setMany(
      values: Record<string, unknown>,
      _options?: { scope?: string }
    ): Record<string, unknown> {
      const errors = validatePatch(values);
      if (errors.length > 0) throw new Error(errors.join("; "));
      const state = readState();
      for (const [key, value] of Object.entries(values)) {
        if (value === undefined) delete state[key];
        else state[key] = value;
      }
      writeState(state);
      return { ...state };
    },

    getSchema(): PluginConfigSchema {
      return JSON.parse(JSON.stringify(schema));
    },
  };
}

// ── 工具函数 ─────────────────────────────────────────────────────────────

export function redactConfigValues(
  schema: PluginConfigSchema,
  values: Record<string, unknown>
): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const [key, prop] of Object.entries(schema.properties)) {
    if (prop.sensitive && values[key] !== undefined && values[key] !== null && values[key] !== "") {
      output[key] = REDACTED_VALUE;
    } else {
      output[key] = values[key];
    }
  }
  return output;
}
