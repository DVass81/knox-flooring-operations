export type TrainingRole = "owner" | "sales" | "operations" | "installer";
export type TrainingPlacement = "top" | "right" | "bottom" | "left" | "center";

export type TrainingStep = {
  id: string;
  route: string;
  target: string;
  placement: TrainingPlacement;
  kind: "info" | "action";
  title: string;
  explanation: string;
  instruction: string;
  narration: string;
  seconds: number;
};

export type MissionDefinition = {
  key: string;
  name: string;
  role: TrainingRole;
  minutes: number;
  summary: string;
  steps: TrainingStep[];
};

export type PageGuide = {
  key: string;
  name: string;
  route: string;
  role: TrainingRole[];
  summary: string;
  target: string;
  narration: string;
};

export type TrainingRun = {
  id: string;
  userId: string;
  missionKey: string;
  manifestVersion: string;
  status: "active" | "paused" | "completed" | "dismissed";
  currentStep: number;
  voiceEnabled: boolean;
  checkpoints: string[];
  startedAt: string;
  completedAt?: string | null;
  updatedAt: string;
};

export type TrainingPreferences = {
  userId: string;
  voiceEnabled: boolean;
  captionsEnabled: true;
  welcomeDismissed: boolean;
};

export type TrainingStatus = {
  enabled: boolean;
  manifestVersion: string;
  missions: MissionDefinition[];
  pageGuides: PageGuide[];
  runs: TrainingRun[];
  preferences: TrainingPreferences;
};
