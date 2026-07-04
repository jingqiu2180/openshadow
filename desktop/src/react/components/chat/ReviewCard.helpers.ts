/**
 * ReviewCard.helpers.ts — ReviewCard 辅助函数
 */

import type { StructuredReview, ReviewFollowUpTaskState } from '../../stores/chat-types';

export function findingsSummary(count: number | undefined, zh: boolean): string {
  if (!count) return '';
  return zh ? `${count} 条发现` : `${count} findings`;
}

export function contextPackSummary(pack: unknown, zh: boolean): string {
  if (!pack) return '';
  return zh ? '已包含上下文' : 'context included';
}

export function isFollowUpTaskActive(task: ReviewFollowUpTaskState | null | undefined): boolean {
  if (!task) return false;
  return task.status === 'pending' || task.status === 'running' || task.status === 'waiting_approval';
}

export function followUpTaskLabel(task: ReviewFollowUpTaskState | null | undefined, zh: boolean): string {
  if (!task) return '';
  if (task.status === 'completed') return zh ? '执行完成' : 'Completed';
  if (task.status === 'failed') return zh ? '执行失败' : 'Failed';
  if (task.status === 'running') return zh ? '执行中...' : 'Running...';
  return '';
}

export function normalizeFollowUpTaskDetail(task: ReviewFollowUpTaskState | null | undefined, zh: boolean): string {
  if (!task) return '';
  return task.resultSummary || task.error || '';
}

export function buildDiscussionDraft(sourceResponse: string, structured: StructuredReview, zh: boolean): string {
  return `Let's discuss: ${structured.summary}`;
}

export function normalizeReviewErrorMessage(error: string | undefined, errorCode: string | null | undefined, zh: boolean): string {
  if (!error) return '';
  return error;
}

export function summarizeOriginalAnswer(sourceResponse: string, zh: boolean): string {
  return sourceResponse.slice(0, 500);
}

export function summarizeHanakoConcerns(structured: StructuredReview, zh: boolean): string {
  return structured.findings.map(f => f.title).join('\n');
}

export function buildExecutionResolution(structured: StructuredReview, sourceResponse: string | undefined, zh: boolean): string {
  return structured.nextStep || '';
}

export function shouldCollapseText(text: string): boolean {
  return text.length > 500;
}

export function stripReviewThinkTags(content: string): string {
  return content.replace(/<think>[\s\S]*?<\/think>/g, '');
}
