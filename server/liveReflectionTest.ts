import dotenv from 'dotenv';
dotenv.config({ override: true });
import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY || process.env.GEMNI_API_KEY || '';
if (!apiKey) {
  console.error('FAIL: No Gemini API Key found in environment.');
  process.exit(1);
}

const ai = new GoogleGenAI({
  apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

const MODEL_FALLBACK_CHAIN = [
  'gemini-3.5-flash',
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.1-flash-lite',
];

async function generateContentWithFallback(options: {
  contents: any;
  systemInstruction?: string;
  temperature?: number;
}): Promise<{ text: string; modelUsed: string }> {
  let lastError: any = null;

  for (let i = 0; i < MODEL_FALLBACK_CHAIN.length; i++) {
    const model = MODEL_FALLBACK_CHAIN[i];
    try {
      const generatePromise = ai.models.generateContent({
        model,
        contents: options.contents,
        config: {
          systemInstruction: options.systemInstruction,
          temperature: options.temperature ?? 0.7,
        },
      });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Model "${model}" request timed out after 15s`)), 15000)
      );

      const response: any = await Promise.race([generatePromise, timeoutPromise]);
      const responseText = response.text?.trim() || '';
      if (!responseText) {
        throw new Error(`Model "${model}" returned an empty response.`);
      }

      return { text: responseText, modelUsed: model };
    } catch (err: any) {
      const status = err?.status || err?.statusCode || (err?.error && err.error.code);
      const errMsg = typeof err?.message === 'string' ? err.message : '';
      console.warn(`[Gemini Fallback Test] Model "${model}" failed (HTTP ${status || 'unknown'}: ${errMsg || 'Error'}). Trying next model in ladder...`);
      lastError = err;

      if (i < MODEL_FALLBACK_CHAIN.length - 1) {
        continue;
      }
      break;
    }
  }

  throw lastError || new Error('All fallback models in the resilience ladder failed to generate content.');
}

async function runLiveReflectionTest() {
  console.log('=== RUNNING LIVE REFLECTION REQUEST ===');
  console.log('Configured Model Ladder:', MODEL_FALLBACK_CHAIN.join(' -> '));

  const prompt = 'I am reflecting on balancing deep focus work with sudden team requests today. How can I maintain composure and clear priorities?';
  const systemInstruction = `You are a thoughtful reflection companion for a private personal journal. Provide grounded, empathetic inquiry without presumptuous assumptions. Keep response between 60 and 120 words.`;

  const startTime = Date.now();
  const result = await generateContentWithFallback({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    systemInstruction,
    temperature: 0.65,
  });
  const elapsed = Date.now() - startTime;

  console.log(`\n✓ LIVE REFLECTION SUCCESSFUL in ${elapsed}ms!`);
  console.log(`✓ Model that actually answered: "${result.modelUsed}"`);
  console.log(`✓ Response text preview:\n"${result.text}"\n`);

  if (!result.text || result.text.length < 20) {
    console.error('FAIL: Response too short or empty.');
    process.exit(1);
  }

  console.log('=== LIVE TEST COMPLETED SUCCESSFULLY ===');
}

runLiveReflectionTest().catch((err) => {
  console.error('LIVE REFLECTION TEST FAILED:', err);
  process.exit(1);
});
