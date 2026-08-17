import client from './client'

export interface RecommendedResource {
  rank: number; video_id: string; title: string; url: string
  channel: string | null; published_at: string | null; description: string | null
  views: number | null; likes: number | null; comments: number | null
  transcript_available: boolean; transcript_language: string | null
  relevance_score: number; educational_quality_score: number
  coverage_score: number; overall_score: number; beginner_friendly: boolean
  concepts_covered: string[]; strengths: string[]; weaknesses: string[]
  recommendation_reason: string; thumbnail_url?: string | null
}
export interface FinalReport {
  research_question: string; executive_summary: string
  recommended_resources: RecommendedResource[]; learning_path: string[]
  key_topics: string[]; methodology: string; limitations: string[]; conclusion: string
}
export interface ResearchResponse {
  success: boolean; report: FinalReport
  research_result: { research_request: { topic: string; video_count: number }; videos: { video_id: string; title: string | null; url: string | null; channel: string | null; views: number | null; likes: number | null; transcript_available: boolean }[] }
  analysis: { evaluations: { rank: number; video_id: string; title: string; overall_score: number }[]; ranking_summary: string }
}
export interface HistoryItem {
  run_id: string; query: string; status: string; video_count: number
  created_at: string; completed_at: string | null
  research_question: string | null; executive_summary: string | null
  conclusion: string | null; methodology: string | null
  learning_path: string[]; key_topics: string[]; limitations: string[]
  recommended_resources: RecommendedResource[]
  analysis_evaluations: { rank: number; video_id: string; title: string; overall_score: number; relevance_score: number; educational_quality_score: number; coverage_score: number; beginner_friendly: boolean; concepts_covered: string[]; strengths: string[]; weaknesses: string[]; recommendation_reason: string }[]
  ranking_summary: string | null
  videos: { video_id: string; title: string | null; url: string | null; channel: string | null; description: string | null; published_at: string | null; thumbnail_url: string | null; views: number | null; likes: number | null; comments: number | null; transcript_available: boolean; transcript_language: string | null; rank: number | null; overall_score: number | null }[]
}
export interface HistoryListResponse { total: number; page: number; page_size: number; items: HistoryItem[] }
export async function runResearch(q: string, videoCount: number): Promise<ResearchResponse> {
  const res = await client.post<ResearchResponse>('/youtube/research', { query: q, video_count: videoCount })
  return res.data
}
export async function getHistory(page = 1, pageSize = 20): Promise<HistoryListResponse> {
  const res = await client.get<HistoryListResponse>('/youtube/history', { params: { page, page_size: pageSize } })
  return res.data
}
export async function getHistoryEntry(runId: string): Promise<HistoryItem> {
  const res = await client.get<HistoryItem>(`/youtube/history/${runId}`)
  return res.data
}
export async function deleteHistoryEntry(runId: string): Promise<{ success: boolean; message: string }> {
  const res = await client.delete<{ success: boolean; message: string }>(`/youtube/history/${runId}`)
  return res.data
}
export async function renameHistoryEntry(runId: string, newName: string): Promise<{ success: boolean; message: string }> {
  const res = await client.patch<{ success: boolean; message: string }>(`/youtube/history/${runId}/rename`, { query: newName })
  return res.data
}