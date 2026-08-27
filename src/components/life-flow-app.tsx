"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { initialProjects, initialTasks, initialTransactions, initialWorkouts } from "@/lib/sample-data";
import type { ModalName, PageName, Priority, Project, Task, TaskStatus, Transaction, Workout } from "@/lib/types";

const navigation: Array<{ page: PageName; icon: string; label: string }> = [
  { page: "dashboard", icon: "⌂", label: "홈" },
  { page: "tasks", icon: "✓", label: "할 일" },
  { page: "projects", icon: "▣", label: "프로젝트" },
  { page: "workouts", icon: "◇", label: "운동" },
  { page: "money", icon: "₩", label: "돈 관리" },
  { page: "settings", icon: "⚙", label: "설정" }
];

const pageTitles: Record<PageName, string> = {
  dashboard: "대시보드",
  tasks: "할 일",
  projects: "프로젝트",
  workouts: "운동 관리",
  money: "돈 관리",
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

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function won(value: number) {
  return `${new Intl.NumberFormat("ko-KR").format(value)}원`;
}

function displayDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric" }).format(new Date(value));
}

export function LifeFlowApp() {
  const [authenticated, setAuthenticated] = useState(false);
  const [page, setPage] = useState<PageName>("dashboard");
  const [modal, setModal] = useState<ModalName>(null);
  const [toast, setToast] = useState("");
  const [projects, setProjects] = useState(initialProjects);
  const [tasks, setTasks] = useState(initialTasks);
  const [workouts, setWorkouts] = useState(initialWorkouts);
  const [transactions, setTransactions] = useState(initialTransactions);
  const [selectedTaskId, setSelectedTaskId] = useState(initialTasks[0].id);
  const [selectedProjectId, setSelectedProjectId] = useState(initialProjects[0].id);
  const [taskView, setTaskView] = useState<"week" | "month" | "kanban">("week");
  const [notificationTime, setNotificationTime] = useState("08:00");
  const [notificationEnabled, setNotificationEnabled] = useState(true);
  const [intakeParsed, setIntakeParsed] = useState(false);

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
  const todayTasks = tasks.filter((task) => task.scheduledDate === "2026-08-26" && task.status !== "done");

  const projectById = useMemo(
    () => Object.fromEntries(projects.map((project) => [project.id, project])),
    [projects]
  );

  function navigate(nextPage: PageName) {
    setPage(nextPage);
    setModal(null);
  }

  function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthenticated(true);
  }

  function submitTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const task: Task = {
      id: uid("task"),
      title: String(form.get("title")),
      description: String(form.get("description")),
      projectId: String(form.get("projectId")) || undefined,
      priority: String(form.get("priority")) as Priority,
      status: "todo",
      scheduledDate: String(form.get("scheduledDate")),
      dueDate: String(form.get("scheduledDate")),
      estimatedMinutes: Number(form.get("estimatedMinutes"))
    };
    setTasks((current) => [task, ...current]);
    setSelectedTaskId(task.id);
    setModal(null);
    setToast("새 할 일을 저장했습니다.");
  }

  function submitProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const project: Project = {
      id: uid("project"),
      name: String(form.get("name")),
      description: String(form.get("description")),
      priority: String(form.get("priority")) as Priority,
      status: "ready",
      progress: 0,
      dueDate: String(form.get("dueDate"))
    };
    setProjects((current) => [project, ...current]);
    setSelectedProjectId(project.id);
    setModal(null);
    setToast("새 프로젝트를 저장했습니다.");
  }

  function submitWorkout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const workout: Workout = {
      id: uid("workout"),
      title: String(form.get("title")),
      startedAt: String(form.get("startedAt")),
      place: String(form.get("place")),
      durationMinutes: Number(form.get("durationMinutes")),
      exercise: String(form.get("exercise")),
      sets: Number(form.get("sets")),
      reps: Number(form.get("reps")),
      weightKg: Number(form.get("weightKg"))
    };
    setWorkouts((current) => [workout, ...current]);
    setModal(null);
    setToast("운동 기록을 저장했습니다.");
  }

  function submitTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const transaction: Transaction = {
      id: uid("transaction"),
      happenedAt: new Date().toISOString(),
      name: String(form.get("name")),
      merchant: String(form.get("merchant")),
      amount: Number(form.get("amount")),
      category: String(form.get("category")),
      account: String(form.get("account"))
    };
    setTransactions((current) => [transaction, ...current]);
    setModal(null);
    setToast("돈 사용 내역을 등록했습니다.");
  }

  async function testNotification() {
    if (!("Notification" in window)) {
      setToast("이 브라우저는 알림을 지원하지 않습니다.");
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setToast("알림 권한이 허용되지 않았습니다.");
      return;
    }
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification("Life Flow", {
      body: `${notificationTime}에 오늘 계획 입력 알림을 보냅니다.`,
      icon: "/icon.svg"
    });
    setToast("테스트 알림을 표시했습니다.");
  }

  if (!authenticated) {
    return (
      <main className="login-page">
        <form className="login-card" onSubmit={submitLogin}>
          <div className="brand"><span className="brand-mark">L</span><span>Life Flow</span></div>
          <div>
            <h1>다시 오신 것을 환영해요</h1>
            <p>오늘의 일정과 생활 기록을 한곳에서 관리하세요.</p>
          </div>
          <label><span>이메일</span><input type="email" defaultValue="jejoon@example.com" required /></label>
          <label><span>비밀번호</span><input type="password" defaultValue="password123" required /></label>
          <button className="primary-button full-button" type="submit">로그인</button>
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
          <span className="header-date">2026년 8월 26일 · 서울</span>
        </header>
        <div className="page-content">
          {toast && <div className="toast" role="status">{toast}</div>}

          {page === "dashboard" && (
            <section>
              <PageHeading
                title="좋은 아침이에요"
                description="오늘 필요한 것만 확인하고 바로 기록하세요."
                actions={<><button className="secondary-button" onClick={() => setModal("money")}>돈 사용 입력</button><button className="primary-button" onClick={() => setModal("intake")}>오늘 계획 입력</button></>}
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
              <Panel title="진행 중 프로젝트" className="wide-panel" action={<button className="text-button" onClick={() => navigate("projects")}>전체 보기</button>}>
                <div className="project-summary-grid">
                  {projects.filter((project) => project.status === "doing").map((project) => (
                    <button key={project.id} className="project-summary" onClick={() => { setSelectedProjectId(project.id); navigate("projects"); }}>
                      <strong>{project.name}</strong><span>{priorityLabel[project.priority]} · {displayDate(project.dueDate)}</span><span className="progress"><i style={{ width: `${project.progress}%` }} /></span>
                    </button>
                  ))}
                </div>
              </Panel>
            </section>
          )}

          {page === "tasks" && (
            <section>
              <PageHeading title="할 일" description="주·월 단위와 칸반 상태를 같은 데이터로 확인합니다." actions={<button className="primary-button" onClick={() => setModal("task")}>+ 할 일</button>} />
              <div className="view-toolbar">
                <div className="segmented">
                  {(["week", "month", "kanban"] as const).map((view) => <button key={view} className={taskView === view ? "active" : ""} onClick={() => setTaskView(view)}>{view === "week" ? "주" : view === "month" ? "월" : "칸반"}</button>)}
                </div>
                <span>8월 24일 – 8월 30일</span>
              </div>
              {taskView === "week" && <WeekView tasks={tasks} onSelect={setSelectedTaskId} />}
              {taskView === "month" && <MonthView tasks={tasks} onSelect={setSelectedTaskId} />}
              {taskView === "kanban" && <TaskKanban tasks={tasks} onSelect={setSelectedTaskId} />}
              {selectedTask && <TaskDetail task={selectedTask} project={selectedTask.projectId ? projectById[selectedTask.projectId] : undefined} />}
            </section>
          )}

          {page === "projects" && (
            <section>
              <PageHeading title="프로젝트" description="프로젝트 칸반과 내부 WBS를 연결합니다." actions={<button className="primary-button" onClick={() => setModal("project")}>+ 프로젝트</button>} />
              <ProjectKanban projects={projects} onSelect={setSelectedProjectId} />
              {selectedProject && <ProjectDetail project={selectedProject} />}
            </section>
          )}

          {page === "workouts" && (
            <section>
              <PageHeading title="운동 관리" description="운동 세션과 세트별 상세를 기록합니다." actions={<button className="primary-button" onClick={() => setModal("workout")}>+ 운동 기록</button>} />
              <div className="dashboard-grid">
                {workouts.map((workout) => <Panel key={workout.id} title={workout.title} meta={displayDate(workout.startedAt)}><p className="record-copy">{workout.place} · {workout.durationMinutes}분</p><p className="record-copy">{workout.exercise} · {workout.sets}세트 × {workout.reps}회 · {workout.weightKg}kg</p></Panel>)}
              </div>
            </section>
          )}

          {page === "money" && (
            <section>
              <PageHeading title="돈 관리" description="차트 없이 최근 사용 내역을 빠르게 확인합니다." actions={<button className="primary-button" onClick={() => setModal("money")}>+ 돈 사용 등록</button>} />
              <Panel title="최근 거래" meta={`${transactions.length}건`}>
                <div className="table-scroll"><table><thead><tr><th>일시</th><th>내역</th><th>사용처</th><th>카테고리</th><th className="number">금액</th></tr></thead><tbody>{transactions.map((transaction) => <tr key={transaction.id}><td>{displayDate(transaction.happenedAt)}</td><td>{transaction.name}</td><td>{transaction.merchant}</td><td>{transaction.category}</td><td className="number">{won(transaction.amount)}</td></tr>)}</tbody></table></div>
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
                <div className="form-actions"><button className="primary-button" type="submit">설정 저장</button><button className="secondary-button" type="button" onClick={testNotification}>테스트 알림</button></div>
              </form>
            </section>
          )}
        </div>
      </main>

      {modal && (
        <EntryModal title={modalTitle(modal)} description={modalDescription(modal)} onClose={() => setModal(null)}>
          {modal === "intake" && <IntakeForm parsed={intakeParsed} onParse={() => setIntakeParsed(true)} onSave={() => { setModal(null); setIntakeParsed(false); setToast("오늘 계획을 등록했습니다."); }} />}
          {modal === "task" && <TaskForm projects={projects} onSubmit={submitTask} />}
          {modal === "project" && <ProjectForm onSubmit={submitProject} />}
          {modal === "workout" && <WorkoutForm onSubmit={submitWorkout} />}
          {modal === "money" && <TransactionForm onSubmit={submitTransaction} />}
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

function TaskButton({ task, onClick }: { task: Task; onClick: () => void }) {
  return <button type="button" className="task-button" onClick={onClick}><span>{task.title}</span><em>{task.priority}</em></button>;
}

function WeekView({ tasks, onSelect }: { tasks: Task[]; onSelect: (id: string) => void }) {
  const days = [24, 25, 26, 27, 28, 29, 30];
  return <div className="week-grid">{days.map((day) => <div className={day === 26 ? "day-column today" : "day-column"} key={day}><strong>{["월", "화", "수", "목", "금", "토", "일"][day - 24]} {day}</strong>{tasks.filter((task) => Number(task.scheduledDate.slice(-2)) === day).map((task) => <TaskButton key={task.id} task={task} onClick={() => onSelect(task.id)} />)}</div>)}</div>;
}

function MonthView({ tasks, onSelect }: { tasks: Task[]; onSelect: (id: string) => void }) {
  const days = Array.from({ length: 14 }, (_, index) => index + 24);
  return <div className="month-grid">{days.map((day) => <div className={day === 26 ? "month-cell today" : "month-cell"} key={day}><strong>{day > 31 ? day - 31 : day}</strong>{tasks.filter((task) => Number(task.scheduledDate.slice(-2)) === day).map((task) => <button key={task.id} onClick={() => onSelect(task.id)}>{task.title}</button>)}</div>)}</div>;
}

function TaskKanban({ tasks, onSelect }: { tasks: Task[]; onSelect: (id: string) => void }) {
  return <div className="kanban">{(["todo", "doing", "done"] as TaskStatus[]).map((status) => <div className="kanban-column" key={status}><strong>{statusLabel[status]} · {tasks.filter((task) => task.status === status).length}</strong>{tasks.filter((task) => task.status === status).map((task) => <TaskButton key={task.id} task={task} onClick={() => onSelect(task.id)} />)}</div>)}</div>;
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
  return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className="modal"><div className="modal-heading"><div><h2>{title}</h2><p>{description}</p></div><button type="button" className="close-button" onClick={onClose} aria-label="닫기">×</button></div>{children}</div></div>;
}

function ModalActions({ submitLabel }: { submitLabel: string }) {
  return <div className="form-actions"><button className="primary-button" type="submit">{submitLabel}</button></div>;
}

function IntakeForm({ parsed, onParse, onSave }: { parsed: boolean; onParse: () => void; onSave: () => void }) {
  return <div><label className="field"><span>오늘 계획</span><textarea defaultValue="오전 10시 팀 회의, 오후에는 기획안 정리 P1. 퇴근 후 하체 운동 50분." /></label>{parsed && <div className="parse-grid"><div>일정 · 10:00 팀 회의</div><div>할 일 · 기획안 정리 · P1</div><div>운동 · 하체 · 50분</div></div>}<div className="form-actions"><button className="secondary-button" type="button" onClick={onParse}>분석하기</button>{parsed && <button className="primary-button" type="button" onClick={onSave}>등록하기</button>}</div></div>;
}

function TaskForm({ projects, onSubmit }: { projects: Project[]; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <form onSubmit={onSubmit}><div className="form-grid"><Field name="title" label="할 일 제목" defaultValue="QA 완료 조건 확인" required /><label className="field"><span>프로젝트</span><select name="projectId"><option value="">프로젝트 없음</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label><SelectPriority /><Field name="scheduledDate" label="예정일 / 마감일" type="date" defaultValue="2026-08-27" required /><label className="field"><span>반복</span><select name="recurrence"><option>반복 없음</option><option>매일</option><option>매주</option><option>매월</option></select></label><Field name="estimatedMinutes" label="예상 소요시간(분)" type="number" defaultValue="90" required /></div><label className="field"><span>상세 내용</span><textarea name="description" defaultValue="로그인, 알림 권한, 오프라인 상태의 완료 조건을 확인하고 발견된 이슈를 정리한다." required /></label><ModalActions submitLabel="할 일 저장" /></form>;
}

function ProjectForm({ onSubmit }: { onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <form onSubmit={onSubmit}><div className="form-grid"><Field name="name" label="프로젝트 이름" defaultValue="신규 PWA 출시" required /><SelectPriority /><Field name="dueDate" label="목표 완료일" type="date" defaultValue="2026-09-30" required /><Field name="milestone" label="첫 마일스톤" defaultValue="MVP 기능 확정" /></div><label className="field"><span>프로젝트 설명</span><textarea name="description" defaultValue="생활 관리 기능을 하나의 모바일 PWA로 통합하고 매일 아침 계획 입력 알림을 제공한다." required /></label><ModalActions submitLabel="프로젝트 저장" /></form>;
}

function WorkoutForm({ onSubmit }: { onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <form onSubmit={onSubmit}><div className="form-grid"><Field name="title" label="운동명" defaultValue="하체 근력 운동" required /><Field name="startedAt" label="운동 일시" type="datetime-local" defaultValue="2026-08-26T19:00" required /><Field name="place" label="장소" defaultValue="헬스장" required /><Field name="durationMinutes" label="운동 시간(분)" type="number" defaultValue="50" required /><Field name="exercise" label="운동 종목" defaultValue="스쿼트" required /><Field name="sets" label="세트 수" type="number" defaultValue="4" required /><Field name="reps" label="횟수" type="number" defaultValue="8" required /><Field name="weightKg" label="중량(kg)" type="number" defaultValue="80" required /></div><ModalActions submitLabel="운동 저장" /></form>;
}

function TransactionForm({ onSubmit }: { onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <form onSubmit={onSubmit}><div className="form-grid"><Field name="name" label="내역" defaultValue="점심" required /><Field name="merchant" label="사용처" defaultValue="회사 근처 식당" required /><Field name="amount" label="금액" type="number" defaultValue="12000" required /><label className="field"><span>카테고리</span><select name="category"><option>소비 › 식비</option><option>소비 › 카페·간식</option><option>소비 › 교통</option><option>투자 › 국내주식</option><option>투자 › 미국주식</option></select></label><label className="field"><span>금융 계좌</span><select name="account"><option>신한 신용카드</option><option>국민 체크카드</option><option>생활비 계좌</option><option>현금</option><option>증권 계좌</option></select></label></div><ModalActions submitLabel="등록" /></form>;
}

function Field({ name, label, type = "text", defaultValue, required = false }: { name: string; label: string; type?: string; defaultValue?: string; required?: boolean }) {
  return <label className="field"><span>{label}</span><input name={name} type={type} defaultValue={defaultValue} required={required} /></label>;
}

function SelectPriority() {
  return <label className="field"><span>우선순위</span><select name="priority">{(["P1", "P2", "P3", "P4"] as Priority[]).map((priority) => <option key={priority} value={priority}>{priorityLabel[priority]}</option>)}</select></label>;
}

function modalTitle(modal: Exclude<ModalName, null>) {
  return { intake: "오늘 계획 입력", task: "새 할 일", project: "새 프로젝트", workout: "운동 기록", money: "돈 사용 등록" }[modal];
}

function modalDescription(modal: Exclude<ModalName, null>) {
  return {
    intake: "자연어를 일정·할 일·운동으로 나눕니다.",
    task: "상세 내용과 우선순위를 함께 기록합니다.",
    project: "프로젝트의 목적과 첫 마일스톤을 정합니다.",
    workout: "운동 정보와 세트 내용을 입력합니다.",
    money: "무엇을, 어디에서, 얼마를 썼는지 기록합니다."
  }[modal];
}
