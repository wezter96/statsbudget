export interface ExtractedDelta {
  /** Utgiftsområde code, e.g. "UO06" */
  area_code: string;
  /** Delta vs government budget, in Mkr. Positive = party wants more. */
  delta_mkr: number;
  /** 0..1 — how confident the extractor is about this number */
  confidence: number;
  /** Verbatim quote from the motion that grounds this number (stub = synthetic) */
  source_quote: string;
}

export interface MotionDoc {
  dok_id: string;
  rm: string;
  party_code: string;
  titel: string;
  undertitel: string;
  datum: string;
  text_url: string | null;
  html_url: string | null;
  /** Raw plain-text content, once fetched */
  text?: string;
}

export interface ReconcileResult {
  kept: ExtractedDelta[];
  dropped: { delta: ExtractedDelta; reason: string }[];
  total_mkr: number;
  declared_total_mkr?: number;
}
