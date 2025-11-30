export enum AppState {
  IDLE = 'IDLE',
  READY = 'READY',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

export interface WatermarkSettings {
  size: number; // Percentage 5-30
  opacity: number; // 0-1
  marginRight: number; // Pixels
  marginBottom: number; // Pixels
}

export interface TextOverlaySettings {
  enabled: boolean;
  content: string;
  fontSize: number; // Percentage of canvas height (1-10)
  color: string;
  yPosition: number; // Percentage 0-100
  opacity: number;
}

export interface ProcessingStats {
  originalSize: string;
  processedSize: string;
  duration: number;
  format: string;
}

export interface ProcessingError {
  message: string;
  details?: string;
}

export type SupportedMimeType = 'video/mp4' | 'video/webm';
export type OutputFormat = 'mp4' | 'mov';
