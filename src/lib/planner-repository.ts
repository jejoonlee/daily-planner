import type { SupabaseClient } from "@supabase/supabase-js";
import type { NotificationPreferences, PlannerData, Project, Schedule, Task, Transaction, Workout } from "./types";

type Row = Record<string, unknown>;
export type RecordKind = "project" | "task" | "workout" | "transaction" | "schedule";
const tables = { project: "projects", task: "tasks", workout: "workout_sessions", transaction: "transactions", schedule: "schedules" } as const;
export const defaultNotifications: NotificationPreferences = { enabled: false, times: ["08:00"], days: [1, 2, 3, 4, 5, 6, 0] };
const string = (row: Row, key: string, fallback = "") => typeof row[key] === "string" ? row[key] as string : fallback;
const number = (row: Row, key: string) => Number(row[key] ?? 0);
const base = (row: Row) => ({ id: string(row, "id"), updatedAt: string(row, "updated_at") });

// The app's date/time inputs explicitly use Korea time, regardless of device timezone.
export function toKoreaLocal(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error("저장된 날짜를 읽지 못했습니다.");
  return new Date(date.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 16);
}
export function toKoreaInstant(value: string) { return value ? new Date(`${value}:00+09:00`).toISOString() : null; }

export const fromProjectRow = (r: Row): Project => ({ ...base(r), name: string(r, "name"), description: string(r, "description"), priority: r.priority as Project["priority"], status: r.status as Project["status"], progress: number(r, "progress"), dueDate: string(r, "end_date") });
export const fromTaskRow = (r: Row): Task => ({ ...base(r), title: string(r, "title"), description: string(r, "description"), area: string(r, "area", "personal"), projectId: string(r, "project_id") || undefined, priority: r.priority as Task["priority"], status: r.status as Task["status"], scheduledDate: string(r, "scheduled_date"), dueDate: string(r, "due_date") || toKoreaLocal(string(r, "due_at")).slice(0, 10) || string(r, "scheduled_date"), estimatedMinutes: number(r, "estimated_minutes") });
export const fromWorkoutRow = (r: Row): Workout => ({ ...base(r), title: string(r, "title"), startedAt: toKoreaLocal(string(r, "started_at")), place: string(r, "place"), durationMinutes: number(r, "duration_minutes"), exercise: string(r, "exercise"), sets: number(r, "sets"), reps: number(r, "reps"), weightKg: number(r, "weight_kg") });
export const fromTransactionRow = (r: Row): Transaction => ({ ...base(r), happenedAt: toKoreaLocal(string(r, "happened_at")), name: string(r, "name"), merchant: string(r, "merchant"), amount: number(r, "amount"), flow: r.flow as Transaction["flow"], category: string(r, "category_label", "미분류"), account: string(r, "account_label", "미지정") });
export const fromScheduleRow = (r: Row): Schedule => ({ ...base(r), title: string(r, "title"), description: string(r, "description"), area: string(r, "area", "personal"), startedAt: toKoreaLocal(string(r, "start_at")), endedAt: toKoreaLocal(string(r, "end_at")), location: string(r, "location") });

export function storageError(error: unknown) {
  const code = error && typeof error === "object" && "code" in error ? error.code : "";
  if (code === "PGRST116") return "다른 기기에서 변경되었거나 삭제된 기록입니다. 목록을 새로고침한 뒤 다시 시도해 주세요.";
  return "서버에 저장하지 못했습니다. 입력 내용은 유지됩니다. 인터넷 연결을 확인하고 다시 시도해 주세요.";
}

export function createPlannerRepository(client: SupabaseClient, ownerId: string) {
  async function rows(table: string) {
    const result: Row[] = [];
    // PostgREST defaults to 1,000 rows; never silently truncate '전체 보기'.
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await client.from(table).select("*").eq("user_id", ownerId).is("deleted_at", null).order("created_at", { ascending: false }).order("id").range(offset, offset + 499);
      if (error) throw error;
      result.push(...(data ?? []));
      if (!data || data.length < 500) return result;
    }
  }
  async function write(kind: RecordKind, item: { id: string; updatedAt?: string }, values: Row, creating: boolean) {
    const table = tables[kind];
    const query = creating ? client.from(table).insert({ ...values, id: item.id, user_id: ownerId }) : client.from(table).update(values).eq("user_id", ownerId).eq("id", item.id).eq("updated_at", item.updatedAt ?? "");
    const { data, error } = await query.select("*").single();
    if (error) throw error;
    return data as Row;
  }
  return {
    async load(): Promise<PlannerData> {
      const [projects, tasks, workouts, transactions, schedules, preferences, notifications] = await Promise.all([
        rows("projects"), rows("tasks"), rows("workout_sessions"), rows("transactions"), rows("schedules"), rows("user_preferences"), rows("notification_settings")
      ]);
      const settings = notifications[0];
      return {
        projects: projects.filter((r) => r.status !== "archived").map(fromProjectRow), tasks: tasks.map(fromTaskRow), workouts: workouts.map(fromWorkoutRow),
        transactions: transactions.filter((r) => r.flow === "income" || r.flow === "expense").map(fromTransactionRow), schedules: schedules.map(fromScheduleRow),
        areas: Array.isArray(preferences[0]?.task_areas) ? preferences[0].task_areas.filter((s): s is string => typeof s === "string") : [],
        notifications: settings ? { enabled: Boolean(settings.enabled), times: Array.isArray(settings.reminder_times) ? settings.reminder_times.map((t) => String(t).slice(0, 5)) : [string(settings, "reminder_time", "08:00").slice(0, 5)], days: settings.days_of_week as number[] } : defaultNotifications
      };
    },
    saveProject: async (v: Project, creating: boolean) => fromProjectRow(await write("project", v, { name: v.name, description: v.description, priority: v.priority, status: v.status, progress: v.progress, end_date: v.dueDate || null }, creating)),
    saveTask: async (v: Task, creating: boolean) => fromTaskRow(await write("task", v, { title: v.title, description: v.description, area: v.area, project_id: v.projectId || null, priority: v.priority, status: v.status, scheduled_date: v.scheduledDate || null, due_date: v.dueDate || null, estimated_minutes: v.estimatedMinutes }, creating)),
    saveWorkout: async (v: Workout, creating: boolean) => fromWorkoutRow(await write("workout", v, { title: v.title, started_at: toKoreaInstant(v.startedAt), place: v.place, duration_minutes: v.durationMinutes, exercise: v.exercise, sets: v.sets, reps: v.reps, weight_kg: v.weightKg }, creating)),
    saveTransaction: async (v: Transaction, creating: boolean) => fromTransactionRow(await write("transaction", v, { happened_at: toKoreaInstant(v.happenedAt), name: v.name, merchant: v.merchant, amount: v.amount, flow: v.flow, category_label: v.category, account_label: v.account }, creating)),
    saveSchedule: async (v: Schedule, creating: boolean) => fromScheduleRow(await write("schedule", v, { title: v.title, description: v.description, area: v.area, start_at: toKoreaInstant(v.startedAt), end_at: toKoreaInstant(v.endedAt), location: v.location }, creating)),
    async remove(kind: RecordKind, item: { id: string; updatedAt?: string }) {
      const { error } = await client.from(tables[kind]).delete().eq("user_id", ownerId).eq("id", item.id).eq("updated_at", item.updatedAt ?? "").select("id").single();
      if (error) throw error;
    },
    async saveAreas(areas: string[]) {
      const { error } = await client.from("user_preferences").upsert({ user_id: ownerId, task_areas: areas }, { onConflict: "user_id" }).select("id").single();
      if (error) throw error;
    },
    async saveNotifications(v: NotificationPreferences) {
      const { error } = await client.from("notification_settings").upsert({ user_id: ownerId, enabled: v.enabled, reminder_time: v.times[0], reminder_times: v.times, days_of_week: v.days }, { onConflict: "user_id" }).select("id").single();
      if (error) throw error;
    }
  };
}

export type PlannerRepository = ReturnType<typeof createPlannerRepository>;
