import type { Project, Task, Transaction, Workout } from "./types";

export const initialProjects: Project[] = [
  {
    id: "project-cj",
    name: "CJ ENM 대만 오픈",
    description: "대만 서비스 오픈을 위해 현지 요구사항, QA, 배포 일정을 통합 관리합니다.",
    priority: "P1",
    status: "doing",
    progress: 62,
    dueDate: "2026-08-30"
  },
  {
    id: "project-life",
    name: "개인 생활 시스템",
    description: "일정, 운동, 소비 기록을 부담 없이 입력할 수 있는 개인 시스템을 구축합니다.",
    priority: "P2",
    status: "doing",
    progress: 35,
    dueDate: "2026-09-15"
  },
  {
    id: "project-trip",
    name: "여행 계획",
    description: "항공권과 숙소를 예약하고 일자별 동선을 정리합니다.",
    priority: "P3",
    status: "ready",
    progress: 10,
    dueDate: "2026-10-02"
  }
];

export const initialTasks: Task[] = [
  {
    id: "task-qa",
    title: "테스트 시나리오 정리",
    description: "로그인부터 푸시 알림 수신까지 사용자 흐름별 기대 결과를 정리합니다.",
    projectId: "project-cj",
    priority: "P1",
    status: "doing",
    scheduledDate: "2026-08-26",
    dueDate: "2026-08-26",
    estimatedMinutes: 90
  },
  {
    id: "task-wireframe",
    title: "와이어프레임 피드백 반영",
    description: "모바일 화면의 입력 동선과 고정 메뉴 위치를 최종 점검합니다.",
    projectId: "project-life",
    priority: "P2",
    status: "doing",
    scheduledDate: "2026-08-26",
    dueDate: "2026-08-27",
    estimatedMinutes: 60
  },
  {
    id: "task-doc",
    title: "배포 문서 리뷰",
    description: "배포 체크리스트와 운영 가이드의 누락 항목을 확인합니다.",
    projectId: "project-cj",
    priority: "P2",
    status: "todo",
    scheduledDate: "2026-08-27",
    dueDate: "2026-08-28",
    estimatedMinutes: 45
  },
  {
    id: "task-hospital",
    title: "병원 예약하기",
    description: "정기 검진 가능한 날짜를 확인한 뒤 병원에 예약합니다.",
    priority: "P3",
    status: "todo",
    scheduledDate: "2026-08-28",
    dueDate: "2026-08-28",
    estimatedMinutes: 15
  }
];

export const initialWorkouts: Workout[] = [
  {
    id: "workout-legs",
    title: "하체 근력 운동",
    startedAt: "2026-08-26T19:00",
    place: "헬스장",
    durationMinutes: 50,
    exercise: "스쿼트",
    sets: 4,
    reps: 8,
    weightKg: 80
  }
];

export const initialTransactions: Transaction[] = [
  {
    id: "transaction-lunch",
    happenedAt: "2026-08-26T12:31",
    name: "점심",
    merchant: "회사 근처 식당",
    amount: 12000,
    category: "소비 › 식비",
    account: "신한 신용카드"
  },
  {
    id: "transaction-coffee",
    happenedAt: "2026-08-25T19:10",
    name: "커피",
    merchant: "카페",
    amount: 5500,
    category: "소비 › 카페·간식",
    account: "국민 체크카드"
  }
];
