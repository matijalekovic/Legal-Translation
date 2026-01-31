import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';

// This runs server-side only, so the API key is safe
const getApiKey = (): string => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not configured');
  }
  return apiKey;
};

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { model, contents, config } = req.body;

    if (!model || !contents) {
      return res.status(400).json({ error: 'Missing required fields: model, contents' });
    }

    // Initialize Gemini AI with server-side API key
    const ai = new GoogleGenAI({ apiKey: getApiKey() });

    // Make the request to Gemini
    const response = await ai.models.generateContent({
      model,
      contents,
      config,
    });

    // Return the response
    return res.status(200).json({
      text: response.text || '',
      success: true,
    });

  } catch (error: any) {
    console.error('Translation error:', error);
    return res.status(500).json({
      error: 'Translation failed',
      message: error.message || 'Unknown error',
      success: false,
    });
  }
}
