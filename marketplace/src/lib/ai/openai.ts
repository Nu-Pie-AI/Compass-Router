import OpenAI from 'openai';

// Allow build to succeed without API key - runtime will check when actually used
const apiKey = process.env.OPENAI_API_KEY || 'build-time-placeholder';

if (!process.env.OPENAI_API_KEY && process.env.NODE_ENV !== 'production') {
  console.warn('Warning: OPENAI_API_KEY is not set. AI features will not work.');
}

export const openai = new OpenAI({
  apiKey: apiKey,
});