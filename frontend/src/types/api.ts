export interface RewriteRequest {
  text: string;
  mode: string;
  tone: string;
}

export interface ChangedSentence {
  original: string;
  rewritten: string;
  type: string;
}

export interface RewriteResponse {
  id: string;
  rewritten_text: string;
  original_word_count: number;
  rewritten_word_count: number;
  mode: string;
  tone: string;
  timestamp: string;
  plagiarism_percentage: number;
  changed_sentences: ChangedSentence[];
}

export interface HistoryItem {
  id: string;
  original_text: string;
  rewritten_text: string;
  mode: string;
  tone: string;
  original_word_count: number;
  rewritten_word_count: number;
  plagiarism_percentage: number;
  timestamp: string;
}

export interface UsageResponse {
  daily_limit: number;
  rewrites_today: number;
  remaining: number;
  credits?: number;
  reset_date: string;
}

export interface LoginResponse {
  token: string;
  user: {
    id?: string;
    email?: string;
    daily_limit: number;
    rewrites_today: number;
    credits?: number;
    reset_date: string;
    email_verified?: boolean;
    is_admin?: boolean;
  };
}

export interface RegisterResponse {
  token: string;
  user: {
    id?: string;
    email?: string;
    daily_limit: number;
    rewrites_today: number;
    credits?: number;
    reset_date: string;
    email_verified?: boolean;
    is_admin?: boolean;
  };
}
