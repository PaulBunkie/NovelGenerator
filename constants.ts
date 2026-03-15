declare const process: {
  env: {
    OPENROUTER_MODEL?: string;
    MODEL_OUTLINE?: string;
    MODEL_PLANNING?: string;
    MODEL_WRITING?: string;
    MODEL_REALISM?: string;
    MODEL_POLISH?: string;
    MODEL_ANALYSIS?: string;
    [key: string]: string | undefined;
  };
};

export const DEFAULT_MODEL = process.env.OPENROUTER_MODEL || 'openrouter/free';

export const MODELS = {
  OUTLINE: process.env.MODEL_OUTLINE || DEFAULT_MODEL,
  PLANNING: process.env.MODEL_PLANNING || DEFAULT_MODEL,
  WRITING: process.env.MODEL_WRITING || DEFAULT_MODEL,
  REALISM: process.env.MODEL_REALISM || DEFAULT_MODEL,
  POLISH: process.env.MODEL_POLISH || DEFAULT_MODEL,
  ANALYSIS: process.env.MODEL_ANALYSIS || DEFAULT_MODEL,
};

export const MIN_CHAPTERS = 3;
