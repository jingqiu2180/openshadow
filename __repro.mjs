const BASE = 'http://127.0.0.1:3952';
const TOKEN = 'testtoken123';
const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` };
const providers = {
  'minimax-token-plan': {
    base_url: 'https://api.minimaxi.com/anthropic',
    api_key: 'sk-test-dummy-key',
    api: 'anthropic-messages',
    models: ['MiniMax-M3'],
    display_name: 'MiniMax Token Plan',
  },
};
const models = {
  chat: { id: 'MiniMax-M3', provider: 'minimax-token-plan' },
  utility: { id: 'MiniMax-M3', provider: 'minimax-token-plan' },
  utility_large: { id: 'MiniMax-M3', provider: 'minimax-token-plan' },
};
const put = await fetch(`${BASE}/api/config`, { method: 'PUT', headers: H, body: JSON.stringify({ providers, models, wizard:{completed:true}, ui:{language:'zh-CN'}, user:{name:'王帅'}, memory:{enabled:true}, theme:'warm-paper', security:{workspaceRoots:[]} }) });
console.log('PUT /api/config ->', put.status, JSON.stringify(await put.json().catch(()=>({}))));
const get = await fetch(`${BASE}/api/models`, { headers: H });
const data = await get.json();
console.log('GET /api/models ->', get.status);
console.log('  models count:', (data.models||[]).length);
console.log('  models:', JSON.stringify((data.models||[]).map(m=>({id:m.id,provider:m.provider,isCurrent:m.isCurrent}))));
console.log('  current:', data.current);
