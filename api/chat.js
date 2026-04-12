export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { message, history = [], system } = req.body;
  if (!message) return res.status(400).json({ error: 'Message required' });

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const hfToken = process.env.HF_TOKEN;

  // ── Option 1: Anthropic (if key set) ──
  if (anthropicKey) {
    const messages = [
      ...history.filter(m => m.role && m.content),
      { role: 'user', content: message }
    ];
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 400,
          system: system || 'You are a helpful assistant.',
          messages,
        }),
      });
      const data = await r.json();
      if (r.ok) return res.status(200).json({ text: data.content?.[0]?.text || '' });
    } catch (e) {}
  }

  // ── Option 2: Hugging Face (free) ──
  if (hfToken || true) { // try even without token (rate-limited but works)
    const prompt = (system || '') + '\n\n' +
      history.filter(m => m.role && m.content)
        .map(m => (m.role === 'user' ? 'User: ' : 'Assistant: ') + m.content)
        .join('\n') +
      '\nUser: ' + message + '\nAssistant:';

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (hfToken) headers['Authorization'] = 'Bearer ' + hfToken;

      const r = await fetch(
        'https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2',
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            inputs: prompt,
            parameters: { max_new_tokens: 300, temperature: 0.7, return_full_text: false }
          }),
        }
      );
      const data = await r.json();
      const raw = Array.isArray(data) ? data[0]?.generated_text : data?.generated_text;
      if (raw) {
        const clean = raw.split(/\nUser:/i)[0].trim();
        return res.status(200).json({ text: clean });
      }
    } catch (e) {}
  }

  return res.status(500).json({ error: 'Could not get a response' });
}
