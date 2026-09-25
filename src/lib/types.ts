export type PageName = "dashboard" | "tasks" | "workouts" | "money" | "settings";
export type ModalName = "intake" | "task" | "project" | "workout" | "money" | null;
export type Priority = "P1" | "P2" | "P3" | "P4";
export type TaskStatus = "todo" | "doing" | "done";

export interface Project {
  id: string;
  name: string;
  description: string;
  priority: Priority;
  status: "ready" | "doing" | "done";
  progress: number;
  dueDate: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  projectId?: string;
  priority: Priority;
  status: TaskStatus;
  scheduledDate: string;
  dueDate: string;
  estimatedMinutes: number;
}

export interface Workout {
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
  id: string;
  happenedAt: string;
  name: string;
  merchant: string;
  amount: number;
  flow: "income" | "expense";
  category: string;
  account: string;
}
