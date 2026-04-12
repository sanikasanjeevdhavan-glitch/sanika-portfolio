export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { message, history = [], system } = req.body;
  if (!message) return res.status(400).json({ error: 'Message required' });

  const groqKey = process.env.GROQ_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  const messages = [
    ...history.filter(m => m.role && m.content),
    { role: 'user', content: message }
  ];

  // Option 1: Groq (free, fast, no credit card needed)
  if (groqKey) {
    try {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + groqKey,
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [
            { role: 'system', content: system || 'You are a helpful assistant.' },
            ...messages
          ],
          max_tokens: 400,
          temperature: 0.7,
        }),
      });
      const data = await r.json();
      const text = data.choices?.[0]?.message?.content;
      if (r.ok && text) return res.status(200).json({ text });
    } catch (e) {}
  }

  // Option 2: Anthropic (if key set)
  if (anthropicKey) {
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

  return res.status(500).json({ error: 'No API key configured' });
}
