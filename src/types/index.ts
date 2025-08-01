/**
 * TypeScript type definitions
 * Common interfaces and types for the application
 */

// Patch Note Information
export interface PatchNote {
  version: string;
  title: string;
  url: string;
  imageUrl?: string;
  localImagePath?: string;
  publishedAt: Date;
  content?: string;
  summary?: string; // Gemini生成の要約
}

// Discord Webhook Payload
export interface DiscordEmbed {
  title: string;
  description?: string;
  url?: string;
  color?: number;
  timestamp?: string;
  image?: {
    url: string;
  };
  thumbnail?: {
    url: string;
  };
  footer?: {
    text: string;
  };
  fields?: Array<{
    name: string;
    value: string;
    inline?: boolean;
  }>;
}

export interface DiscordWebhookPayload {
  content?: string;
  embeds?: DiscordEmbed[];
}// Application State Management
export interface AppState {
  lastCheckedPatch?: PatchNote;
  lastNotificationSent?: Date;
  totalNotificationsSent: number;
  isRunning: boolean;
}

// Gemini AI 設定と型
export interface GeminiConfig {
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  timeout: number;
  maxRetries: number;
}

export interface GeminiSummary {
  version: string;
  summary: string;
  keyChanges: string[];
  generatedAt: Date;
  model: string;
}

// Configuration Types
export interface AppConfig {
  discord: {
    webhookUrl: string;
  };
  lol: {
    patchNotesUrl: string;
  };
  gemini: {
    apiKey: string;
    model: string;
    temperature: number;
    maxTokens: number;
    timeout: number;
    maxRetries: number;
  };
  monitoring: {
    checkIntervalMinutes: number;
  };
  logging: {
    level: string;
    filePath?: string;
  };
  storage: {
    patchesDir: string;
    imagesDir: string;
    summariesDir: string; // Gemini要約保存ディレクトリ
  };
  http: {
    timeout: number;
    maxRetries: number;
    retryDelay: number;
  };
  rateLimit: {
    maxRequestsPerHour: number;
    windowMs: number;
  };
}

// HTTP Client Response Types
export interface HttpResponse<T = unknown> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
}

// Error Types
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class NetworkError extends AppError {
  constructor(message: string, statusCode?: number) {
    super(message, 'NETWORK_ERROR', statusCode);
    this.name = 'NetworkError';
  }
}

export class ScrapingError extends AppError {
  constructor(message: string) {
    super(message, 'SCRAPING_ERROR');
    this.name = 'ScrapingError';
  }
}

export class DiscordError extends AppError {
  constructor(message: string, statusCode?: number) {
    super(message, 'DISCORD_ERROR', statusCode);
    this.name = 'DiscordError';
  }
}