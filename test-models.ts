import 'dotenv/config';

async function testModels() {
  const apiKey = process.env.GROQ_API_KEY || process.env.API_KEY;
  console.log('Testing Groq Key:', apiKey ? `${apiKey.substring(0, 8)}...` : 'MISSING');

  // 1. Fetch available models list from Groq
  try {
    const res = await fetch('https://api.groq.com/openai/v1/models', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!res.ok) {
      console.error('Failed to list models:', res.status, await res.text());
    } else {
      const data = await res.json();
      console.log('\nAvailable Models on Groq:');
      const modelIds = data.data.map((m: any) => m.id);
      console.log(modelIds);

      // 2. Test completion with the first 3 models
      for (const modelId of modelIds) {
        console.log(`\nTesting completion with: ${modelId}...`);
        const compRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: modelId,
            messages: [{ role: 'user', content: 'Say hello in 3 words' }],
            max_tokens: 10,
          }),
        });

        if (compRes.ok) {
          const compData = await compRes.json();
          console.log(`✅ SUCCESS with model '${modelId}'! Response:`, compData.choices[0]?.message?.content);
          return modelId;
        } else {
          console.log(`❌ Failed with model '${modelId}':`, compRes.status, (await compRes.json()).error?.message);
        }
      }
    }
  } catch (err: any) {
    console.error('Error during test:', err.message);
  }
}

testModels();
