import { z, type ZodError } from "zod";

function isValidDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

const dateValue = z.string().refine(isValidDate, "날짜를 확인해 주세요.");
const dateTimeLocalValue = z.string().refine((value) => {
  const match = value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/);
  return Boolean(match && isValidDate(match[1]) && Number(match[2]) < 24 && Number(match[3]) < 60);
}, "날짜와 시간을 확인해 주세요.");
const priorityValue = z.enum(["P1", "P2", "P3", "P4"]);

export const loginSchema = z.object({
  email: z.string().trim().email("올바른 이메일을 입력해 주세요."),
  password: z.string().min(8, "비밀번호는 8자 이상이어야 합니다.")
});

export const taskSchema = z.object({
  title: z.string().trim().min(1, "할 일 제목을 입력해 주세요."),
  description: z.string().trim().min(1, "할 일 상세 내용을 입력해 주세요."),
  projectId: z.string().trim().transform((value) => value || undefined),
  priority: priorityValue,
  scheduledDate: dateValue,
  dueDate: dateValue.optional(),
  estimatedMinutes: z.coerce.number().int("예상 시간은 정수로 입력해 주세요.").positive("예상 시간은 1분 이상이어야 합니다.").max(10080, "예상 시간은 7일 이하여야 합니다.")
});

export const projectSchema = z.object({
  name: z.string().trim().min(1, "프로젝트 이름을 입력해 주세요."),
  description: z.string().trim().min(1, "프로젝트 설명을 입력해 주세요."),
  priority: priorityValue,
  dueDate: dateValue
});

export const workoutSchema = z.object({
  title: z.string().trim().min(1, "운동명을 입력해 주세요."),
  startedAt: dateTimeLocalValue,
  place: z.string().trim().min(1, "운동 장소를 입력해 주세요."),
  durationMinutes: z.coerce.number().int().positive("운동 시간은 1분 이상이어야 합니다.").max(1440, "운동 시간은 24시간 이하여야 합니다."),
  exercise: z.string().trim().min(1, "운동 종목을 입력해 주세요."),
  sets: z.coerce.number().int().positive("세트 수는 1 이상이어야 합니다.").max(100, "세트 수를 확인해 주세요."),
  reps: z.coerce.number().int().positive("횟수는 1 이상이어야 합니다.").max(10000, "횟수를 확인해 주세요."),
  weightKg: z.coerce.number().nonnegative("중량은 0 이상이어야 합니다.").max(2000, "중량을 확인해 주세요.")
});

export const transactionSchema = z.object({
  happenedAt: dateTimeLocalValue,
  flow: z.enum(["income", "expense"]),
  name: z.string().trim().min(1, "거래 내역을 입력해 주세요."),
  merchant: z.string().trim().min(1, "사용처를 입력해 주세요."),
  amount: z.coerce.number().positive("금액은 0원보다 커야 합니다.").max(999999999999.99, "금액을 확인해 주세요."),
  category: z.string().trim().min(1, "카테고리를 선택해 주세요."),
  account: z.string().trim().min(1, "금융 계좌를 선택해 주세요.")
});

export function formDataValues(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

export function firstValidationError(error: ZodError) {
  return error.issues[0]?.message ?? "입력값을 확인해 주세요.";
}
