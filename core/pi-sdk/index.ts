// pi-sdk.ts — PI SDK adapter stub（对齐 openhanako lib/pi-sdk/index.ts）
// 提供最小化的 Type 和 StringEnum 实现，让 update_settings 等工具能编译和运行

export const Type = {
  Object: (props: any) => ({ type: 'object', properties: props, required: Object.keys(props).filter((k: string) => !props[k].optional) }),
  String: (opts?: any) => ({ type: 'string', description: opts?.description, optional: opts?.optional }),
  Number: (opts?: any) => ({ type: 'number', description: opts?.description, optional: opts?.optional }),
  Boolean: (opts?: any) => ({ type: 'boolean', description: opts?.description, optional: opts?.optional }),
  Any: (opts?: any) => ({ description: opts?.description, optional: opts?.optional }),
  Array: (itemType: any, opts?: any) => ({ type: 'array', items: itemType, description: opts?.description, optional: opts?.optional }),
  Optional: (innerType: any) => ({ ...innerType, optional: true }),
  Union: (types: any[], opts?: any) => ({ anyOf: types, description: opts?.description }),
  Enum: (values: string[], opts?: any) => ({ type: 'string', enum: values, description: opts?.description }),
}

export function StringEnum(values: string[], opts?: any) {
  return { type: 'string', enum: values, description: opts?.description }
}
