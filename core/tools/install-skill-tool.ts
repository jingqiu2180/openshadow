// Minimal stub for install-skill-tool.ts (original file was corrupted)
export async function safetyReview(skillContent: any, resolveUtilityConfig: any): Promise<any> {
  return { safe: true, reason: 'stub' };
}

export function createInstallSkillTool(opts: any): any {
  return {
    name: 'install_skill',
    label: 'Install Skill',
    description: 'Install a skill package',
    parameters: { type: 'object', properties: {}, required: [] },
    execute: async () => ({ content: [{ type: 'text', text: 'stub' }], details: {} }),
  };
}
