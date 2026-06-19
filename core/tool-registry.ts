// @ts-nocheck
export interface ToolSpec {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: {
      type: 'object'
      properties: Record<string, any>
      required: string[]
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ToolHandler = (args: any) => Promise<any> | any

export interface ToolEntry {
  spec: ToolSpec
  handler: ToolHandler
}

export class ToolRegistry {
  private _tools = new Map<string, ToolEntry>()

  register(name: string, spec: ToolSpec, handler: ToolHandler): void {
    this._tools.set(name, { spec, handler })
  }

  registerEntry(name: string, entry: ToolEntry): void {
    this._tools.set(name, entry)
  }

  get(name: string): ToolEntry | undefined {
    return this._tools.get(name)
  }

  has(name: string): boolean {
    return this._tools.has(name)
  }

  list(): string[] {
    return [...this._tools.keys()]
  }

  getSpecs(): ToolSpec[] {
    return [...this._tools.values()].map(e => e.spec)
  }

  getHandler(name: string): ToolHandler | undefined {
    return this._tools.get(name)?.handler
  }

  remove(name: string): boolean {
    return this._tools.delete(name)
  }

  clear(): void {
    this._tools.clear()
  }

  merge(other: ToolRegistry): void {
    for (const [name, entry] of other._tools) {
      this._tools.set(name, entry)
    }
  }

  size(): number {
    return this._tools.size
  }
}

export function createToolSpec(
  name: string,
  def: { description: string; params: Record<string, any> },
): ToolSpec {
  return {
    type: 'function',
    function: {
      name,
      description: def.description,
      parameters: {
        type: 'object',
        properties: def.params,
        required: Object.keys(def.params).filter(k => !def.params[k]?.optional),
      },
    },
  }
}
