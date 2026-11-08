export type PageName = "dashboard" | "tasks" | "workouts" | "money" | "settings";
export type ModalName = "intake" | "task" | "project" | "workout" | "money" | "schedule" | null;
export type Priority = "P1" | "P2" | "P3" | "P4";
export type TaskStatus = "todo" | "doing" | "done";
export type TaskArea = string;

export interface Project {
  updatedAt?: string;
  id: string;
  name: string;
  description: string;
  priority: Priority;
  status: "ready" | "doing" | "done";
  progress: number;
  dueDate: string;
}

export interface Task {
  updatedAt?: string;
  id: string;
  title: string;
  description: string;
  area: TaskArea;
  projectId?: string;
  priority: Priority;
  status: TaskStatus;
  scheduledDate: string;
  dueDate: string;
  estimatedMinutes: number;
}

export interface Workout {
  updatedAt?: string;
  id: string;
  title: string;
  startedAt: string;
  place: string;
  durationMinutes: number;
  exercise: string;
  sets: number;
  reps: number;
  weightKg: number;
}

export interface Transaction {
  updatedAt?: string;
  id: string;
  happenedAt: string;
  name: string;
  merchant: string;
  amount: number;
  flow: "income" | "expense";
  category: string;
  account: string;
}

export interface Schedule {
  id: string;
  updatedAt?: string;
  title: string;
  description: string;
  area: string;
  startedAt: string;
  endedAt: string;
  location: string;
}

export interface NotificationPreferences {
  enabled: boolean;
  times: string[];
  days: number[];
}

export interface PlannerData {
  projects: Project[];
  tasks: Task[];
  workouts: Workout[];
  transactions: Transaction[];
  schedules: Schedule[];
  areas: string[];
  notifications: NotificationPreferences;
}
