
export type RiskLevel = 'Low' | 'Medium' | 'High' | 'Critical';

export type CallerCategory = 
  | 'Official Bank' 
  | 'Government/Authority' 
  | 'Telecommunications' 
  | 'Logistics/Courier' 
  | 'Financial Sales' 
  | 'Real Estate' 
  | 'General Telemarketing' 
  | 'Market Research' 
  | 'Bank Impersonator' 
  | 'Authority Impersonator' 
  | 'Job Offer Scam' 
  | 'Investment/Crypto' 
  | 'Debt Collector' 
  | 'Winner/Prize Scam' 
  | 'Personal/Private' 
  | 'Automated Bot' 
  | 'Unknown';

export interface AnalysisResult {
  id: string;
  phoneNumber: string;
  location: string;
  incidentDate: string;
  incidentTime: string;
  timestamp: string;
  reportedCategory: CallerCategory;
  score: number;
  level: RiskLevel;
  confidence: number;
  probability: number;
  freqHour: number;
  freqWeekLocation: number;
  factors: string[];
  expertCommentary: string;
}
