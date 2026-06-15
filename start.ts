import 'dotenv/config';
import { startServer } from './server/main.js';

const agentId = process.env.AGENT_ID ?? 'default';
console.log('[start] Launching Rem Agent...');
console.log(`[start] Model: ${process.env.AGENT_MODEL}, BaseURL: ${process.env.AGENT_BASE_URL}`);
startServer({ agentId }).catch(console.error);
