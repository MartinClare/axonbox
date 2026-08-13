export type ActivityRow = { time: string; name: string; status: string };
export type IssueRow = {
  id: string;
  issue: string;
  risk: string;
  assignee: string;
  deadline?: string | Date | null;
  status: string;
};

export type DailyReportPayload = {
  title: string;
  projectName: string;
  siteCode: string;
  date: string;
  weather: string;
  reporterName: string;
  workerCount: number;
  subcontractorCount: number;
  equipmentCount: number;
  materialDeliveries: number;
  progressPct: number;
  safetyEvents: number;
  activities: ActivityRow[];
  issues: IssueRow[];
  plans: string[];
  narrative?: string;
};

export type EventReportRow = {
  caseNo: string;
  title: string;
  category: string;
  severity: string;
  location: string;
  status: string;
  subcontractor: string;
  assignee: string;
  discoveredAt: string;
  dueAt: string;
};

export type EventReportPayload = {
  title: string;
  projectName: string;
  siteCode: string;
  generatedAt: string;
  kind: "events" | "safety" | "quality";
  rows: EventReportRow[];
  summary?: string;
};

export type ReportFormat = "docx" | "pdf";
