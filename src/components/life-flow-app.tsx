"use client";

import { FormEvent, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { initialProjects, initialTasks, initialTransactions, initialWorkouts } from "@/lib/sample-data";
import { getSupabaseBrowserClient, hasSupabaseConfig } from "@/lib/supabase-client";
import type { ModalName, PageName, Priority, Project, Task, TaskStatus, Transaction, Workout } from "@/lib/types";
import { firstValidationError, formDataValues, loginSchema, projectSchema, taskSchema, transactionSchema, workoutSchema } from "@/lib/validation";

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

const APP_TIME_ZONE = "Asia/Seoul";

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

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
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
  const [authReady, setAuthReady] = useState(process.env.NODE_ENV === "test" || !hasSupabaseConfig);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authNotice, setAuthNotice] = useState("");
  const [page, setPage] = useState<PageName>("dashboard");
  const [modal, setModal] = useState<ModalName>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [projects, setProjects] = useState(initialProjects);
  const [tasks, setTasks] = useState(initialTasks);
  const [workouts, setWorkouts] = useState(initialWorkouts);
  const [transactions, setTransactions] = useState(initialTransactions);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(initialTasks[0]?.id ?? null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(initialProjects[0]?.id ?? null);
  const [taskView, setTaskView] = useState<"week" | "month" | "kanban">("week");
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedWeekStart, setSelectedWeekStart] = useState(() => startOfWeek(todayDate));
  const [movingTaskId, setMovingTaskId] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState(`${currentMonth}-01`);
  const [dateTo, setDateTo] = useState(() => monthEnd(currentMonth));
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [notificationTime, setNotificationTime] = useState("08:00");
  const [notificationEnabled, setNotificationEnabled] = useState(true);
  const [intakeParsed, setIntakeParsed] = useState(false);
  const previousMonth = useRef(currentMonth);

  const closeModal = useCallback(() => {
    setModal(null);
    setEditingId(null);
    setIntakeParsed(false);
  }, []);

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
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) setAuthError("로그인 상태를 확인하지 못했습니다. 다시 시도해 주세요.");
      setAuthenticated(Boolean(data.session));
      setAuthReady(true);
    }).catch(() => {
      if (active) {
        setAuthError("로그인 상태를 확인하지 못했습니다. 다시 시도해 주세요.");
        setAuthReady(true);
      }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) {
        setAuthenticated(Boolean(session));
        setAuthReady(true);
      }
    });

    return () => {
      active = false;
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

  const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? tasks[0];
  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? projects[0];
  const todayTasks = tasks.filter((task) => task.scheduledDate === todayDate && task.status !== "done");

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
  }

  function moveTaskToDate(date: string, draggedTaskId?: string) {
    const taskId = draggedTaskId || movingTaskId;
    if (!taskId) return;
    setTasks((current) => current.map((task) => task.id === taskId ? { ...task, scheduledDate: date } : task));
    setSelectedTaskId(taskId);
    setMovingTaskId(null);
    setToast(`${displayDate(date)}로 할 일을 옮겼습니다.`);
  }

  function moveTaskToStatus(status: TaskStatus, draggedTaskId?: string) {
    const taskId = draggedTaskId || movingTaskId;
    if (!taskId) return;
    setTasks((current) => current.map((task) => task.id === taskId ? { ...task, status } : task));
    setSelectedTaskId(taskId);
    setMovingTaskId(null);
    setToast(`‘${statusLabel[status]}’ 영역으로 옮겼습니다.`);
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
      if (supabase) await supabase.auth.signOut();
    } finally {
      setAuthenticated(false);
      setPage("dashboard");
    }
  }

  function submitTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = taskSchema.safeParse(formDataValues(new FormData(event.currentTarget)));
    if (!parsed.success) {
      setToast(firstValidationError(parsed.error));
      return;
    }
    const data = parsed.data;
    const task: Task = {
      ...tasks.find((item) => item.id === editingId),
      id: editingId ?? uid("task"),
      title: data.title,
      description: data.description,
      projectId: data.projectId,
      priority: data.priority,
      status: tasks.find((item) => item.id === editingId)?.status ?? "todo",
      scheduledDate: data.scheduledDate,
      dueDate: data.dueDate ?? data.scheduledDate,
      estimatedMinutes: data.estimatedMinutes
    };
    setTasks((current) => editingId ? current.map((item) => item.id === editingId ? task : item) : [task, ...current]);
    setSelectedTaskId(task.id);
    closeModal();
    setToast(editingId ? "할 일을 수정했습니다." : "새 할 일을 저장했습니다.");
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
      id: uid("project"),
      name: data.name,
      description: data.description,
      priority: data.priority,
      status: "ready",
      progress: 0,
      dueDate: data.dueDate
    };
    setProjects((current) => [project, ...current]);
    setSelectedProjectId(project.id);
    closeModal();
    setToast("새 프로젝트를 저장했습니다.");
  }

  function submitWorkout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = workoutSchema.safeParse(formDataValues(new FormData(event.currentTarget)));
    if (!parsed.success) {
      setToast(firstValidationError(parsed.error));
      return;
    }
    const data = parsed.data;
    const workout: Workout = {
      id: editingId ?? uid("workout"),
      title: data.title,
      startedAt: data.startedAt,
      place: data.place,
      durationMinutes: data.durationMinutes,
      exercise: data.exercise,
      sets: data.sets,
      reps: data.reps,
      weightKg: data.weightKg
    };
    setWorkouts((current) => editingId ? current.map((item) => item.id === editingId ? workout : item) : [workout, ...current]);
    closeModal();
    setToast(editingId ? "운동 기록을 수정했습니다." : "운동 기록을 저장했습니다.");
  }

  function submitTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = transactionSchema.safeParse(formDataValues(new FormData(event.currentTarget)));
    if (!parsed.success) {
      setToast(firstValidationError(parsed.error));
      return;
    }
    const data = parsed.data;
    const transaction: Transaction = {
      id: editingId ?? uid("transaction"),
      happenedAt: data.happenedAt,
      name: data.name,
      merchant: data.merchant,
      amount: data.amount,
      flow: data.flow,
      category: data.category,
      account: data.account
    };
    setTransactions((current) => editingId ? current.map((item) => item.id === editingId ? transaction : item) : [transaction, ...current]);
    closeModal();
    setToast(editingId ? "가계부 거래를 수정했습니다." : "가계부 거래를 등록했습니다.");
  }

  async function testNotification() {
    if (!("Notification" in window)) {
      setToast("이 브라우저는 알림을 지원하지 않습니다.");
      return;
    }
    if (!("serviceWorker" in navigator)) {
      setToast("이 브라우저는 서비스 워커를 지원하지 않습니다.");
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setToast("알림 권한이 허용되지 않았습니다.");
        return;
      }
      const registration = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<never>((_resolve, reject) => window.setTimeout(() => reject(new Error("service-worker-timeout")), 5000))
      ]);
      await registration.showNotification("Life Flow", {
        body: `${notificationTime}에 오늘 계획 입력 알림을 보냅니다.`,
        icon: "/icon.svg"
      });
      setToast("테스트 알림을 표시했습니다.");
    } catch {
      setToast("알림을 준비하지 못했습니다. 앱을 새로고침한 뒤 다시 시도해 주세요.");
    }
  }

  if (!authReady) {
    return <main className="login-page"><div className="login-card" role="status">로그인 상태를 확인하고 있습니다.</div></main>;
  }

  if (!authenticated) {
    return (
      <main className="login-page">
        <form className="login-card" onSubmit={submitLogin}>
          <div className="brand"><span className="brand-mark">L</span><span>Life Flow</span></div>
          <div>
            <h1>{authMode === "signup" ? "Life Flow 시작하기" : "다시 오신 것을 환영해요"}</h1>
            <p>{authMode === "signup" ? "이메일과 비밀번호로 나만의 계정을 만드세요." : "오늘의 일정과 생활 기록을 한곳에서 관리하세요."}</p>
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
        </form>
      </main>
    );
  }

  return (
    <div className="app-shell">
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
      </nav>

      <main className="app-main">
        <header className="app-header">
          <span>{pageTitles[page]}</span>
          <span className="header-date">{fullDateLabel(todayDate)} · 서울</span>
        </header>
        <div className="page-content">
          {toast && <div className="toast" role="status">{toast}</div>}

          {page === "dashboard" && (
            <section>
              <PageHeading
                title="좋은 아침이에요"
                description="오늘 필요한 것만 확인하고 바로 기록하세요."
                actions={<><button className="secondary-button" onClick={() => setModal("money")}>가계부 입력</button><button className="primary-button" onClick={() => setModal("intake")}>오늘 계획 입력</button></>}
              />
              <div className="dashboard-grid">
                <Panel title="오늘 일정" meta="2개">
                  <ListRow title="주간 팀 미팅" detail="회사 · 온라인" value="09:30" />
                  <ListRow title="점심 약속" detail="개인 · 강남" value="12:30" />
                </Panel>
                <Panel title="오늘 할 일" action={<button className="text-button" onClick={() => navigate("tasks")}>전체 보기</button>}>
                  {todayTasks.map((task) => <TaskButton key={task.id} task={task} onClick={() => { setSelectedTaskId(task.id); navigate("tasks"); }} />)}
                </Panel>
                <Panel title="오늘 운동" action={<button className="text-button" onClick={() => navigate("workouts")}>상세</button>}>
                  {workouts.slice(0, 1).map((workout) => <ListRow key={workout.id} title={workout.title} detail={`${workout.place} · ${workout.durationMinutes}분`} value="19:00" />)}
                </Panel>
                <Panel title="관심 시장" meta="지연 시세">
                  <MarketRow name="KOSPI" value="2,742.18" />
                  <MarketRow name="S&P 500" value="5,631.22" />
                  <MarketRow name="NASDAQ" value="17,713.62" />
                </Panel>
              </div>
              <Panel title="진행 중 프로젝트" className="wide-panel" action={<button className="text-button" onClick={() => navigate("tasks")}>전체 보기</button>}>
                <div className="project-summary-grid">
                  {projects.filter((project) => project.status === "doing").map((project) => (
                    <button key={project.id} className="project-summary" onClick={() => { setSelectedProjectId(project.id); navigate("tasks"); }}>
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
                description="프로젝트를 기준으로 업무를 정리하고, 주·월·칸반으로 할 일을 확인합니다."
                actions={<><button className="secondary-button" onClick={() => setModal("project")}>+ 프로젝트</button><button className="primary-button" onClick={() => setModal("task")}>+ 할 일</button></>}
              />
              <div className="task-projects">
                <div className="section-heading">
                  <div><h2>프로젝트</h2><p>프로젝트 진행 상태와 상세 내용을 먼저 확인하세요.</p></div>
                  <span>{projects.length}개</span>
                </div>
                <ProjectKanban projects={projects} onSelect={setSelectedProjectId} />
                {selectedProject && <ProjectDetail project={selectedProject} />}
              </div>
              <div className="section-heading task-list-heading">
                <div><h2>할 일 보기</h2><p>선택한 기간이나 진행 상태에 따라 할 일을 확인합니다.</p></div>
              </div>
              {movingTaskId && <div className="move-hint" role="status"><span>이동할 날짜 또는 칸반 영역을 선택하세요.</span><button type="button" onClick={() => setMovingTaskId(null)}>취소</button></div>}
              <div className="view-toolbar">
                <div className="segmented">
                  {(["week", "month", "kanban"] as const).map((view) => <button key={view} className={taskView === view ? "active" : ""} onClick={() => setTaskView(view)}>{view === "week" ? "주" : view === "month" ? "월" : "칸반"}</button>)}
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
              {taskView === "week" && <WeekView weekStart={selectedWeekStart} todayDate={todayDate} tasks={tasks} movingTaskId={movingTaskId} onSelect={setSelectedTaskId} onStartMove={setMovingTaskId} onEndMove={() => setMovingTaskId(null)} onMoveToDate={moveTaskToDate} />}
              {taskView === "month" && <MonthView month={selectedMonth} todayDate={todayDate} tasks={tasks} movingTaskId={movingTaskId} onSelect={setSelectedTaskId} onStartMove={setMovingTaskId} onEndMove={() => setMovingTaskId(null)} onMoveToDate={moveTaskToDate} />}
              {taskView === "kanban" && <TaskKanban tasks={tasks} movingTaskId={movingTaskId} onSelect={setSelectedTaskId} onStartMove={setMovingTaskId} onEndMove={() => setMovingTaskId(null)} onMoveToStatus={moveTaskToStatus} />}
              {selectedTask && <><button className="secondary-button" onClick={() => { setEditingId(selectedTask.id); setModal("task"); }}>할 일 수정</button><TaskDetail task={selectedTask} project={selectedTask.projectId ? projectById[selectedTask.projectId] : undefined} /></>}
            </section>
          )}

          {page === "workouts" && (
            <section>
              <PageHeading title="운동 관리" description="운동 세션과 세트별 상세를 기록합니다." actions={<button className="primary-button" onClick={() => setModal("workout")}>+ 운동 기록</button>} />
              <div className="dashboard-grid">
                {workouts.map((workout) => <Panel key={workout.id} title={workout.title} meta={displayDate(workout.startedAt)} action={<button className="text-button" aria-label={`${workout.title} 수정`} onClick={() => { setEditingId(workout.id); setModal("workout"); }}>수정</button>}><p className="record-copy">{workout.place} · {workout.durationMinutes}분</p><p className="record-copy">{workout.exercise} · {workout.sets}세트 × {workout.reps}회 · {workout.weightKg}kg</p></Panel>)}
              </div>
            </section>
          )}

          {page === "money" && (
            <section>
              <PageHeading title="가계부" description="수입과 지출의 흐름을 비교하고 필요한 거래만 빠르게 확인합니다." actions={<button className="primary-button" onClick={() => setModal("money")}>+ 거래 등록</button>} />
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
                <div className="table-scroll"><table><thead><tr><th>일시</th><th>내역</th><th>사용처</th><th>흐름</th><th>카테고리</th><th className="number">금액</th><th>수정</th></tr></thead><tbody>{filteredTransactions.map((transaction) => <tr key={transaction.id}><td>{displayDate(transaction.happenedAt)}</td><td>{transaction.name}</td><td>{transaction.merchant}</td><td>{transaction.flow === "income" ? "수입" : "지출"}</td><td>{transaction.category}</td><td className={`number ${transaction.flow}`}>{signedWon(transactionValue(transaction))}</td><td><button className="text-button" aria-label={`${transaction.name} 수정`} onClick={() => { setEditingId(transaction.id); setModal("money"); }}>수정</button></td></tr>)}</tbody></table></div>
              </Panel>
            </section>
          )}

          {page === "settings" && (
            <section>
              <PageHeading title="설정" description="아침 계획 알림과 앱 기본 화면을 관리합니다." />
              <form className="panel settings-panel" onSubmit={(event) => { event.preventDefault(); setToast("설정을 저장했습니다."); }}>
                <div className="panel-heading"><strong>알림 설정</strong><span>Asia/Seoul</span></div>
                <label className="setting-row"><span><strong>아침 계획 알림</strong><small>일정·할 일·운동 입력을 요청합니다.</small></span><input type="checkbox" checked={notificationEnabled} onChange={(event) => setNotificationEnabled(event.target.checked)} /></label>
                <label className="setting-row"><span><strong>알림 시간</strong><small>선택한 시간에 PWA 푸시를 보냅니다.</small></span><input type="time" value={notificationTime} onChange={(event) => setNotificationTime(event.target.value)} /></label>
                <div className="setting-copy"><strong>알림 요일</strong><small>선택한 요일에만 전송합니다.</small></div>
                <div className="day-options">{"월화수목금토일".split("").map((day) => <label key={day}><input type="checkbox" defaultChecked />{day}</label>)}</div>
                <div className="form-actions"><button className="primary-button" type="submit">설정 저장</button><button className="secondary-button" type="button" onClick={testNotification}>테스트 알림</button><button className="text-button" type="button" onClick={signOut}>로그아웃</button></div>
              </form>
            </section>
          )}
        </div>
      </main>

      {modal && (
        <EntryModal title={editingId ? `${pageTitles[page]} 수정` : modalTitle(modal)} description={modalDescription(modal)} onClose={closeModal}>
          {modal === "intake" && <IntakeForm parsed={intakeParsed} onParse={() => setIntakeParsed(true)} onSave={() => { closeModal(); setToast("오늘 계획을 등록했습니다."); }} />}
          {modal === "task" && <TaskForm initial={tasks.find((item) => item.id === editingId)} projects={projects} defaultDate={todayDate} onSubmit={submitTask} />}
          {modal === "project" && <ProjectForm defaultDate={shiftDate(todayDate, 30)} onSubmit={submitProject} />}
          {modal === "workout" && <WorkoutForm initial={workouts.find((item) => item.id === editingId)} defaultDate={todayDate} onSubmit={submitWorkout} />}
          {modal === "money" && <TransactionForm initial={transactions.find((item) => item.id === editingId)} defaultDate={todayDate} onSubmit={submitTransaction} />}
          {editingId && <button className="secondary-button" type="button" onClick={closeModal}>취소</button>}
        </EntryModal>
      )}
    </div>
  );
}

function PageHeading({ title, description, actions }: { title: string; description: string; actions?: React.ReactNode }) {
  return <div className="page-heading"><div><h1>{title}</h1><p>{description}</p></div>{actions && <div className="heading-actions">{actions}</div>}</div>;
}

function Panel({ title, meta, action, className = "", children }: { title: string; meta?: string; action?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return <article className={`panel ${className}`}><div className="panel-heading"><strong>{title}</strong>{action ?? <span>{meta}</span>}</div>{children}</article>;
}

function ListRow({ title, detail, value }: { title: string; detail: string; value: string }) {
  return <div className="list-row"><div><strong>{title}</strong><small>{detail}</small></div><span>{value}</span></div>;
}

function MarketRow({ name, value }: { name: string; value: string }) {
  return <div className="market-row"><span>{name}</span><strong>{value}</strong></div>;
}

function MoneySummary({ title, value, detail, comparison = false }: { title: string; value: number; detail: string; comparison?: boolean }) {
  const tone = comparison ? (value > 0 ? "negative" : value < 0 ? "positive" : "neutral") : (value >= 0 ? "positive" : "negative");
  return <article className="money-summary"><span>{title}</span><strong className={tone}>{signedWon(value)}</strong><small>{detail}</small></article>;
}

function TaskButton({ task, onClick, onStartMove, onEndMove, moving = false }: { task: Task; onClick: () => void; onStartMove?: (id: string) => void; onEndMove?: () => void; moving?: boolean }) {
  const longPressTimer = useRef<number | null>(null);
  const pointerStart = useRef({ x: 0, y: 0 });

  function cancelLongPress() {
    if (longPressTimer.current !== null) window.clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
  }

  return <button
    type="button"
    className={moving ? "task-button moving" : "task-button"}
    onClick={(event) => { event.stopPropagation(); onClick(); }}
    draggable={Boolean(onStartMove)}
    aria-pressed={moving || undefined}
    aria-keyshortcuts={onStartMove ? "Alt+M" : undefined}
    title={onStartMove ? "드래그하거나 길게 누르기, 또는 Alt+M으로 이동" : undefined}
    onKeyDown={(event) => {
      if (onStartMove && event.altKey && event.key.toLowerCase() === "m") {
        event.preventDefault();
        event.stopPropagation();
        onStartMove(task.id);
      }
    }}
    onDragStart={(event) => { event.dataTransfer.setData("text/plain", task.id); event.dataTransfer.effectAllowed = "move"; onStartMove?.(task.id); }}
    onDragEnd={onEndMove}
    onPointerDown={(event) => { pointerStart.current = { x: event.clientX, y: event.clientY }; if (onStartMove) longPressTimer.current = window.setTimeout(() => onStartMove(task.id), 550); }}
    onPointerMove={(event) => { if (Math.hypot(event.clientX - pointerStart.current.x, event.clientY - pointerStart.current.y) > 8) cancelLongPress(); }}
    onPointerUp={cancelLongPress}
    onPointerCancel={cancelLongPress}
    onPointerLeave={cancelLongPress}
    onContextMenu={(event) => { if (onStartMove) event.preventDefault(); }}
  ><span>{task.title}</span><em>{task.priority}</em></button>;
}

function draggedTaskId(event: React.DragEvent<HTMLElement>) {
  return event.dataTransfer.getData("text/plain") || undefined;
}

function activateMoveTarget(event: React.KeyboardEvent<HTMLElement>, move: () => void) {
  if (event.target !== event.currentTarget || (event.key !== "Enter" && event.key !== " ")) return;
  event.preventDefault();
  move();
}

type CalendarMoveProps = {
  movingTaskId: string | null;
  onStartMove: (id: string) => void;
  onEndMove: () => void;
  onMoveToDate: (date: string, taskId?: string) => void;
};

function WeekView({ weekStart, todayDate, tasks, onSelect, movingTaskId, onStartMove, onEndMove, onMoveToDate }: { weekStart: string; todayDate: string; tasks: Task[]; onSelect: (id: string) => void } & CalendarMoveProps) {
  const dates = Array.from({ length: 7 }, (_, index) => shiftDate(weekStart, index));
  return <div className="week-grid">{dates.map((date, index) => {
    const day = Number(date.slice(-2));
    return <div
      className={`${date === todayDate ? "day-column today" : "day-column"}${movingTaskId ? " drop-target" : ""}`}
      key={date}
      tabIndex={movingTaskId ? 0 : undefined}
      onClick={() => onMoveToDate(date)}
      onKeyDown={(event) => activateMoveTarget(event, () => onMoveToDate(date))}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => { event.preventDefault(); onMoveToDate(date, draggedTaskId(event)); }}
    ><strong>{["월", "화", "수", "목", "금", "토", "일"][index]} {day}</strong>{tasks.filter((task) => task.scheduledDate === date).map((task) => <TaskButton key={task.id} task={task} moving={movingTaskId === task.id} onStartMove={onStartMove} onEndMove={onEndMove} onClick={() => onSelect(task.id)} />)}</div>;
  })}</div>;
}

function MonthView({ month, todayDate, tasks, onSelect, movingTaskId, onStartMove, onEndMove, onMoveToDate }: { month: string; todayDate: string; tasks: Task[]; onSelect: (id: string) => void } & CalendarMoveProps) {
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
              className={`${date === todayDate ? "month-cell today" : "month-cell"}${movingTaskId ? " drop-target" : ""}`}
              role="gridcell"
              aria-label={`${monthLabel(month)} ${day}일`}
              key={date}
              tabIndex={movingTaskId ? 0 : undefined}
              onClick={() => onMoveToDate(date)}
              onKeyDown={(event) => activateMoveTarget(event, () => onMoveToDate(date))}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => { event.preventDefault(); onMoveToDate(date, draggedTaskId(event)); }}
            ><time dateTime={date}>{day}</time>{dayTasks.map((task) => <TaskButton key={task.id} task={task} moving={movingTaskId === task.id} onStartMove={onStartMove} onEndMove={onEndMove} onClick={() => onSelect(task.id)} />)}</div>;
          })}
        </div>)}
      </div>
    </div>
  );
}

function TaskKanban({ tasks, onSelect, movingTaskId, onStartMove, onEndMove, onMoveToStatus }: { tasks: Task[]; onSelect: (id: string) => void; movingTaskId: string | null; onStartMove: (id: string) => void; onEndMove: () => void; onMoveToStatus: (status: TaskStatus, taskId?: string) => void }) {
  return <div className="kanban">{(["todo", "doing", "done"] as TaskStatus[]).map((status) => <div
    className={`kanban-column${movingTaskId ? " drop-target" : ""}`}
    key={status}
    role="group"
    aria-label={`${statusLabel[status]} 영역`}
    tabIndex={movingTaskId ? 0 : undefined}
    onClick={() => onMoveToStatus(status)}
    onKeyDown={(event) => activateMoveTarget(event, () => onMoveToStatus(status))}
    onDragOver={(event) => event.preventDefault()}
    onDrop={(event) => { event.preventDefault(); onMoveToStatus(status, draggedTaskId(event)); }}
  ><strong>{statusLabel[status]} · {tasks.filter((task) => task.status === status).length}</strong>{tasks.filter((task) => task.status === status).map((task) => <TaskButton key={task.id} task={task} moving={movingTaskId === task.id} onStartMove={onStartMove} onEndMove={onEndMove} onClick={() => onSelect(task.id)} />)}</div>)}</div>;
}

function TaskDetail({ task, project }: { task: Task; project?: Project }) {
  return <aside className="detail-panel"><strong>{task.title}</strong><div className="detail-grid"><div><span>프로젝트</span><strong>{project?.name ?? "프로젝트 없음"}</strong></div><div><span>우선순위</span><strong>{priorityLabel[task.priority]}</strong></div><div><span>마감</span><strong>{displayDate(task.dueDate)}</strong></div><div><span>예상 시간</span><strong>{task.estimatedMinutes}분</strong></div></div><div className="description"><span>상세 내용</span><p>{task.description}</p></div></aside>;
}

function ProjectKanban({ projects, onSelect }: { projects: Project[]; onSelect: (id: string) => void }) {
  const labels = { ready: "준비", doing: "진행 중", done: "완료" } as const;
  return <div className="kanban">{(["ready", "doing", "done"] as const).map((status) => <div className="kanban-column" key={status}><strong>{labels[status]}</strong>{projects.filter((project) => project.status === status).map((project) => <button className="project-card" key={project.id} onClick={() => onSelect(project.id)}><strong>{project.name}</strong><span>{priorityLabel[project.priority]} · {project.progress}%</span></button>)}</div>)}</div>;
}

function ProjectDetail({ project }: { project: Project }) {
  return <aside className="detail-panel"><strong>{project.name}</strong><div className="detail-grid"><div><span>우선순위</span><strong>{priorityLabel[project.priority]}</strong></div><div><span>진행률</span><strong>{project.progress}%</strong></div><div><span>목표 완료일</span><strong>{displayDate(project.dueDate)}</strong></div></div><div className="description"><span>프로젝트 설명</span><p>{project.description}</p></div></aside>;
}

function EntryModal({ title, description, onClose, children }: { title: string; description: string; onClose: () => void; children: React.ReactNode }) {
  const modalRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const modal = modalRef.current;
    const initialFocus = modal?.querySelector<HTMLElement>("input:not([disabled]), textarea:not([disabled]), select:not([disabled])")
      ?? modal?.querySelector<HTMLElement>("button:not([disabled])");
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

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [onClose]);

  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div ref={modalRef} className="modal" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} tabIndex={-1}><div className="modal-heading"><div><h2 id={titleId}>{title}</h2><p id={descriptionId}>{description}</p></div><button type="button" className="close-button" onClick={onClose} aria-label="닫기">×</button></div>{children}</div></div>;
}

function ModalActions({ submitLabel }: { submitLabel: string }) {
  return <div className="form-actions"><button className="primary-button" type="submit">{submitLabel}</button></div>;
}

function IntakeForm({ parsed, onParse, onSave }: { parsed: boolean; onParse: () => void; onSave: () => void }) {
  return <div><label className="field"><span>오늘 계획</span><textarea defaultValue="오전 10시 팀 회의, 오후에는 기획안 정리 P1. 퇴근 후 하체 운동 50분." /></label>{parsed && <div className="parse-grid"><div>일정 · 10:00 팀 회의</div><div>할 일 · 기획안 정리 · P1</div><div>운동 · 하체 · 50분</div></div>}<div className="form-actions"><button className="secondary-button" type="button" onClick={onParse}>분석하기</button>{parsed && <button className="primary-button" type="button" onClick={onSave}>등록하기</button>}</div></div>;
}

function TaskForm({ initial, projects, defaultDate, onSubmit }: { initial?: Task; projects: Project[]; defaultDate: string; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <form onSubmit={onSubmit}><div className="form-grid"><Field name="title" label="할 일 제목" defaultValue={initial?.title !== undefined ? String(initial.title) : "QA 완료 조건 확인"} required /><label className="field"><span>프로젝트</span><select name="projectId" defaultValue={initial?.projectId}><option value="">프로젝트 없음</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label><SelectPriority defaultValue={initial?.priority} /><Field name="scheduledDate" label={initial ? "예정일" : "예정일 / 마감일"} type="date" defaultValue={initial?.scheduledDate ?? defaultDate} required />{initial && <Field name="dueDate" label="마감일" type="date" defaultValue={initial.dueDate} required />}<label className="field"><span>반복</span><select name="recurrence"><option>반복 없음</option><option>매일</option><option>매주</option><option>매월</option></select></label><Field name="estimatedMinutes" label="예상 소요시간(분)" type="number" defaultValue={initial?.estimatedMinutes !== undefined ? String(initial.estimatedMinutes) : "90"} required /></div><label className="field"><span>상세 내용</span><textarea name="description" defaultValue={initial?.description ?? "로그인, 알림 권한, 오프라인 상태의 완료 조건을 확인하고 발견된 이슈를 정리한다."} required /></label><ModalActions submitLabel={initial ? "수정 저장" : "할 일 저장"} /></form>;
}

function ProjectForm({ defaultDate, onSubmit }: { defaultDate: string; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <form onSubmit={onSubmit}><div className="form-grid"><Field name="name" label="프로젝트 이름" defaultValue="신규 PWA 출시" required /><SelectPriority /><Field name="dueDate" label="목표 완료일" type="date" defaultValue={defaultDate} required /><Field name="milestone" label="첫 마일스톤" defaultValue="MVP 기능 확정" /></div><label className="field"><span>프로젝트 설명</span><textarea name="description" defaultValue="생활 관리 기능을 하나의 모바일 PWA로 통합하고 매일 아침 계획 입력 알림을 제공한다." required /></label><ModalActions submitLabel="프로젝트 저장" /></form>;
}

function WorkoutForm({ initial, defaultDate, onSubmit }: { initial?: Workout; defaultDate: string; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <form onSubmit={onSubmit}><div className="form-grid"><Field name="title" label="운동명" defaultValue={initial?.title !== undefined ? String(initial.title) : "하체 근력 운동"} required /><Field name="startedAt" label="운동 일시" type="datetime-local" defaultValue={initial?.startedAt ?? `${defaultDate}T19:00`} required /><Field name="place" label="장소" defaultValue={initial?.place !== undefined ? String(initial.place) : "헬스장"} required /><Field name="durationMinutes" label="운동 시간(분)" type="number" defaultValue={initial?.durationMinutes !== undefined ? String(initial.durationMinutes) : "50"} required /><Field name="exercise" label="운동 종목" defaultValue={initial?.exercise !== undefined ? String(initial.exercise) : "스쿼트"} required /><Field name="sets" label="세트 수" type="number" defaultValue={initial?.sets !== undefined ? String(initial.sets) : "4"} required /><Field name="reps" label="횟수" type="number" defaultValue={initial?.reps !== undefined ? String(initial.reps) : "8"} required /><Field name="weightKg" label="중량(kg)" type="number" defaultValue={initial?.weightKg !== undefined ? String(initial.weightKg) : "80"} required /></div><ModalActions submitLabel={initial ? "수정 저장" : "운동 저장"} /></form>;
}

function TransactionForm({ initial, defaultDate, onSubmit }: { initial?: Transaction; defaultDate: string; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <form onSubmit={onSubmit}><div className="form-grid"><Field name="happenedAt" label="거래 일시" type="datetime-local" defaultValue={initial?.happenedAt ?? `${defaultDate}T12:00`} required /><label className="field"><span>수입 / 지출</span><select name="flow" defaultValue={initial?.flow}><option value="expense">− 지출</option><option value="income">+ 수입</option></select></label><Field name="name" label="내역" defaultValue={initial?.name !== undefined ? String(initial.name) : "점심"} required /><Field name="merchant" label="사용처" defaultValue={initial?.merchant !== undefined ? String(initial.merchant) : "회사 근처 식당"} required /><Field name="amount" label="금액" type="number" defaultValue={initial?.amount !== undefined ? String(initial.amount) : "12000"} required /><label className="field"><span>카테고리</span><select name="category" defaultValue={initial?.category}><option>소비 › 식비</option><option>소비 › 카페·간식</option><option>소비 › 교통</option><option>소비 › 주거</option><option>투자 › 국내주식</option><option>투자 › 미국주식</option><option>수입 › 급여</option><option>수입 › 기타</option></select></label><label className="field"><span>금융 계좌</span><select name="account" defaultValue={initial?.account}><option>신한 신용카드</option><option>국민 체크카드</option><option>생활비 계좌</option><option>현금</option><option>증권 계좌</option></select></label></div><ModalActions submitLabel={initial ? "수정 저장" : "등록"} /></form>;
}

function Field({ name, label, type = "text", defaultValue, required = false }: { name: string; label: string; type?: string; defaultValue?: string; required?: boolean }) {
  return <label className="field"><span>{label}</span><input name={name} type={type} defaultValue={defaultValue} required={required} /></label>;
}

function SelectPriority({ defaultValue }: { defaultValue?: Priority } = {}) {
  return <label className="field"><span>우선순위</span><select name="priority" defaultValue={defaultValue}>{(["P1", "P2", "P3", "P4"] as Priority[]).map((priority) => <option key={priority} value={priority}>{priorityLabel[priority]}</option>)}</select></label>;
}

function modalTitle(modal: Exclude<ModalName, null>) {
  return { intake: "오늘 계획 입력", task: "새 할 일", project: "새 프로젝트", workout: "운동 기록", money: "가계부 거래 등록" }[modal];
}

function modalDescription(modal: Exclude<ModalName, null>) {
  return {
    intake: "자연어를 일정·할 일·운동으로 나눕니다.",
    task: "상세 내용과 우선순위를 함께 기록합니다.",
    project: "프로젝트의 목적과 첫 마일스톤을 정합니다.",
    workout: "운동 정보와 세트 내용을 입력합니다.",
    money: "수입과 지출을 +/- 흐름으로 구분해 기록합니다."
  }[modal];
}
