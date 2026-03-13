declare const process: {
  env: {
    OPENROUTER_MODEL?: string;
    [key: string]: string | undefined;
  };
};

export const MODEL_NAME = process.env.OPENROUTER_MODEL || 'google/gemini-2.0-flash-001';
export const MIN_CHAPTERS = 3;
