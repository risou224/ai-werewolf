import type { PromptStage, PromptTemplate, RoleType } from '@ai-werewolf/shared';
import { getDb } from '../db/connection.js';

export class PromptEngine {
  async getLayer2(stage: PromptStage, roleType: RoleType): Promise<string> {
    const db = await getDb();
    const allTemplates = db.exec(
      `SELECT content FROM prompt_templates WHERE stage = '${stage}' AND role_type = '${roleType}' ORDER BY version DESC LIMIT 1`
    );
    if (allTemplates.length > 0 && allTemplates[0].values.length > 0) {
      return allTemplates[0].values[0][0] as string;
    }
    return `[默认提示词] 你现在处于 ${stage} 阶段，角色类型: ${roleType}`;
  }

  buildMessages(
    layer1Prompt: string,
    layer2Content: string,
    layer3Context: string
  ): Array<{ role: 'system' | 'user'; content: string }> {
    return [
      { role: 'system', content: `${layer1Prompt}\n\n${layer2Content}` },
      { role: 'user', content: layer3Context },
    ];
  }

  fillTemplate(template: string, vars: Record<string, string>): string {
    let result = template;
    for (const [key, value] of Object.entries(vars)) {
      result = result.replaceAll(`{${key}}`, value);
    }
    return result;
  }
}
