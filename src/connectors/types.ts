export interface RawSignal {
  sourceType: string;
  sourceUrl: string;
  sourceTitle: string;
  signalType: "mention" | "spike" | "new_repo" | "paper" | "discussion" | "download_spike";
  topic: string;
  rawStrength: number; // source-specific, will be normalized
  rawData: Record<string, unknown>;
  detectedAt: Date;
}

export interface SourceConnector {
  name: string;
  displayName: string;
  fetchSignals(): Promise<RawSignal[]>;
}
