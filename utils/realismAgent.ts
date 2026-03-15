/**
 * Realism Agent - Specialized in fixing realism, logic, and technical inconsistencies.
 */

import { MODELS } from '../constants';
import { getFormattedPrompt, PromptNames } from './promptLoader';
import { generateLLMText } from '../services/llmService';
import { AgentLogEntry } from '../types';

export interface RealismCheckResult {
  refinedContent: string;
  success: boolean;
  error?: string;
}

/**
 * Perform a realism and logic check on the provided chapter content.
 */
export async function applyRealismCheck(
  content: string,
  chapterNumber: number,
  language: string = 'English',
  onLog?: (entry: AgentLogEntry) => void
): Promise<RealismCheckResult> {
  const startTime = Date.now();
  
  if (onLog) {
    onLog({
      timestamp: Date.now(),
      chapterNumber,
      type: 'execution',
      message: `Starting realism and logic check for Chapter ${chapterNumber}...`
    });
  }

  try {
    const { systemPrompt, userPrompt } = getFormattedPrompt(PromptNames.REALISM_CHECK, {
      chapter_content: content
    });

    const refinedContent = await generateLLMText(
      userPrompt,
      systemPrompt,
      undefined,
      0.3, // Lower temperature for more consistent logic
      0.8,
      20,
      language,
      MODELS.REALISM
    );

    const duration = Date.now() - startTime;

    if (onLog) {
      onLog({
        timestamp: Date.now(),
        chapterNumber,
        type: 'success',
        message: `Realism check completed successfully in ${duration}ms.`,
        beforeText: content.substring(0, 500) + '...',
        afterText: refinedContent.substring(0, 500) + '...'
      });
    }

    return {
      refinedContent,
      success: true
    };
  } catch (error: any) {
    console.error('❌ Realism Agent error:', error);
    
    if (onLog) {
      onLog({
        timestamp: Date.now(),
        chapterNumber,
        type: 'warning',
        message: `Realism check failed: ${error.message}. Proceeding with original content.`
      });
    }

    return {
      refinedContent: content,
      success: false,
      error: error.message
    };
  }
}
