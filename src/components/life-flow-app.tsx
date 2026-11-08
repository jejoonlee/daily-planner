"use client";

import { FormEvent, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { PasswordRecovery } from "./password-recovery";
import { ThemeControls } from "./theme-controls";
import { initialProjects, initialTasks, initialTransactions, initialWorkouts } from "@/lib/sample-data";
import { getSupabaseBrowserClient, hasSupabaseConfig } from "@/lib/supabase-client";
import { taskAreaLabel, useTaskAreas } from "@/lib/task-areas";
import { createPlannerRepository, defaultNotifications, storageError, type PlannerRepository } from "@/lib/planner-repository";
import { PushSettings } from "./push-settings";
import type { ModalName, PageName, Priority, Project, Schedule, Task, TaskArea, TaskStatus, Transaction, Workout } from "@/lib/types";
import { firstValidationError, formDataValues, loginSchema, projectSchema, scheduleSchema, taskSchema, transactionSchema, workoutSchema } from "@/lib/validation";

const navigation: Array<{ page: PageName; icon: string; label: string }> = [
  { page: "dashboard", icon: "⌂", label: "홈" },
  { page: "tasks", icon: "✓", label: "할 일" },
  { page: "workouts", icon: "◇", label: "운동" },
  { page: "money", icon: "₩", label: "가계부" },
  { page: "settings", icon: "⚙", label: "설정" }
];

const pageTitles: Record<PageName, string> = {
  dashboard: "대시보드",
  tasks: "할 일",
  workouts: "운동 관리",
  money: "가계부",
  settings: "설정"
};

const priorityLabel: Record<Priority, string> = {
  P1: "P1 · 긴급",
  P2: "P2 · 중요",
  P3: "P3 · 보통",
  P4: "P4 · 낮음"
};

const statusLabel: Record<TaskStatus, string> = {
  todo: "할 일",
  doing: "진행 중",
  done: "완료"
};

const projectStatusLabel: Record<ProjectStatus, string> = {
  ready: "준비",
  doing: "진행 중",
  done: "완료"
};

const APP_TIME_ZONE = "Asia/Seoul";
type ProjectStatus = Project["status"];
type DetailItem = { kind: "project" | "task" | "workout" | "transaction" | "schedule"; id: string } | null;

function authErrorMessage(code?: string, status?: number) {
  if (code === "email_not_confirmed") return "이메일 인증이 필요합니다. 가입 확인 메일의 인증 링크를 눌러 주세요.";
  if (status === 429 || code === "over_email_send_rate_limit") return "요청이 많습니다. 잠시 기다린 뒤 다시 시도해 주세요.";
  if (code === "weak_password") return "더 강한 비밀번호를 사용해 주세요. 영문 대소문자, 숫자, 기호를 조합해 주세요.";
  if (code === "signup_disabled") return "현재 회원가입이 비활성화되어 있습니다. 관리자에게 문의해 주세요.";
  if (code === "email_address_not_authorized") return "현재 메일 발송 설정에서는 이 이메일로 가입할 수 없습니다. 관리자에게 문의해 주세요.";
  if (code === "invalid_credentials" || code === "user_already_exists") return "이메일 또는 비밀번호를 확인해 주세요. 이미 가입했다면 로그인해 주세요.";
  if (status && status >= 500) return "인증 서버에서 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
  return "요청을 처리하지 못했습니다. 이메일과 비밀번호를 확인하고 다시 시도해 주세요.";
}

function uid() {
  return crypto.randomUUID();
}

function won(value: number) {
  return `${new Intl.NumberFormat("ko-KR").format(Math.abs(value))}원`;
}

function signedWon(value: number) {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${won(value)}`;
}

function transactionValue(transaction: Transaction) {
  return transaction.flow === "income" ? transaction.amount : -transaction.amount;
}

function displayDate(value: string) {
  const localDate = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:T\d{2}:\d{2})?$/);
  if (localDate) return `${Number(localDate[2])}월 ${Number(localDate[3])}일`;
  return new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric", timeZone: APP_TIME_ZONE }).format(new Date(value));
}

function shiftMonth(value: string, amount: number) {
  const [year, month] = value.split("-").map(Number);
  const shifted = new Date(year, month - 1 + amount, 1);
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(value: string) {
  const [year, month] = value.split("-").map(Number);
  return `${year}년 ${month}월`;
}

function dateKeyInTimeZone(date: Date, timeZone = APP_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function shiftDate(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}-${String(shifted.getUTCDate()).padStart(2, "0")}`;
}

function startOfWeek(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return shiftDate(value, -((weekday + 6) % 7));
}

function monthEnd(value: string) {
  const [year, month] = value.split("-").map(Number);
  return `${value}-${new Date(Date.UTC(year, month, 0)).getUTCDate()}`;
}

function dateTimeInMonth(month: string, day: number, time: string) {
  return `${month}-${String(day).padStart(2, "0")}T${time}`;
}

function fullDateLabel(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return `${year}년 ${month}월 ${day}일`;
}

function yearsAround(value: string) {
  const selectedYear = Number(value.slice(0, 4));
  return Array.from({ length: 101 }, (_, index) => selectedYear - 50 + index);
}

export function LifeFlowApp() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const demoAuthEnabled = process.env.NODE_ENV === "test" || (process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_ALLOW_DEMO_LOGIN === "true");
  const [todayDate, setTodayDate] = useState(() => dateKeyInTimeZone(new Date()));
  const currentMonth = todayDate.slice(0, 7);
  const [authenticated, setAuthenticated] = useState(false);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(process.env.NODE_ENV === "test" || !hasSupabaseConfig);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authNotice, setAuthNotice] = useState("");
  const [recoveryMode, setRecoveryMode] = useState<"forgot" | "reset" | null>(null);
  const [formError, setFormError] = useState("");
  const [page, setPage] = useState<PageName>("dashboard");
  const [modal, setModal] = useState<ModalName>(null);
  const [detailItem, setDetailItem] = useState<DetailItem>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [projects, setProjects] = useState<Project[]>(() => supabase ? [] : initialProjects);
  const [tasks, setTasks] = useState(() => {
    if (supabase) return [] as Task[];
    const scheduledOffsets = [-2, -2, -1, 0];
    const dueOffsets = [-2, -1, 0, 0];
    return initialTasks.map((task, index) => ({
      ...task,
      scheduledDate: shiftDate(todayDate, scheduledOffsets[index] ?? 0),
      dueDate: shiftDate(todayDate, dueOffsets[index] ?? 0)
    }));
  });
  const [workouts, setWorkouts] = useState(() => supabase ? [] as Workout[] : initialWorkouts.map((workout, index) => ({ ...workout, startedAt: `${shiftDate(todayDate, -2 - index)}T19:00` })));
  const [transactions, setTransactions] = useState(() => {
    if (supabase) return [] as Transaction[];
    const previousMonth = shiftMonth(currentMonth, -1);
    const dates = [
      dateTimeInMonth(currentMonth, 25, "09:00"),
      dateTimeInMonth(currentMonth, 26, "12:31"),
      dateTimeInMonth(currentMonth, 25, "19:10"),
      dateTimeInMonth(previousMonth, 25, "09:00"),
      dateTimeInMonth(previousMonth, 5, "10:00"),
      dateTimeInMonth(previousMonth, 18, "18:40")
    ];
    return initialTransactions.map((transaction, index) => ({ ...transaction, happenedAt: dates[index] ?? transaction.happenedAt }));
  });
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [serverAreas, setServerAreas] = useState<string[]>([]);
  const [notificationPreferences, setNotificationPreferences] = useState(defaultNotifications);
  const [loadedOwner, setLoadedOwner] = useState<string | null>(null);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const mutationLock = useRef(false);
  const currentOwner = useRef(accountId);
  const repository = useMemo(() => supabase && accountId ? createPlannerRepository(supabase, accountId) : null, [supabase, accountId]);
  const [taskView, setTaskView] = useState<"week" | "month" | "kanban">("week");
  const { areas: taskAreas, addArea: addLocalTaskArea } = useTaskAreas(accountId ?? "demo", [...serverAreas, ...tasks.map((task) => task.area)]);
  const [selectedTaskArea, setSelectedTaskArea] = useState<"all" | TaskArea>("all");
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedWeekStart, setSelectedWeekStart] = useState(() => startOfWeek(todayDate));
  const [movingTaskId, setMovingTaskId] = useState<string | null>(null);
  const [movingProjectId, setMovingProjectId] = useState<string | null>(null);
  const [activeTaskDropTarget, setActiveTaskDropTarget] = useState<string | null>(null);
  const [activeProjectDropTarget, setActiveProjectDropTarget] = useState<ProjectStatus | null>(null);
  const [dateFrom, setDateFrom] = useState(`${currentMonth}-01`);
  const [dateTo, setDateTo] = useState(() => monthEnd(currentMonth));
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const previousMonth = useRef(currentMonth);

  const closeModal = useCallback(() => {
    setModal(null);
    setEditingId(null);
    setFormError("");
  }, []);

  const closeDetail = useCallback(() => setDetailItem(null), []);

  useEffect(() => { currentOwner.current = accountId; }, [accountId]);

  useEffect(() => {
    if (!repository || !accountId) return;
    let active = true;
    void repository.load().then((data) => {
      if (!active) return;
      setProjects(data.projects); setTasks(data.tasks); setWorkouts(data.workouts);
      setTransactions(data.transactions); setSchedules(data.schedules); setServerAreas(data.areas);
      setNotificationPreferences(data.notifications); setLoadedOwner(accountId); setLoadError("");
    }).catch(() => {
      if (active) setLoadError("기록을 불러오지 못했습니다. 인터넷 연결을 확인하고 다시 시도해 주세요.");
    });
    return () => { active = false; };
  }, [repository, accountId, reloadKey]);

  function persist<T>(operation: (repo: PlannerRepository) => Promise<T>, success: (value?: T) => void) {
    if (!supabase) { success(); return; }
    if (!repository || loadedOwner !== accountId || mutationLock.current) return;
    const owner = accountId;
    mutationLock.current = true;
    setSaving(true); setFormError("");
    void operation(repository).then((value) => {
      if (currentOwner.current === owner) success(value);
    }).catch((error: unknown) => {
      if (currentOwner.current !== owner) return;
      const message = storageError(error);
      setFormError(message); setToast(message);
    }).finally(() => { mutationLock.current = false; setSaving(false); });
  }

  function addTaskArea(name: string): string | Promise<string> {
    if (!repository) return addLocalTaskArea(name);
    const normalized = name.normalize("NFKC").trim();
    if (!normalized || normalized.length > 32) throw new Error("새 구분은 1~32자로 입력해 주세요.");
    if (["전체", "all", "church", ...taskAreas, ...taskAreas.map(taskAreaLabel)].some((v) => v.toLocaleLowerCase() === normalized.toLocaleLowerCase())) throw new Error("이미 있는 구분입니다. 다른 이름을 입력해 주세요.");
    const next = [...new Set([...serverAreas, normalized])];
    const owner = accountId;
    return repository.saveAreas(next).then(() => {
      if (currentOwner.current !== owner) throw new Error("계정이 변경되었습니다. 다시 시도해 주세요.");
      setServerAreas(next);
      return normalized;
    }).catch(() => { throw new Error("구분을 서버에 저장하지 못했습니다. 다시 시도해 주세요."); });
  }

  useEffect(() => {
    const updateDate = () => setTodayDate((current) => {
      const next = dateKeyInTimeZone(new Date());
      return next === current ? current : next;
    });
    const interval = window.setInterval(updateDate, 60_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (previousMonth.current === currentMonth) return;
    previousMonth.current = currentMonth;
    setSelectedMonth(currentMonth);
    setSelectedWeekStart(startOfWeek(todayDate));
    setDateFrom(`${currentMonth}-01`);
    setDateTo(monthEnd(currentMonth));
  }, [currentMonth, todayDate]);

  useEffect(() => {
    if (!supabase) return;

    let active = true;
    let authRevision = 0;
    function restoreSession() {
      const revision = authRevision;
      void supabase!.auth.getSession().then(({ data, error }) => {
      if (!active || revision !== authRevision) return;
      if (error) setAuthError("로그인 상태를 확인하지 못했습니다. 다시 시도해 주세요.");
      if (window.location.hash === "#reset-password") {
        if (data.session) setRecoveryMode("reset");
        else setAuthError("재설정 링크가 만료되었습니다. 비밀번호 찾기에서 메일을 다시 요청해 주세요.");
      }
      setAuthenticated(Boolean(data.session));
      setAccountId(data.session?.user.id ?? null);
      setAuthReady(true);
    }).catch(() => {
      if (active && revision === authRevision) {
        setAuthError("로그인 상태를 확인하지 못했습니다. 다시 시도해 주세요.");
        setAuthReady(true);
      }
    });
    }
    restoreSession();
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (active) {
        authRevision++;
        if (event === "PASSWORD_RECOVERY" && session) {
          setRecoveryMode("reset");
          window.history.replaceState(null, "", `${window.location.pathname}#reset-password`);
        }
        if (event === "SIGNED_OUT") {
          setRecoveryMode(null); setLoadedOwner(null); setModal(null); setDetailItem(null); setEditingId(null);
        }
        setAuthenticated(Boolean(session));
        setAccountId(session?.user.id ?? null);
        setAuthReady(true);
      }
    });
    const onVisible = () => { if (document.visibilityState === "visible") restoreSession(); };
    const onPageShow = (event: PageTransitionEvent) => { if (event.persisted) restoreSession(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onPageShow);

    return () => {
      active = false;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onPageShow);
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const detailProject = detailItem?.kind === "project" ? projects.find((project) => project.id === detailItem.id) : undefined;
  const detailTask = detailItem?.kind === "task" ? tasks.find((task) => task.id === detailItem.id) : undefined;
  const detailWorkout = detailItem?.kind === "workout" ? workouts.find((workout) => workout.id === detailItem.id) : undefined;
  const detailTransaction = detailItem?.kind === "transaction" ? transactions.find((transaction) => transaction.id === detailItem.id) : undefined;
  const detailSchedule = detailItem?.kind === "schedule" ? schedules.find((schedule) => schedule.id === detailItem.id) : undefined;
  const todaySchedules = schedules.filter((schedule) => schedule.startedAt.slice(0, 10) === todayDate);
  const todayTasks = tasks.filter((task) => task.scheduledDate === todayDate && task.status !== "done");
  const visibleTasks = selectedTaskArea === "all" ? tasks : tasks.filter((task) => task.area === selectedTaskArea);

  const projectById = useMemo(
    () => Object.fromEntries(projects.map((project) => [project.id, project])),
    [projects]
  );

  const transactionCategories = useMemo(
    () => Array.from(new Set(transactions.map((transaction) => transaction.category))).sort(),
    [transactions]
  );

  const filteredTransactions = transactions.filter((transaction) => {
    const date = transaction.happenedAt.slice(0, 10);
    const isInPeriod = (!dateFrom || date >= dateFrom) && (!dateTo || date <= dateTo);
    const isInCategory = selectedCategories.length === 0 || selectedCategories.includes(transaction.category);
    return isInPeriod && isInCategory;
  });

  const monthlyMoney = useMemo(() => {
    function summarize(prefix: string) {
      const monthTransactions = transactions.filter((transaction) => transaction.happenedAt.startsWith(prefix));
      const income = monthTransactions.filter((transaction) => transaction.flow === "income").reduce((sum, transaction) => sum + transaction.amount, 0);
      const expense = monthTransactions.filter((transaction) => transaction.flow === "expense").reduce((sum, transaction) => sum + transaction.amount, 0);
      return { income, expense, net: income - expense };
    }

    const previous = summarize(shiftMonth(currentMonth, -1));
    const current = summarize(currentMonth);
    return { previous, current, expenseDifference: current.expense - previous.expense };
  }, [currentMonth, transactions]);

  function navigate(nextPage: PageName) {
    setPage(nextPage);
    closeModal();
    closeDetail();
  }

  function endTaskMove() {
    setMovingTaskId(null);
    setActiveTaskDropTarget(null);
  }

  function endProjectMove() {
    setMovingProjectId(null);
    setActiveProjectDropTarget(null);
  }

  function startTaskMove(taskId: string) {
    const task = tasks.find((item) => item.id === taskId);
    setMovingTaskId(taskId);
    setActiveTaskDropTarget(task ? (taskView === "kanban" ? `status:${task.status}` : `date:${task.scheduledDate}`) : null);
  }

  function startProjectMove(projectId: string) {
    const project = projects.find((item) => item.id === projectId);
    setMovingProjectId(projectId);
    setActiveProjectDropTarget(project?.status ?? null);
  }

  function taskDropTargetAtPoint(clientX: number, clientY: number) {
    const target = document.elementFromPoint?.(clientX, clientY)?.closest<HTMLElement>("[data-task-date], [data-task-status]");
    if (target?.dataset.taskDate) return { element: target, key: `date:${target.dataset.taskDate}` };
    if (target?.dataset.taskStatus) return { element: target, key: `status:${target.dataset.taskStatus}` };
    return null;
  }

  function projectDropTargetAtPoint(clientX: number, clientY: number) {
    const target = document.elementFromPoint?.(clientX, clientY)?.closest<HTMLElement>("[data-project-status]");
    return target?.dataset.projectStatus ? { element: target, status: target.dataset.projectStatus as ProjectStatus } : null;
  }

  function hoverTaskDropTarget(clientX: number, clientY: number) {
    setActiveTaskDropTarget(taskDropTargetAtPoint(clientX, clientY)?.key ?? null);
  }

  function hoverProjectDropTarget(clientX: number, clientY: number) {
    setActiveProjectDropTarget(projectDropTargetAtPoint(clientX, clientY)?.status ?? null);
  }

  function moveTaskToDate(date: string, draggedTaskId?: string) {
    const taskId = draggedTaskId || movingTaskId;
    if (!taskId) return;
    endTaskMove();
    const task = tasks.find((item) => item.id === taskId);
    if (!task) return;
    const next = { ...task, scheduledDate: date };
    persist((repo) => repo.saveTask(next, false), (saved) => {
      setTasks((current) => current.map((item) => item.id === taskId ? saved ?? next : item));
      setToast(`${displayDate(date)}로 할 일을 옮겼습니다.`);
    });
  }

  function moveTaskToStatus(status: TaskStatus, draggedTaskId?: string) {
    const taskId = draggedTaskId || movingTaskId;
    if (!taskId) return;
    endTaskMove();
    const task = tasks.find((item) => item.id === taskId);
    if (!task) return;
    const next = { ...task, status };
    persist((repo) => repo.saveTask(next, false), (saved) => {
      setTasks((current) => current.map((item) => item.id === taskId ? saved ?? next : item));
      setToast(`‘${statusLabel[status]}’ 영역으로 옮겼습니다.`);
    });
  }

  function moveProjectToStatus(status: ProjectStatus, draggedProjectId?: string) {
    const projectId = draggedProjectId || movingProjectId;
    if (!projectId) return;
    endProjectMove();
    const project = projects.find((item) => item.id === projectId);
    if (!project) return;
    const next = { ...project, status };
    persist((repo) => repo.saveProject(next, false), (saved) => {
      setProjects((current) => current.map((item) => item.id === projectId ? saved ?? next : item));
      setToast(`프로젝트를 ‘${projectStatusLabel[status]}’ 영역으로 옮겼습니다.`);
    });
  }

  function dropTaskAtPoint(clientX: number, clientY: number, taskId: string) {
    const target = taskDropTargetAtPoint(clientX, clientY)?.element;
    const task = tasks.find((item) => item.id === taskId);
    if (target?.dataset.taskDate === task?.scheduledDate || target?.dataset.taskStatus === task?.status) {
      endTaskMove();
      return true;
    }
    if (target?.dataset.taskDate) {
      moveTaskToDate(target.dataset.taskDate, taskId);
      return true;
    }
    if (target?.dataset.taskStatus) {
      moveTaskToStatus(target.dataset.taskStatus as TaskStatus, taskId);
      return true;
    }
    return false;
  }

  function dropProjectAtPoint(clientX: number, clientY: number, projectId: string) {
    const target = projectDropTargetAtPoint(clientX, clientY)?.element;
    const project = projects.find((item) => item.id === projectId);
    if (target?.dataset.projectStatus === project?.status) {
      endProjectMove();
      return true;
    }
    if (target?.dataset.projectStatus) {
      moveProjectToStatus(target.dataset.projectStatus as ProjectStatus, projectId);
      return true;
    }
    return false;
  }

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (authBusy) return;
    setAuthError("");
    setAuthNotice("");
    const form = event.currentTarget;
    const values = formDataValues(new FormData(form));
    const parsed = loginSchema.safeParse(values);
    if (!parsed.success) {
      setAuthError(firstValidationError(parsed.error));
      return;
    }
    if (authMode === "signup" && values.passwordConfirm !== parsed.data.password) {
      setAuthError("비밀번호가 일치하지 않습니다.");
      return;
    }
    if (demoAuthEnabled && !supabase && authMode === "login") {
      setAuthenticated(true);
      return;
    }
    if (!supabase) {
      setAuthError("Supabase 환경변수를 먼저 설정해 주세요.");
      return;
    }

    setAuthBusy(true);
    try {
      if (authMode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          ...parsed.data,
          options: { emailRedirectTo: `${window.location.origin}/` }
        });
        if (error) {
          setAuthError(authErrorMessage(error.code, error.status));
          return;
        }
        form.reset();
        if (data.session) {
          setAccountId(data.session.user.id);
          setAuthenticated(true);
        } else {
          setAuthMode("login");
          setAuthNotice("가입 확인 메일을 확인해 주세요. 이메일의 인증 링크를 누른 뒤 로그인할 수 있습니다. 메일이 없으면 스팸함을 확인해 주세요. 이미 가입한 이메일이라면 기존 비밀번호로 로그인해 주세요.");
        }
        return;
      }
      const { error } = await supabase.auth.signInWithPassword(parsed.data);
      if (error) setAuthError(authErrorMessage(error.code, error.status));
    } catch {
      setAuthError("로그인 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setAuthBusy(false);
    }
  }

  async function signOut() {
    try {
      if (supabase) {
        // Stop this installation's pushes before removing its session.
        if (accountId && "serviceWorker" in navigator) {
          const registration = await navigator.serviceWorker.getRegistration();
          const subscription = await registration?.pushManager.getSubscription();
          if (subscription) {
            const { error } = await supabase.from("push_subscriptions").update({ active: false }).eq("user_id", accountId).eq("endpoint", subscription.endpoint);
            if (error) throw error;
            await subscription.unsubscribe();
          }
        }
        const { error } = await supabase.auth.signOut({ scope: "local" });
        if (error) throw error;
      }
      setAuthenticated(false);
      setAccountId(null);
      setLoadedOwner(null);
      setProjects([]); setTasks([]); setWorkouts([]); setTransactions([]); setSchedules([]); setServerAreas([]);
      setPage("dashboard");
    } catch { setToast("로그아웃하지 못했습니다. 인터넷 연결을 확인하고 다시 시도해 주세요."); }
  }

  function openTaskDetail(id: string) {
    setDetailItem({ kind: "task", id });
  }

  function editTask(id: string) {
    setDetailItem(null);
    setEditingId(id);
    setFormError("");
    setModal("task");
  }

  function editProject(id: string) {
    setDetailItem(null);
    setEditingId(id);
    setFormError("");
    setModal("project");
  }

  function editWorkout(id: string) {
    setDetailItem(null);
    setEditingId(id);
    setFormError("");
    setModal("workout");
  }

  function editTransaction(id: string) {
    setDetailItem(null);
    setEditingId(id);
    setFormError("");
    setModal("money");
  }

  function deleteTask(id: string) {
    const item = tasks.find((task) => task.id === id);
    if (!item) return;
    persist((repo) => repo.remove("task", item), () => {
      setTasks((current) => current.filter((task) => task.id !== id));
      endTaskMove(); closeDetail(); setToast("할 일을 삭제했습니다.");
    });
  }

  function deleteProject(id: string) {
    const item = projects.find((project) => project.id === id);
    if (!item) return;
    persist(async (repo) => { await repo.remove("project", item); return repo.load(); }, (saved) => {
      setProjects((current) => current.filter((project) => project.id !== id));
      setTasks((current) => saved?.tasks ?? current.map((task) => task.projectId === id ? { ...task, projectId: undefined } : task));
      endProjectMove(); endTaskMove(); closeDetail(); setToast("프로젝트를 삭제했습니다. 연결된 할 일은 유지됩니다.");
    });
  }

  function deleteWorkout(id: string) {
    const item = workouts.find((workout) => workout.id === id);
    if (!item) return;
    persist((repo) => repo.remove("workout", item), () => {
      setWorkouts((current) => current.filter((workout) => workout.id !== id));
      closeDetail(); setToast("운동 기록을 삭제했습니다.");
    });
  }

  function deleteTransaction(id: string) {
    const item = transactions.find((transaction) => transaction.id === id);
    if (!item) return;
    persist((repo) => repo.remove("transaction", item), () => {
    const remaining = transactions.filter((transaction) => transaction.id !== id);
    setTransactions((current) => current.filter((transaction) => transaction.id !== id));
    setSelectedCategories((current) => current.filter((category) => remaining.some((transaction) => transaction.category === category)));
    closeDetail();
    setToast("가계부 거래를 삭제했습니다.");
    });
  }

  function submitTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = taskSchema.safeParse(formDataValues(new FormData(event.currentTarget)));
    if (!parsed.success) {
      setFormError(firstValidationError(parsed.error));
      return;
    }
    const data = parsed.data;
    if (!taskAreas.includes(data.area)) {
      setFormError("목록에서 구분을 선택하거나 새 구분을 추가해 주세요.");
      return;
    }
    const task: Task = {
      ...tasks.find((item) => item.id === editingId),
      id: editingId ?? uid(),
      title: data.title,
      description: data.description,
      area: data.area,
      projectId: data.area === "company" ? data.projectId : undefined,
      priority: data.priority,
      status: tasks.find((item) => item.id === editingId)?.status ?? "todo",
      scheduledDate: data.scheduledDate,
      dueDate: data.dueDate ?? data.scheduledDate,
      estimatedMinutes: data.estimatedMinutes
    };
    persist((repo) => repo.saveTask(task, !editingId), (saved) => {
      setTasks((current) => editingId ? current.map((item) => item.id === editingId ? saved ?? task : item) : [saved ?? task, ...current]);
      closeModal(); setToast(editingId ? "할 일을 수정했습니다." : "새 할 일을 저장했습니다.");
    });
  }

  function submitProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = projectSchema.safeParse(formDataValues(new FormData(event.currentTarget)));
    if (!parsed.success) {
      setToast(firstValidationError(parsed.error));
      return;
    }
    const data = parsed.data;
    const project: Project = {
      ...projects.find((item) => item.id === editingId),
      id: editingId ?? uid(),
      name: data.name,
      description: data.description,
      priority: data.priority,
      status: projects.find((item) => item.id === editingId)?.status ?? "ready",
      progress: projects.find((item) => item.id === editingId)?.progress ?? 0,
      dueDate: data.dueDate
    };
    persist((repo) => repo.saveProject(project, !editingId), (saved) => {
      setProjects((current) => editingId ? current.map((item) => item.id === editingId ? saved ?? project : item) : [saved ?? project, ...current]);
      closeModal(); setToast(editingId ? "프로젝트를 수정했습니다." : "새 프로젝트를 저장했습니다.");
    });
  }

  function submitWorkout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = workoutSchema.safeParse(formDataValues(new FormData(event.currentTarget)));
    if (!parsed.success) {
      setFormError(firstValidationError(parsed.error));
      return;
    }
    const data = parsed.data;
    const workout: Workout = {
      updatedAt: workouts.find((item) => item.id === editingId)?.updatedAt,
      id: editingId ?? uid(),
      title: data.title,
      startedAt: data.startedAt,
      place: data.place,
      durationMinutes: data.durationMinutes,
      exercise: data.exercise,
      sets: data.sets,
      reps: data.reps,
      weightKg: data.weightKg
    };
    persist((repo) => repo.saveWorkout(workout, !editingId), (saved) => {
      setWorkouts((current) => editingId ? current.map((item) => item.id === editingId ? saved ?? workout : item) : [saved ?? workout, ...current]);
      closeModal(); setToast(editingId ? "운동 기록을 수정했습니다." : "운동 기록을 저장했습니다.");
    });
  }

  function submitTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = transactionSchema.safeParse(formDataValues(new FormData(event.currentTarget)));
    if (!parsed.success) {
      setToast(firstValidationError(parsed.error));
      setFormError(firstValidationError(parsed.error));
      return;
    }
    const data = parsed.data;
    const transaction: Transaction = {
      updatedAt: transactions.find((item) => item.id === editingId)?.updatedAt,
      id: editingId ?? uid(),
      happenedAt: data.happenedAt,
      name: data.name,
      merchant: data.merchant,
      amount: data.amount,
      flow: data.flow,
      category: data.category,
      account: data.account
    };
    persist((repo) => repo.saveTransaction(transaction, !editingId), (saved) => {
      setTransactions((current) => editingId ? current.map((item) => item.id === editingId ? saved ?? transaction : item) : [saved ?? transaction, ...current]);
      closeModal(); setToast(editingId ? "가계부 거래를 수정했습니다." : "가계부 거래를 등록했습니다.");
    });
  }

  function submitSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = scheduleSchema.safeParse(formDataValues(new FormData(event.currentTarget)));
    if (!parsed.success) { setFormError(firstValidationError(parsed.error)); return; }
    const value: Schedule = { ...parsed.data, id: editingId ?? uid(), updatedAt: schedules.find((item) => item.id === editingId)?.updatedAt };
    persist((repo) => repo.saveSchedule(value, !editingId), (saved) => {
      setSchedules((current) => editingId ? current.map((item) => item.id === editingId ? saved ?? value : item) : [...current, saved ?? value]);
      closeModal(); setToast(editingId ? "일정을 수정했습니다." : "일정을 저장했습니다.");
    });
  }

  if (!authReady) {
    return <main className="login-page"><div className="login-card" role="status">로그인 상태를 확인하고 있습니다.</div></main>;
  }

  if (recoveryMode) {
    return <PasswordRecovery key={recoveryMode} client={supabase} mode={recoveryMode} onClose={() => { window.history.replaceState(null, "", window.location.pathname); setRecoveryMode(null); setAuthMode("login"); setAuthError(""); }} />;
  }

  if (!authenticated) {
    return (
      <main className="login-page">
        <div className="login-theme"><ThemeControls /></div>
        <form className="login-card" onSubmit={submitLogin}>
          <div className="brand"><span className="brand-mark">L</span><span>Life Flow</span></div>
          <div>
            <h1>{authMode === "signup" ? "Life Flow 시작하기" : "다시 오신 것을 환영해요"}</h1>
          </div>
          {!supabase && !demoAuthEnabled && <p className="form-error" role="alert">Supabase 환경변수를 설정해야 로그인할 수 있습니다.</p>}
          <label><span>이메일</span><input name="email" type="email" autoComplete="email" disabled={authBusy} required /></label>
          <label><span>비밀번호</span><input name="password" type="password" autoComplete={authMode === "signup" ? "new-password" : "current-password"} minLength={8} disabled={authBusy} required /></label>
          {authMode === "signup" && <><p>비밀번호는 8자 이상으로 입력해 주세요.</p><label><span>비밀번호 확인</span><input name="passwordConfirm" type="password" autoComplete="new-password" minLength={8} disabled={authBusy} required /></label></>}
          {authError && <p className="form-error" role="alert">{authError}</p>}
          {authNotice && <p role="status">{authNotice}</p>}
          <button className="primary-button full-button" type="submit" disabled={authBusy || (!supabase && (!demoAuthEnabled || authMode === "signup"))}>{authBusy ? "처리 중…" : authMode === "signup" ? "회원가입" : "로그인"}</button>
          <button className="text-button" type="button" disabled={authBusy} onClick={(event) => {
            event.currentTarget.form?.reset();
            setAuthMode(authMode === "login" ? "signup" : "login");
            setAuthError("");
            setAuthNotice("");
          }}>{authMode === "login" ? "처음이신가요? 회원가입" : "이미 계정이 있나요? 로그인"}</button>
          <button className="text-button" type="button" disabled={authBusy} onClick={() => setRecoveryMode("forgot")}>비밀번호 찾기</button>
        </form>
      </main>
    );
  }

  if (supabase && loadedOwner !== accountId) {
    return <main className="login-page"><div className="login-card"><p role={loadError ? "alert" : "status"}>{loadError || "내 기록을 불러오고 있습니다."}</p>{loadError && <button className="primary-button" onClick={() => { setLoadError(""); setReloadKey((key) => key + 1); }}>다시 불러오기</button>}<button className="text-button" onClick={signOut}>로그아웃</button></div></main>;
  }

  return (
    <div className="app-shell" aria-busy={saving} onKeyDownCapture={(event) => { if (saving) { event.preventDefault(); event.stopPropagation(); } }}>
      {saving && <div className="saving-overlay" role="status">서버에 저장하고 있습니다…</div>}
      <nav className="app-navigation" aria-label="주 메뉴">
        <div className="brand navigation-brand"><span className="brand-mark">L</span><span>Life Flow</span></div>
        <div className="navigation-items">
          {navigation.map((item) => (
            <button
              key={item.page}
              type="button"
              className={page === item.page ? "navigation-button active" : "navigation-button"}
              onClick={() => navigate(item.page)}
              aria-current={page === item.page ? "page" : undefined}
            >
              <span className="navigation-icon" aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
        <div className="notebook-mark" aria-hidden="true"><span>나의 기록장</span><span>한 장씩, 나의 속도로.</span></div>
      </nav>

      <main className="app-main">
        <header className="app-header">
          <span className="header-path"><span>나의 기록장</span><span aria-hidden="true">/</span>{pageTitles[page]}</span>
          <div className="header-tools"><span className="header-date">{fullDateLabel(todayDate)}</span><ThemeControls /></div>
        </header>
        <div className="page-content">
          {toast && <div className="toast" role="status">{toast}</div>}

          {page === "dashboard" && (
            <section>
              <PageHeading
                title="좋은 아침이에요"
                actions={<><button className="secondary-button" onClick={() => setModal("money")}>가계부 입력</button><button className="primary-button" onClick={() => setModal("intake")}>오늘 계획 입력</button></>}
              />
              <div className="dashboard-grid">
                <Panel title="오늘 일정" action={<button className="text-button" onClick={() => setModal("schedule")}>+ 일정</button>}>
                  {todaySchedules.length === 0 && <p className="empty-records">오늘 등록된 일정이 없습니다.</p>}
                  {todaySchedules.map((schedule) => <button type="button" className="task-button" key={schedule.id} onClick={() => setDetailItem({ kind: "schedule", id: schedule.id })}><strong>{schedule.startedAt.slice(11)} {schedule.title}</strong><small>{taskAreaLabel(schedule.area)} · {schedule.location}</small></button>)}
                </Panel>
                <Panel title="오늘 할 일" action={<button className="text-button" onClick={() => navigate("tasks")}>전체 보기</button>}>
                  {todayTasks.length === 0 && <p className="empty-records">오늘 예정된 할 일이 없습니다.</p>}
                  {todayTasks.map((task) => <TaskButton key={task.id} task={task} onClick={() => openTaskDetail(task.id)} />)}
                </Panel>
                <Panel title="오늘 운동" action={<button className="text-button" onClick={() => navigate("workouts")}>상세</button>}>
                  {workouts.filter((workout) => workout.startedAt.slice(0, 10) === todayDate).map((workout) => <button key={workout.id} className="task-button" onClick={() => setDetailItem({ kind: "workout", id: workout.id })}>{workout.startedAt.slice(11)} · {workout.title} · {workout.durationMinutes}분</button>)}
                </Panel>
                {!supabase && <Panel title="관심 시장" meta="샘플 시세">
                  <MarketRow name="KOSPI" value="2,742.18" />
                  <MarketRow name="S&P 500" value="5,631.22" />
                  <MarketRow name="NASDAQ" value="17,713.62" />
                </Panel>}
              </div>
              <Panel title="진행 중 프로젝트" className="wide-panel" action={<button className="text-button" onClick={() => navigate("tasks")}>전체 보기</button>}>
                <div className="project-summary-grid">
                  {projects.filter((project) => project.status === "doing").map((project) => (
                    <button key={project.id} className="project-summary" onClick={() => setDetailItem({ kind: "project", id: project.id })}>
                      <strong>{project.name}</strong><span>{priorityLabel[project.priority]} · {displayDate(project.dueDate)}</span><span className="progress"><i style={{ width: `${project.progress}%` }} /></span>
                    </button>
                  ))}
                </div>
              </Panel>
            </section>
          )}

          {page === "tasks" && (
            <section>
              <PageHeading
                title="할 일"
                actions={<><button className="secondary-button" onClick={() => setModal("project")}>+ 프로젝트</button><button className="primary-button" onClick={() => setModal("task")}>+ 할 일</button></>}
              />
              <div className="task-projects">
                <div className="section-heading">
                  <h2>프로젝트</h2>
                  <span>{projects.length}개</span>
                </div>
                {movingProjectId && <div className="move-hint" role="status"><span>옮길 영역 위에서 카드를 놓으세요.</span><button type="button" onClick={endProjectMove}>취소</button></div>}
                <ProjectKanban projects={projects} onSelect={(id) => setDetailItem({ kind: "project", id })} movingProjectId={movingProjectId} activeDropTarget={activeProjectDropTarget} onStartMove={startProjectMove} onEndMove={endProjectMove} onMoveToStatus={moveProjectToStatus} onPointerHover={hoverProjectDropTarget} onPointerDrop={dropProjectAtPoint} />
              </div>
              <div className="section-heading task-list-heading">
                <h2>할 일 보기</h2>
              </div>
              <div className="segmented task-area-filter" role="group" aria-label="할 일 구분">
                {["all", ...taskAreas].map((area) => <button key={area} type="button" className={selectedTaskArea === area ? "active" : ""} onClick={() => { endTaskMove(); setSelectedTaskArea(area); }}>{area === "all" ? "전체" : taskAreaLabel(area)}</button>)}
              </div>
              <TaskAreaAdder onAdd={addTaskArea} />
              <Panel title="전체 일정" action={<button className="text-button" onClick={() => setModal("schedule")}>+ 일정</button>}>
                {schedules.length === 0 && <p className="empty-records">등록된 일정이 없습니다.</p>}
                {[...schedules].sort((a, b) => a.startedAt.localeCompare(b.startedAt)).map((schedule) => <button type="button" className="task-button" key={schedule.id} onClick={() => setDetailItem({ kind: "schedule", id: schedule.id })}>{schedule.startedAt.replace("T", " ")} · {schedule.title}</button>)}
              </Panel>
              {movingTaskId && <div className="move-hint" role="status"><span>옮길 날짜 또는 영역 위에서 카드를 놓으세요.</span><button type="button" onClick={endTaskMove}>취소</button></div>}
              <div className="view-toolbar">
                <div className="segmented">
                  {(["week", "month", "kanban"] as const).map((view) => <button key={view} className={taskView === view ? "active" : ""} onClick={() => { endTaskMove(); setTaskView(view); }}>{view === "week" ? "주" : view === "month" ? "월" : "칸반"}</button>)}
                </div>
                {taskView === "month" ? (
                  <div className="month-controls">
                    <button type="button" onClick={() => setSelectedMonth((current) => shiftMonth(current, -1))} aria-label="이전 달">‹</button>
                    <select
                      value={selectedMonth.slice(0, 4)}
                      onChange={(event) => setSelectedMonth(`${event.target.value}-${selectedMonth.slice(5)}`)}
                      aria-label="조회할 연도"
                    >
                      {yearsAround(selectedMonth).map((year) => <option key={year} value={year}>{year}년</option>)}
                    </select>
                    <select
                      value={selectedMonth.slice(5)}
                      onChange={(event) => setSelectedMonth(`${selectedMonth.slice(0, 4)}-${event.target.value}`)}
                      aria-label="조회할 월"
                    >
                      {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => <option key={month} value={String(month).padStart(2, "0")}>{month}월</option>)}
                    </select>
                    <button type="button" onClick={() => setSelectedMonth((current) => shiftMonth(current, 1))} aria-label="다음 달">›</button>
                  </div>
                ) : taskView === "week" ? (
                  <div className="week-controls">
                    <button type="button" onClick={() => setSelectedWeekStart((current) => shiftDate(current, -7))} aria-label="이전 주">‹</button>
                    <span>{displayDate(selectedWeekStart)} – {displayDate(shiftDate(selectedWeekStart, 6))}</span>
                    <button type="button" onClick={() => setSelectedWeekStart((current) => shiftDate(current, 7))} aria-label="다음 주">›</button>
                  </div>
                ) : <span>전체 할 일</span>}
              </div>
              {taskView === "week" && <WeekView weekStart={selectedWeekStart} todayDate={todayDate} tasks={visibleTasks} movingTaskId={movingTaskId} activeDropTarget={activeTaskDropTarget} onSelect={openTaskDetail} onStartMove={startTaskMove} onEndMove={endTaskMove} onMoveToDate={moveTaskToDate} onPointerHover={hoverTaskDropTarget} onPointerDrop={dropTaskAtPoint} />}
              {taskView === "month" && <MonthView month={selectedMonth} todayDate={todayDate} tasks={visibleTasks} movingTaskId={movingTaskId} activeDropTarget={activeTaskDropTarget} onSelect={openTaskDetail} onStartMove={startTaskMove} onEndMove={endTaskMove} onMoveToDate={moveTaskToDate} onPointerHover={hoverTaskDropTarget} onPointerDrop={dropTaskAtPoint} />}
              {taskView === "kanban" && <TaskKanban tasks={visibleTasks} movingTaskId={movingTaskId} activeDropTarget={activeTaskDropTarget} onSelect={openTaskDetail} onStartMove={startTaskMove} onEndMove={endTaskMove} onMoveToStatus={moveTaskToStatus} onPointerHover={hoverTaskDropTarget} onPointerDrop={dropTaskAtPoint} />}
            </section>
          )}

          {page === "workouts" && (
            <section>
              <PageHeading title="운동 관리" actions={<button className="primary-button" onClick={() => setModal("workout")}>+ 운동 기록</button>} />
              <div className="record-card-grid">
                {workouts.length === 0 && <p className="empty-records">운동 기록이 없습니다.</p>}
                {workouts.map((workout) => <button type="button" className="record-card" key={workout.id} onClick={() => setDetailItem({ kind: "workout", id: workout.id })}><span>{displayDate(workout.startedAt)}</span><strong>{workout.title}</strong><small>{workout.place} · {workout.durationMinutes}분</small><small>{workout.exercise} · {workout.sets}세트 × {workout.reps}회 · {workout.weightKg}kg</small></button>)}
              </div>
            </section>
          )}

          {page === "money" && (
            <section>
              <PageHeading title="가계부" actions={<button className="primary-button" onClick={() => setModal("money")}>+ 거래 등록</button>} />
              <div className="money-summary-grid">
                <MoneySummary title="전월 잔액" value={monthlyMoney.previous.net} detail={`수입 ${won(monthlyMoney.previous.income)} · 지출 ${won(monthlyMoney.previous.expense)}`} />
                <MoneySummary title="이번 달 잔액" value={monthlyMoney.current.net} detail={`수입 ${won(monthlyMoney.current.income)} · 지출 ${won(monthlyMoney.current.expense)}`} />
                <MoneySummary
                  title="전월 대비 지출"
                  value={monthlyMoney.expenseDifference}
                  detail={monthlyMoney.expenseDifference > 0 ? "전월보다 더 지출했어요" : monthlyMoney.expenseDifference < 0 ? "전월보다 덜 지출했어요" : "전월과 같아요"}
                  comparison
                />
              </div>
              <div className="money-filters" aria-label="거래 필터">
                <div className="segmented" role="group" aria-label="가계부 조회 범위"><button type="button" aria-pressed={dateFrom === `${currentMonth}-01` && dateTo === monthEnd(currentMonth)} onClick={() => { setDateFrom(`${currentMonth}-01`); setDateTo(monthEnd(currentMonth)); setSelectedCategories([]); }}>이번 달</button><button type="button" aria-pressed={!dateFrom && !dateTo && selectedCategories.length === 0} onClick={() => { setDateFrom(""); setDateTo(""); setSelectedCategories([]); }}>전체 보기</button></div>
                <div className="period-filter"><label><span>시작일</span><input type="date" value={dateFrom} max={dateTo || undefined} onChange={(event) => setDateFrom(event.target.value)} /></label><span aria-hidden="true">–</span><label><span>종료일</span><input type="date" value={dateTo} min={dateFrom || undefined} onChange={(event) => setDateTo(event.target.value)} /></label></div>
                <details className="category-filter">
                  <summary>카테고리 {selectedCategories.length ? `${selectedCategories.length}개` : "전체"}</summary>
                  <div className="category-options">
                    <button type="button" className="text-button" onClick={() => setSelectedCategories([])}>전체 선택</button>
                    {transactionCategories.map((category) => <label key={category}><input type="checkbox" checked={selectedCategories.includes(category)} onChange={(event) => setSelectedCategories((current) => event.target.checked ? [...current, category] : current.filter((item) => item !== category))} />{category}</label>)}
                  </div>
                </details>
              </div>
              <Panel title="거래 내역" meta={`${filteredTransactions.length}건`}>
                {filteredTransactions.length === 0 && <p className="empty-records">선택한 조건에 해당하는 거래 내역이 없습니다.</p>}
                <div className="transaction-card-list">{filteredTransactions.map((transaction) => <button type="button" className="transaction-card" key={transaction.id} onClick={() => setDetailItem({ kind: "transaction", id: transaction.id })}><span>{displayDate(transaction.happenedAt)}</span><span><strong>{transaction.name}</strong><small>{transaction.merchant} · {transaction.category}</small></span><strong className={transaction.flow}>{signedWon(transactionValue(transaction))}</strong></button>)}</div>
              </Panel>
            </section>
          )}

          {page === "settings" && (
            <section>
              <PageHeading title="설정" />
              <section className="panel settings-panel appearance-panel" aria-label="화면 설정"><div className="panel-heading"><strong>화면 모드</strong></div><ThemeControls /></section>
              <PushSettings client={supabase} ownerId={accountId} initial={notificationPreferences} onSaved={setNotificationPreferences} />
              <section className="panel settings-panel"><strong>로그인 유지</strong><p>이 설치에서는 로그인 상태를 저장하고 자동으로 갱신합니다. 직접 로그아웃하거나 기기에서 사이트 데이터를 지우면 다시 로그인해야 합니다.</p><button className="text-button" type="button" onClick={signOut}>로그아웃</button></section>
            </section>
          )}
        </div>
      </main>

      {detailProject && <EntryModal title={detailProject.name} onClose={closeDetail}>
        <ProjectDetail project={detailProject} />
        <RecordActions key={detailProject.id} name={detailProject.name} kind="프로젝트" confirmationNote={`연결된 할 일 ${tasks.filter((task) => task.projectId === detailProject.id).length}개는 유지되며 프로젝트 연결이 해제됩니다.`} onEdit={() => editProject(detailProject.id)} onDelete={() => deleteProject(detailProject.id)} onClose={closeDetail} />
      </EntryModal>}
      {detailSchedule && <EntryModal title={detailSchedule.title} onClose={closeDetail}>
        <p>{detailSchedule.startedAt.replace("T", " ")}{detailSchedule.endedAt && ` – ${detailSchedule.endedAt.replace("T", " ")}`} (한국 시간)</p><p>{taskAreaLabel(detailSchedule.area)} · {detailSchedule.location || "장소 미정"}</p><p>{detailSchedule.description}</p>
        <RecordActions key={detailSchedule.id} name={detailSchedule.title} kind="일정" onEdit={() => { setEditingId(detailSchedule.id); setDetailItem(null); setModal("schedule"); }} onDelete={() => persist((repo) => repo.remove("schedule", detailSchedule), () => { setSchedules((current) => current.filter((item) => item.id !== detailSchedule.id)); closeDetail(); setToast("일정을 삭제했습니다."); })} onClose={closeDetail} />
      </EntryModal>}
      {detailTask && <EntryModal title={detailTask.title} onClose={closeDetail}>
        <TaskDetail task={detailTask} project={detailTask.projectId ? projectById[detailTask.projectId] : undefined} />
        <RecordActions key={detailTask.id} name={detailTask.title} kind="할 일" onEdit={() => editTask(detailTask.id)} onDelete={() => deleteTask(detailTask.id)} onClose={closeDetail} />
      </EntryModal>}
      {detailWorkout && <EntryModal title={detailWorkout.title} onClose={closeDetail}>
        <WorkoutDetail workout={detailWorkout} />
        <RecordActions key={detailWorkout.id} name={detailWorkout.title} kind="운동 기록" onEdit={() => editWorkout(detailWorkout.id)} onDelete={() => deleteWorkout(detailWorkout.id)} onClose={closeDetail} />
      </EntryModal>}
      {detailTransaction && <EntryModal title={detailTransaction.name} onClose={closeDetail}>
        <TransactionDetail transaction={detailTransaction} />
        <RecordActions key={detailTransaction.id} name={detailTransaction.name} kind="가계부 거래" onEdit={() => editTransaction(detailTransaction.id)} onDelete={() => deleteTransaction(detailTransaction.id)} onClose={closeDetail} />
      </EntryModal>}

      {modal && (
        <EntryModal title={editingId ? editModalTitle(modal) : modalTitle(modal)} onClose={closeModal}>
          {formError && <p className="form-error" role="alert">{formError}</p>}
          {(modal === "intake" || modal === "task") && <TaskForm initial={tasks.find((item) => item.id === editingId)} projects={projects} areas={taskAreas} onAddArea={addTaskArea} defaultDate={todayDate} onSubmit={submitTask} />}
          {modal === "schedule" && <ScheduleForm initial={schedules.find((item) => item.id === editingId)} areas={taskAreas} defaultDate={todayDate} onSubmit={submitSchedule} />}
          {modal === "project" && <ProjectForm initial={projects.find((item) => item.id === editingId)} defaultDate={shiftDate(todayDate, 30)} onSubmit={submitProject} />}
          {modal === "workout" && <WorkoutForm initial={workouts.find((item) => item.id === editingId)} defaultDate={todayDate} onSubmit={submitWorkout} />}
          {modal === "money" && <TransactionForm initial={transactions.find((item) => item.id === editingId)} defaultDate={todayDate} onSubmit={submitTransaction} />}
          {editingId && <button className="secondary-button" type="button" onClick={closeModal}>취소</button>}
        </EntryModal>
      )}
    </div>
  );
}

function PageHeading({ title, actions }: { title: string; actions?: React.ReactNode }) {
  return <div className="page-heading"><h1 tabIndex={-1}>{title}</h1>{actions && <div className="heading-actions">{actions}</div>}</div>;
}

function RecordActions({ name, kind, confirmationNote, onEdit, onDelete, onClose }: { name: string; kind: string; confirmationNote?: string; onEdit: () => void; onDelete: () => void; onClose: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const deleteButton = useRef<HTMLButtonElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  useEffect(() => { (confirming ? cancelButton : deleteButton).current?.focus(); }, [confirming]);

  if (confirming) return <section className="delete-confirmation" role="group" aria-label="삭제 확인">
    <strong>{kind} 삭제</strong>
    <p>‘{name}’ 항목을 삭제할까요?</p>
    {confirmationNote && <p>{confirmationNote}</p>}
    <div className="detail-actions"><button ref={cancelButton} className="secondary-button" type="button" onClick={() => setConfirming(false)}>취소</button><button className="danger-button" type="button" onClick={onDelete}>삭제하기</button></div>
  </section>;

  return <div className="detail-actions"><button ref={deleteButton} className="secondary-button delete-button" type="button" onClick={() => setConfirming(true)}>삭제</button><button className="primary-button" type="button" onClick={onEdit}>수정</button><button className="secondary-button" type="button" onClick={onClose}>닫기</button></div>;
}

function Panel({ title, meta, action, className = "", children }: { title: string; meta?: string; action?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return <article className={`panel ${className}`}><div className="panel-heading"><strong>{title}</strong>{action ?? <span>{meta}</span>}</div>{children}</article>;
}


function MarketRow({ name, value }: { name: string; value: string }) {
  return <div className="market-row"><span>{name}</span><strong>{value}</strong></div>;
}

function MoneySummary({ title, value, detail, comparison = false }: { title: string; value: number; detail: string; comparison?: boolean }) {
  const tone = comparison ? (value > 0 ? "negative" : value < 0 ? "positive" : "neutral") : (value >= 0 ? "positive" : "negative");
  return <article className="money-summary"><span>{title}</span><strong className={tone}>{signedWon(value)}</strong><small>{detail}</small></article>;
}

type PointerDrop = (clientX: number, clientY: number, id: string) => boolean;
type PointerHover = (clientX: number, clientY: number) => void;

function TaskButton({ task, onClick, onStartMove, onEndMove, onPointerHover, onPointerDrop, moving = false }: { task: Task; onClick: () => void; onStartMove?: (id: string) => void; onEndMove?: () => void; onPointerHover?: PointerHover; onPointerDrop?: PointerDrop; moving?: boolean }) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const pointerStart = useRef({ x: 0, y: 0 });
  const activePointerId = useRef<number | null>(null);
  const pointerDragging = useRef(false);
  const suppressClick = useRef(false);
  const [pointerOffset, setPointerOffset] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (moving) return;
    activePointerId.current = null;
    pointerDragging.current = false;
    suppressClick.current = false;
  }, [moving]);

  const visiblePointerOffset = moving ? pointerOffset : null;

  function startPointerMove(pointerId: number) {
    if (!onStartMove || pointerDragging.current) return;
    pointerDragging.current = true;
    suppressClick.current = true;
    buttonRef.current?.setPointerCapture?.(pointerId);
    onStartMove(task.id);
  }

  return <button
    ref={buttonRef}
    type="button"
    data-note-color={task.area === "company" ? "yellow" : task.area === "personal" ? "green" : "purple"}
    className={`${moving ? "task-button draggable-card moving" : "task-button draggable-card"}${visiblePointerOffset ? " pointer-dragging" : ""}`}
    style={visiblePointerOffset ? { transform: `translate3d(${visiblePointerOffset.x}px, ${visiblePointerOffset.y}px, 0)` } : undefined}
    onClick={(event) => {
      event.stopPropagation();
      if (suppressClick.current) {
        suppressClick.current = false;
        return;
      }
      onClick();
    }}
    draggable={false}
    aria-pressed={moving || undefined}
    aria-keyshortcuts={onStartMove ? "Alt+M" : undefined}
    title={onStartMove ? "드래그하거나 Alt+M으로 이동" : undefined}
    onKeyDown={(event) => {
      if (onStartMove && event.altKey && event.key.toLowerCase() === "m") {
        event.preventDefault();
        event.stopPropagation();
        onStartMove(task.id);
      }
    }}
    onPointerDown={(event) => {
      if (event.button > 0) return;
      activePointerId.current = event.pointerId;
      pointerStart.current = { x: event.clientX, y: event.clientY };
    }}
    onPointerMove={(event) => {
      if (!onStartMove || activePointerId.current !== event.pointerId) return;
      const offset = { x: event.clientX - pointerStart.current.x, y: event.clientY - pointerStart.current.y };
      if (Math.hypot(offset.x, offset.y) > 10) startPointerMove(event.pointerId);
      if (pointerDragging.current) {
        setPointerOffset(offset);
        onPointerHover?.(event.clientX, event.clientY);
      }
    }}
    onPointerUp={(event) => {
      if (activePointerId.current !== event.pointerId) return;
      activePointerId.current = null;
      if (!pointerDragging.current) return;
      pointerDragging.current = false;
      buttonRef.current?.releasePointerCapture?.(event.pointerId);
      const dropped = onPointerDrop?.(event.clientX, event.clientY, task.id) ?? false;
      if (!dropped) onEndMove?.();
      setPointerOffset(null);
      window.setTimeout(() => { suppressClick.current = false; }, 0);
    }}
    onPointerCancel={() => { activePointerId.current = null; pointerDragging.current = false; suppressClick.current = false; setPointerOffset(null); onEndMove?.(); }}
    onContextMenu={(event) => { if (onStartMove) event.preventDefault(); }}
  ><span>{task.title}</span><em>{taskAreaLabel(task.area)} · {task.priority}</em></button>;
}

function activateMoveTarget(event: React.KeyboardEvent<HTMLElement>, move: () => void) {
  if (event.target !== event.currentTarget || (event.key !== "Enter" && event.key !== " ")) return;
  event.preventDefault();
  move();
}

type CalendarMoveProps = {
  movingTaskId: string | null;
  activeDropTarget: string | null;
  onStartMove: (id: string) => void;
  onEndMove: () => void;
  onMoveToDate: (date: string, taskId?: string) => void;
  onPointerHover: PointerHover;
  onPointerDrop: PointerDrop;
};

function WeekView({ weekStart, todayDate, tasks, onSelect, movingTaskId, activeDropTarget, onStartMove, onEndMove, onMoveToDate, onPointerHover, onPointerDrop }: { weekStart: string; todayDate: string; tasks: Task[]; onSelect: (id: string) => void } & CalendarMoveProps) {
  const dates = Array.from({ length: 7 }, (_, index) => shiftDate(weekStart, index));
  return <div className="week-grid">{dates.map((date, index) => {
    const day = Number(date.slice(-2));
    return <div
      className={`${date === todayDate ? "day-column today" : "day-column"}${movingTaskId ? " drop-target" : ""}${activeDropTarget === `date:${date}` ? " active-drop-target" : ""}`}
      key={date}
      data-task-date={date}
      tabIndex={movingTaskId ? 0 : undefined}
      onKeyDown={(event) => activateMoveTarget(event, () => onMoveToDate(date))}
    ><strong>{["월", "화", "수", "목", "금", "토", "일"][index]} {day}</strong>{tasks.filter((task) => task.scheduledDate === date).map((task) => <TaskButton key={task.id} task={task} moving={movingTaskId === task.id} onStartMove={onStartMove} onEndMove={onEndMove} onPointerHover={onPointerHover} onPointerDrop={onPointerDrop} onClick={() => onSelect(task.id)} />)}</div>;
  })}</div>;
}

function MonthView({ month, todayDate, tasks, onSelect, movingTaskId, activeDropTarget, onStartMove, onEndMove, onMoveToDate, onPointerHover, onPointerDrop }: { month: string; todayDate: string; tasks: Task[]; onSelect: (id: string) => void } & CalendarMoveProps) {
  const [year, monthNumber] = month.split("-").map(Number);
  const daysInMonth = new Date(year, monthNumber, 0).getDate();
  const leadingEmptyDays = (new Date(year, monthNumber - 1, 1).getDay() + 6) % 7;
  const cellCount = Math.ceil((leadingEmptyDays + daysInMonth) / 7) * 7;
  const cells = Array.from({ length: cellCount }, (_, index) => {
    const day = index - leadingEmptyDays + 1;
    return day >= 1 && day <= daysInMonth ? day : null;
  });
  const weeks = Array.from({ length: cellCount / 7 }, (_, index) => cells.slice(index * 7, index * 7 + 7));

  return (
    <div className="month-calendar" role="grid" aria-label={`${monthLabel(month)} 할 일 달력`}>
      <div className="month-weekdays" role="row">{["월", "화", "수", "목", "금", "토", "일"].map((day) => <span key={day} role="columnheader">{day}</span>)}</div>
      <div className="month-grid">
        {weeks.map((week, weekIndex) => <div className="month-row" role="row" key={`week-${weekIndex}`}>
          {week.map((day, dayIndex) => {
            if (day === null) return <div className="month-cell outside" role="gridcell" aria-label="현재 달 범위 밖" key={`empty-${weekIndex}-${dayIndex}`} />;
            const date = `${month}-${String(day).padStart(2, "0")}`;
            const dayTasks = tasks.filter((task) => task.scheduledDate === date);
            return <div
              className={`${date === todayDate ? "month-cell today" : "month-cell"}${movingTaskId ? " drop-target" : ""}${activeDropTarget === `date:${date}` ? " active-drop-target" : ""}`}
              role="gridcell"
              aria-label={`${monthLabel(month)} ${day}일`}
              key={date}
              data-task-date={date}
              tabIndex={movingTaskId ? 0 : undefined}
              onKeyDown={(event) => activateMoveTarget(event, () => onMoveToDate(date))}
            ><time dateTime={date}>{day}</time>{dayTasks.map((task) => <TaskButton key={task.id} task={task} moving={movingTaskId === task.id} onStartMove={onStartMove} onEndMove={onEndMove} onPointerHover={onPointerHover} onPointerDrop={onPointerDrop} onClick={() => onSelect(task.id)} />)}</div>;
          })}
        </div>)}
      </div>
    </div>
  );
}

function TaskKanban({ tasks, onSelect, movingTaskId, activeDropTarget, onStartMove, onEndMove, onMoveToStatus, onPointerHover, onPointerDrop }: { tasks: Task[]; onSelect: (id: string) => void; movingTaskId: string | null; activeDropTarget: string | null; onStartMove: (id: string) => void; onEndMove: () => void; onMoveToStatus: (status: TaskStatus, taskId?: string) => void; onPointerHover: PointerHover; onPointerDrop: PointerDrop }) {
  return <div className="kanban">{(["todo", "doing", "done"] as TaskStatus[]).map((status) => <div
    className={`kanban-column${movingTaskId ? " drop-target" : ""}${activeDropTarget === `status:${status}` ? " active-drop-target" : ""}`}
    key={status}
    data-task-status={status}
    role="group"
    aria-label={`${statusLabel[status]} 영역`}
    tabIndex={movingTaskId ? 0 : undefined}
    onKeyDown={(event) => activateMoveTarget(event, () => onMoveToStatus(status))}
  ><strong>{statusLabel[status]} · {tasks.filter((task) => task.status === status).length}</strong>{tasks.filter((task) => task.status === status).map((task) => <TaskButton key={task.id} task={task} moving={movingTaskId === task.id} onStartMove={onStartMove} onEndMove={onEndMove} onPointerHover={onPointerHover} onPointerDrop={onPointerDrop} onClick={() => onSelect(task.id)} />)}</div>)}</div>;
}

function TaskDetail({ task, project }: { task: Task; project?: Project }) {
  return <div className="detail-content"><div className="detail-grid"><div><span>구분</span><strong>{taskAreaLabel(task.area)}</strong></div>{task.area === "company" && <div><span>프로젝트</span><strong>{project?.name ?? "프로젝트 없음"}</strong></div>}<div><span>상태</span><strong>{statusLabel[task.status]}</strong></div><div><span>우선순위</span><strong>{priorityLabel[task.priority]}</strong></div><div><span>예정일</span><strong>{displayDate(task.scheduledDate)}</strong></div><div><span>마감</span><strong>{displayDate(task.dueDate)}</strong></div><div><span>예상 시간</span><strong>{task.estimatedMinutes}분</strong></div></div><div className="description"><span>상세 내용</span><p>{task.description}</p></div></div>;
}

function WorkoutDetail({ workout }: { workout: Workout }) {
  return <div className="detail-content"><div className="detail-grid"><div><span>운동 일시</span><strong>{workout.startedAt.replace("T", " ")}</strong></div><div><span>장소</span><strong>{workout.place}</strong></div><div><span>운동 시간</span><strong>{workout.durationMinutes}분</strong></div><div><span>운동 종목</span><strong>{workout.exercise}</strong></div><div><span>세트 × 횟수</span><strong>{workout.sets}세트 × {workout.reps}회</strong></div><div><span>중량</span><strong>{workout.weightKg}kg</strong></div></div></div>;
}

function TransactionDetail({ transaction }: { transaction: Transaction }) {
  return <div className="detail-content"><div className="detail-grid"><div><span>거래 일시</span><strong>{transaction.happenedAt.replace("T", " ")}</strong></div><div><span>수입 / 지출</span><strong>{transaction.flow === "income" ? "수입" : "지출"}</strong></div><div><span>금액</span><strong className={transaction.flow}>{signedWon(transactionValue(transaction))}</strong></div><div><span>사용처</span><strong>{transaction.merchant}</strong></div><div><span>카테고리</span><strong>{transaction.category}</strong></div><div><span>금융 계좌</span><strong>{transaction.account}</strong></div></div></div>;
}

function ProjectKanban({ projects, onSelect, movingProjectId, activeDropTarget, onStartMove, onEndMove, onMoveToStatus, onPointerHover, onPointerDrop }: {
  projects: Project[];
  onSelect: (id: string) => void;
  movingProjectId: string | null;
  activeDropTarget: ProjectStatus | null;
  onStartMove: (id: string) => void;
  onEndMove: () => void;
  onMoveToStatus: (status: ProjectStatus, projectId?: string) => void;
  onPointerHover: PointerHover;
  onPointerDrop: PointerDrop;
}) {
  return <div className="kanban project-kanban">{(["ready", "doing", "done"] as ProjectStatus[]).map((status) => <div
    className={`kanban-column${movingProjectId ? " drop-target" : ""}${activeDropTarget === status ? " active-drop-target" : ""}`}
    key={status}
    data-project-status={status}
    role="group"
    aria-label={`프로젝트 ${projectStatusLabel[status]} 영역`}
    tabIndex={movingProjectId ? 0 : undefined}
    onKeyDown={(event) => activateMoveTarget(event, () => onMoveToStatus(status))}
  ><strong>{projectStatusLabel[status]} · {projects.filter((project) => project.status === status).length}</strong>{projects.filter((project) => project.status === status).map((project) => <ProjectCard key={project.id} project={project} moving={movingProjectId === project.id} onSelect={onSelect} onStartMove={onStartMove} onEndMove={onEndMove} onPointerHover={onPointerHover} onPointerDrop={onPointerDrop} />)}</div>)}</div>;
}

function ProjectCard({ project, moving, onSelect, onStartMove, onEndMove, onPointerHover, onPointerDrop }: { project: Project; moving: boolean; onSelect: (id: string) => void; onStartMove: (id: string) => void; onEndMove: () => void; onPointerHover: PointerHover; onPointerDrop: PointerDrop }) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const pointerStart = useRef({ x: 0, y: 0 });
  const activePointerId = useRef<number | null>(null);
  const pointerDragging = useRef(false);
  const suppressClick = useRef(false);
  const [pointerOffset, setPointerOffset] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (moving) return;
    activePointerId.current = null;
    pointerDragging.current = false;
    suppressClick.current = false;
  }, [moving]);

  const visiblePointerOffset = moving ? pointerOffset : null;

  function startPointerMove(pointerId: number) {
    if (pointerDragging.current) return;
    pointerDragging.current = true;
    suppressClick.current = true;
    buttonRef.current?.setPointerCapture?.(pointerId);
    onStartMove(project.id);
  }

  return <button
    ref={buttonRef}
    type="button"
    className={`${moving ? "project-card draggable-card moving" : "project-card draggable-card"}${visiblePointerOffset ? " pointer-dragging" : ""}`}
    style={visiblePointerOffset ? { transform: `translate3d(${visiblePointerOffset.x}px, ${visiblePointerOffset.y}px, 0)` } : undefined}
    draggable={false}
    aria-pressed={moving || undefined}
    aria-keyshortcuts="Alt+M"
    title="드래그하거나 Alt+M으로 이동"
    onClick={(event) => {
      event.stopPropagation();
      if (suppressClick.current) {
        suppressClick.current = false;
        return;
      }
      onSelect(project.id);
    }}
    onKeyDown={(event) => { if (event.altKey && event.key.toLowerCase() === "m") { event.preventDefault(); event.stopPropagation(); onStartMove(project.id); } }}
    onPointerDown={(event) => {
      if (event.button > 0) return;
      activePointerId.current = event.pointerId;
      pointerStart.current = { x: event.clientX, y: event.clientY };
    }}
    onPointerMove={(event) => {
      if (activePointerId.current !== event.pointerId) return;
      const offset = { x: event.clientX - pointerStart.current.x, y: event.clientY - pointerStart.current.y };
      if (Math.hypot(offset.x, offset.y) > 10) startPointerMove(event.pointerId);
      if (pointerDragging.current) {
        setPointerOffset(offset);
        onPointerHover(event.clientX, event.clientY);
      }
    }}
    onPointerUp={(event) => {
      if (activePointerId.current !== event.pointerId) return;
      activePointerId.current = null;
      if (!pointerDragging.current) return;
      pointerDragging.current = false;
      buttonRef.current?.releasePointerCapture?.(event.pointerId);
      const dropped = onPointerDrop(event.clientX, event.clientY, project.id);
      if (!dropped) onEndMove();
      setPointerOffset(null);
      window.setTimeout(() => { suppressClick.current = false; }, 0);
    }}
    onPointerCancel={() => { activePointerId.current = null; pointerDragging.current = false; suppressClick.current = false; setPointerOffset(null); onEndMove(); }}
    onContextMenu={(event) => event.preventDefault()}
  ><strong>{project.name}</strong><span>{priorityLabel[project.priority]} · {project.progress}%</span></button>;
}

function ProjectDetail({ project }: { project: Project }) {
  return <div className="detail-content"><div className="detail-grid"><div><span>상태</span><strong>{projectStatusLabel[project.status]}</strong></div><div><span>우선순위</span><strong>{priorityLabel[project.priority]}</strong></div><div><span>진행률</span><strong>{project.progress}%</strong></div><div><span>목표 완료일</span><strong>{displayDate(project.dueDate)}</strong></div></div><div className="description"><span>프로젝트 설명</span><p>{project.description}</p></div></div>;
}

function EntryModal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const modalRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const modal = modalRef.current;
    const isMobile = window.matchMedia?.("(max-width: 620px)").matches ?? false;
    const initialFocus = modal?.querySelector<HTMLElement>("input:not([disabled]), textarea:not([disabled]), select:not([disabled])")
      ?? modal?.querySelector<HTMLElement>(isMobile ? ".modal-back-button" : ".close-button");
    initialFocus?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !modal) return;
      const focusable = Array.from(modal.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])"));
      if (focusable.length === 0) {
        event.preventDefault();
        modal.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousBodyOverflow;
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
      else document.querySelector<HTMLElement>(".page-heading h1")?.focus();
    };
  }, [onClose]);

  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div ref={modalRef} className="modal" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}><div className="modal-heading"><button type="button" className="modal-back-button" onClick={onClose} aria-label="뒤로가기"><span aria-hidden="true">‹</span> 뒤로</button><div className="modal-heading-copy"><h2 id={titleId}>{title}</h2></div><button type="button" className="close-button" onClick={onClose} aria-label="닫기">×</button></div>{children}</div></div>;
}

function ModalActions({ submitLabel }: { submitLabel: string }) {
  return <div className="form-actions"><button className="primary-button" type="submit">{submitLabel}</button></div>;
}

function TaskAreaAdder({ onAdd, onSelect }: { onAdd: (name: string) => string | Promise<string>; onSelect?: (area: string) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const inputId = useId();
  const errorId = useId();

  function add() {
    if (busy) return;
    function done(area: string) {
      onSelect?.(area); setName(""); setError(""); setOpen(false);
    }
    try {
      const area = onAdd(name);
      if (typeof area === "string") done(area);
      else {
        setBusy(true);
        void area.then(done).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "구분을 추가하지 못했습니다.")).finally(() => setBusy(false));
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "구분을 추가하지 못했습니다.");
    }
  }

  return <div className="task-area-adder">
    <button className="text-button" type="button" aria-expanded={open} onClick={() => { setOpen(!open); setError(""); }}>+ 구분 추가</button>
    {open && <div className="task-area-entry" role="group" aria-label="새 구분 추가">
      <label className="field" htmlFor={inputId}><span>새 구분 이름</span><input id={inputId} value={name} maxLength={32} placeholder="예: 성당, 공부, 동호회" aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); add(); } }} /></label>
      <div className="form-actions"><button className="secondary-button" type="button" onClick={add} disabled={busy}>{busy ? "저장 중…" : "구분 추가하기"}</button><button className="text-button" type="button" disabled={busy} onClick={() => { setOpen(false); setError(""); }}>취소</button></div>
      {error && <p id={errorId} className="form-error" role="alert">{error}</p>}
    </div>}
  </div>;
}

function TaskForm({ initial, projects, areas, onAddArea, defaultDate, onSubmit }: { initial?: Task; projects: Project[]; areas: string[]; onAddArea: (name: string) => string | Promise<string>; defaultDate: string; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const [area, setArea] = useState<TaskArea>(initial?.area ?? "company");
  return <form onSubmit={onSubmit}>
    <div className="form-grid">
      <Field name="title" label="할 일 제목" defaultValue={initial?.title ?? "QA 완료 조건 확인"} required />
      <div><label className="field"><span>구분</span><select name="area" value={area} onChange={(event) => setArea(event.target.value)}>{areas.map((value) => <option key={value} value={value}>{taskAreaLabel(value)}</option>)}</select></label><TaskAreaAdder onAdd={onAddArea} onSelect={setArea} /></div>
      {area === "company" && <label className="field"><span>프로젝트</span><select name="projectId" defaultValue={initial?.projectId}><option value="">프로젝트 없음</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>}
      <SelectPriority defaultValue={initial?.priority} />
      <Field name="scheduledDate" label={initial ? "예정일" : "예정일 / 마감일"} type="date" defaultValue={initial?.scheduledDate ?? defaultDate} required />
      {initial && <Field name="dueDate" label="마감일" type="date" defaultValue={initial.dueDate} required />}
      <Field name="estimatedMinutes" label="예상 소요시간(분)" type="number" defaultValue={initial ? String(initial.estimatedMinutes) : "90"} required />
    </div>
    <label className="field"><span>상세 내용</span><textarea name="description" defaultValue={initial?.description ?? "로그인, 알림 권한, 오프라인 상태의 완료 조건을 확인하고 발견된 이슈를 정리한다."} required /></label>
    <ModalActions submitLabel={initial ? "수정 저장" : "할 일 저장"} />
  </form>;
}

function ProjectForm({ initial, defaultDate, onSubmit }: { initial?: Project; defaultDate: string; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <form onSubmit={onSubmit}><div className="form-grid"><Field name="name" label="프로젝트 이름" defaultValue={initial?.name ?? "신규 PWA 출시"} required /><SelectPriority defaultValue={initial?.priority} /><Field name="dueDate" label="목표 완료일" type="date" defaultValue={initial?.dueDate ?? defaultDate} required />{!initial && <Field name="milestone" label="첫 마일스톤" defaultValue="MVP 기능 확정" />}</div><label className="field"><span>프로젝트 설명</span><textarea name="description" defaultValue={initial?.description ?? "생활 관리 기능을 하나의 모바일 PWA로 통합하고 매일 아침 계획 입력 알림을 제공한다."} required /></label><ModalActions submitLabel={initial ? "수정 저장" : "프로젝트 저장"} /></form>;
}

function WorkoutForm({ initial, defaultDate, onSubmit }: { initial?: Workout; defaultDate: string; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <form onSubmit={onSubmit}><div className="form-grid"><Field name="title" label="운동명" defaultValue={initial?.title !== undefined ? String(initial.title) : "하체 근력 운동"} required /><Field name="startedAt" label="운동 일시" type="datetime-local" defaultValue={initial?.startedAt ?? `${defaultDate}T19:00`} required /><Field name="place" label="장소" defaultValue={initial?.place !== undefined ? String(initial.place) : "헬스장"} required /><Field name="durationMinutes" label="운동 시간(분)" type="number" defaultValue={initial?.durationMinutes !== undefined ? String(initial.durationMinutes) : "50"} required /><Field name="exercise" label="운동 종목" defaultValue={initial?.exercise !== undefined ? String(initial.exercise) : "스쿼트"} required /><Field name="sets" label="세트 수" type="number" defaultValue={initial?.sets !== undefined ? String(initial.sets) : "4"} required /><Field name="reps" label="횟수" type="number" defaultValue={initial?.reps !== undefined ? String(initial.reps) : "8"} required /><Field name="weightKg" label="중량(kg)" type="number" defaultValue={initial?.weightKg !== undefined ? String(initial.weightKg) : "80"} required /></div><ModalActions submitLabel={initial ? "수정 저장" : "운동 저장"} /></form>;
}

function TransactionForm({ initial, defaultDate, onSubmit }: { initial?: Transaction; defaultDate: string; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <form onSubmit={onSubmit}><div className="form-grid"><Field name="happenedAt" label="거래 일시" type="datetime-local" defaultValue={initial?.happenedAt ?? `${defaultDate}T12:00`} required /><label className="field"><span>수입 / 지출</span><select name="flow" defaultValue={initial?.flow}><option value="expense">− 지출</option><option value="income">+ 수입</option></select></label><Field name="name" label="내역" defaultValue={initial?.name !== undefined ? String(initial.name) : "점심"} required /><Field name="merchant" label="사용처" defaultValue={initial?.merchant !== undefined ? String(initial.merchant) : "회사 근처 식당"} required /><Field name="amount" label="금액" type="number" defaultValue={initial?.amount !== undefined ? String(initial.amount) : "12000"} required /><label className="field"><span>카테고리</span><select name="category" defaultValue={initial?.category}><option>소비 › 식비</option><option>소비 › 카페·간식</option><option>소비 › 교통</option><option>소비 › 주거</option><option>투자 › 국내주식</option><option>투자 › 미국주식</option><option>수입 › 급여</option><option>수입 › 기타</option></select></label><label className="field"><span>금융 계좌</span><select name="account" defaultValue={initial?.account}><option>신한 신용카드</option><option>국민 체크카드</option><option>생활비 계좌</option><option>현금</option><option>증권 계좌</option></select></label></div><ModalActions submitLabel={initial ? "수정 저장" : "등록"} /></form>;
}

function Field({ name, label, type = "text", defaultValue, required = false }: { name: string; label: string; type?: string; defaultValue?: string; required?: boolean }) {
  return <label className="field"><span>{label}</span><input name={name} type={type} step={name === "weightKg" || name === "amount" ? "0.01" : undefined} defaultValue={defaultValue} required={required} /></label>;
}

function SelectPriority({ defaultValue }: { defaultValue?: Priority } = {}) {
  return <label className="field"><span>우선순위</span><select name="priority" defaultValue={defaultValue}>{(["P1", "P2", "P3", "P4"] as Priority[]).map((priority) => <option key={priority} value={priority}>{priorityLabel[priority]}</option>)}</select></label>;
}

function modalTitle(modal: Exclude<ModalName, null>) {
  return { intake: "오늘 계획 입력", task: "새 할 일", project: "새 프로젝트", workout: "운동 기록", money: "가계부 거래 등록", schedule: "새 일정" }[modal];
}

function editModalTitle(modal: Exclude<ModalName, null>) {
  return { intake: "오늘 계획 수정", task: "할 일 수정", project: "프로젝트 수정", workout: "운동 수정", money: "가계부 거래 수정", schedule: "일정 수정" }[modal];
}

function ScheduleForm({ initial, areas, defaultDate, onSubmit }: { initial?: Schedule; areas: string[]; defaultDate: string; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <form onSubmit={onSubmit}><div className="form-grid">
    <Field name="title" label="일정 제목" defaultValue={initial?.title} required />
    <label className="field"><span>일정 구분</span><select name="area" defaultValue={initial?.area ?? "personal"}>{areas.map((area) => <option key={area} value={area}>{taskAreaLabel(area)}</option>)}</select></label>
    <Field name="startedAt" label="시작 시간 (한국 시간)" type="datetime-local" defaultValue={initial?.startedAt ?? `${defaultDate}T09:00`} required />
    <Field name="endedAt" label="종료 시간 (선택)" type="datetime-local" defaultValue={initial?.endedAt} />
    <Field name="location" label="장소 (선택)" defaultValue={initial?.location} />
  </div><label className="field"><span>일정 메모</span><textarea name="description" defaultValue={initial?.description} /></label><ModalActions submitLabel={initial ? "수정 저장" : "일정 저장"} /></form>;
}
