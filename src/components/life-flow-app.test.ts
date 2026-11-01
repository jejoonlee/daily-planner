import { createElement } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LifeFlowApp } from "./life-flow-app";

function login() {
  fireEvent.change(screen.getByLabelText("이메일"), { target: { value: "jejoon@example.com" } });
  fireEvent.change(screen.getByLabelText("비밀번호"), { target: { value: "password123" } });
  fireEvent.click(screen.getByRole("button", { name: "로그인" }));
}

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-08-28T09:00:00+09:00"));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("LifeFlowApp", () => {
  it("홈의 오늘 할 일은 상세 열기 닫기 수정 후에도 홈을 유지하고 전체 보기만 탭을 이동한다", () => {
    render(createElement(LifeFlowApp));
    login();
    const home = screen.getByRole("button", { name: "홈" });
    fireEvent.click(screen.getByRole("button", { name: /병원 예약하기/ }));
    expect(screen.getByRole("dialog", { name: "병원 예약하기" })).toBeInTheDocument();
    expect(home).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("heading", { name: "좋은 아침이에요" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "뒤로가기" }));
    expect(home).toHaveAttribute("aria-current", "page");
    fireEvent.click(screen.getByRole("button", { name: /병원 예약하기/ }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "수정" }));
    fireEvent.change(screen.getByLabelText("할 일 제목"), { target: { value: "검진 예약 확인" } });
    fireEvent.click(screen.getByRole("button", { name: "수정 저장" }));
    expect(home).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: /검진 예약 확인/ })).toBeInTheDocument();
    const todayPanel = screen.getByText("오늘 할 일").closest("article")!;
    fireEvent.click(within(todayPanel).getByRole("button", { name: "전체 보기" }));
    expect(screen.getByRole("button", { name: "할 일" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("heading", { name: "할 일 보기" })).toBeInTheDocument();
  });

  it("프로젝트 삭제를 취소하면 유지하고 확정하면 연결된 할 일을 보존한 채 연결만 해제한다", () => {
    render(createElement(LifeFlowApp));
    login();
    fireEvent.click(screen.getByRole("button", { name: "할 일" }));
    fireEvent.click(screen.getByRole("button", { name: /CJ ENM 대만 오픈/ }));
    let detail = within(screen.getByRole("dialog"));
    fireEvent.click(detail.getByRole("button", { name: "삭제" }));
    expect(detail.getByText("연결된 할 일 2개는 유지되며 프로젝트 연결이 해제됩니다.")).toBeInTheDocument();
    fireEvent.click(detail.getByRole("button", { name: "취소" }));
    expect(screen.getByRole("dialog", { name: "CJ ENM 대만 오픈" })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByRole("button", { name: /CJ ENM 대만 오픈/ })).toBeInTheDocument();
    expect(screen.getByText("3개")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /CJ ENM 대만 오픈/ }));
    detail = within(screen.getByRole("dialog"));
    fireEvent.click(detail.getByRole("button", { name: "삭제" }));
    fireEvent.click(detail.getByRole("button", { name: "삭제하기" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /CJ ENM 대만 오픈/ })).not.toBeInTheDocument();
    expect(screen.getByText("2개")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /개인 생활 시스템/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "칸반" }));
    for (const title of ["테스트 시나리오 정리", "와이어프레임 피드백 반영", "배포 문서 리뷰", "병원 예약하기"]) {
      expect(screen.getByRole("button", { name: new RegExp(title) })).toBeInTheDocument();
    }
    expect(within(screen.getByRole("group", { name: "진행 중 영역" })).getByRole("button", { name: /테스트 시나리오 정리/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /테스트 시나리오 정리/ }));
    detail = within(screen.getByRole("dialog"));
    expect(detail.getByText("프로젝트 없음")).toBeInTheDocument();
    fireEvent.click(detail.getByRole("button", { name: "수정" }));
    expect(screen.getByLabelText("프로젝트")).toHaveValue("");
    expect(screen.getByLabelText("예정일")).toHaveValue("2026-08-26");
    expect(screen.getByLabelText("마감일")).toHaveValue("2026-08-26");
    expect(screen.getByLabelText("우선순위")).toHaveValue("P1");
    expect(within(screen.getByLabelText("프로젝트")).queryByRole("option", { name: "CJ ENM 대만 오픈" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    fireEvent.click(screen.getByRole("button", { name: /와이어프레임 피드백 반영/ }));
    expect(within(screen.getByRole("dialog")).getByText("개인 생활 시스템")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: /배포 문서 리뷰/ }));
    expect(within(screen.getByRole("dialog")).getByText("프로젝트 없음")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "홈" }));
    expect(screen.queryByRole("button", { name: /CJ ENM 대만 오픈/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /개인 생활 시스템/ })).toBeInTheDocument();
  });

  it("할 일 삭제를 취소하면 유지하고 확정하면 주 월 칸반과 오늘 할 일에서 제거한다", () => {
    render(createElement(LifeFlowApp));
    login();
    const task = screen.getByRole("button", { name: /병원 예약하기/ });
    task.focus();
    fireEvent.click(task);
    let detail = within(screen.getByRole("dialog"));
    fireEvent.click(detail.getByRole("button", { name: "삭제" }));
    let confirmation = within(detail.getByRole("group", { name: "삭제 확인" }));
    expect(confirmation.getByText("‘병원 예약하기’ 항목을 삭제할까요?")).toBeInTheDocument();
    expect(confirmation.getByRole("button", { name: "취소" })).toHaveFocus();
    fireEvent.click(confirmation.getByRole("button", { name: "취소" }));
    expect(detail.queryByRole("group", { name: "삭제 확인" })).not.toBeInTheDocument();
    expect(detail.getByRole("button", { name: "삭제" })).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    const original = screen.getByRole("button", { name: /병원 예약하기/ });
    original.focus();
    fireEvent.click(original);
    detail = within(screen.getByRole("dialog"));
    fireEvent.click(detail.getByRole("button", { name: "삭제" }));
    confirmation = within(detail.getByRole("group", { name: "삭제 확인" }));
    fireEvent.click(confirmation.getByRole("button", { name: "삭제하기" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "좋은 아침이에요" })).toHaveFocus();
    expect(screen.getByRole("button", { name: "홈" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("오늘 예정된 할 일이 없습니다.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "할 일" }));
    for (const view of ["주", "월", "칸반"]) {
      fireEvent.click(screen.getByRole("button", { name: view }));
      expect(screen.queryByRole("button", { name: /병원 예약하기/ })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: /배포 문서 리뷰/ })).toBeInTheDocument();
    }
    fireEvent.click(screen.getByRole("button", { name: "홈" }));
    expect(screen.queryByRole("button", { name: /병원 예약하기/ })).not.toBeInTheDocument();
    expect(screen.getByText("오늘 예정된 할 일이 없습니다.")).toBeInTheDocument();
  });

  it("운동 삭제 확인을 ESC로 닫으면 유지하고 확정하면 빈 목록과 새 등록을 표시한다", () => {
    render(createElement(LifeFlowApp));
    login();
    fireEvent.click(screen.getByRole("button", { name: "운동" }));
    fireEvent.click(screen.getByRole("button", { name: /하체 근력 운동/ }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "삭제" }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /하체 근력 운동/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /하체 근력 운동/ }));
    const detail = within(screen.getByRole("dialog"));
    fireEvent.click(detail.getByRole("button", { name: "삭제" }));
    fireEvent.click(detail.getByRole("button", { name: "삭제하기" }));
    expect(screen.queryByRole("button", { name: /하체 근력 운동/ })).not.toBeInTheDocument();
    expect(screen.getByText("운동 기록이 없습니다.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "+ 운동 기록" }));
    expect(screen.getByRole("dialog", { name: "운동 기록" })).toBeInTheDocument();
  });

  it("가계부 삭제는 선택 거래만 제거하고 건수 월 잔액과 필터를 갱신한다", () => {
    render(createElement(LifeFlowApp));
    login();
    fireEvent.click(screen.getByRole("button", { name: "가계부" }));
    const summary = within(screen.getByText("이번 달 잔액").closest("article")!);
    expect(summary.getByText("+4,182,500원")).toBeInTheDocument();
    fireEvent.click(screen.getByText("카테고리 전체"));
    fireEvent.click(screen.getByLabelText("소비 › 카페·간식"));
    fireEvent.click(screen.getByRole("button", { name: /커피/ }));
    const detail = within(screen.getByRole("dialog"));
    fireEvent.click(detail.getByRole("button", { name: "삭제" }));
    fireEvent.click(detail.getByRole("button", { name: "취소" }));
    expect(summary.getByText("+4,182,500원")).toBeInTheDocument();
    fireEvent.click(detail.getByRole("button", { name: "삭제" }));
    fireEvent.click(detail.getByRole("button", { name: "삭제하기" }));
    expect(screen.queryByRole("button", { name: /커피/ })).not.toBeInTheDocument();
    expect(screen.getByText("2건")).toBeInTheDocument();
    expect(summary.getByText("+4,188,000원")).toBeInTheDocument();
    expect(summary.getByText("수입 4,200,000원 · 지출 12,000원")).toBeInTheDocument();
    expect(screen.getByText("카테고리 전체")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /월급/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /점심/ })).toBeInTheDocument();
  });

  it("할 일을 기존 값으로 수정하고 상태와 마감일을 유지한다", () => {
    render(createElement(LifeFlowApp));
    login();
    fireEvent.click(screen.getByRole("button", { name: "할 일" }));
    fireEvent.click(screen.getByRole("button", { name: "칸반" }));
    fireEvent.click(screen.getByRole("button", { name: /와이어프레임 피드백 반영/ }));
    expect(screen.getByRole("dialog", { name: "와이어프레임 피드백 반영" })).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "수정" }));
    expect(screen.getByRole("dialog", { name: "할 일 수정" })).toBeInTheDocument();
    expect(screen.getByLabelText("할 일 제목")).toHaveValue("와이어프레임 피드백 반영");
    expect(screen.getByLabelText("우선순위")).toHaveValue("P2");
    expect(screen.getByLabelText("마감일")).toHaveValue("2026-08-27");
    fireEvent.change(screen.getByLabelText("할 일 제목"), { target: { value: "수정한 할 일" } });
    fireEvent.click(screen.getByRole("button", { name: "수정 저장" }));
    expect(within(screen.getByRole("group", { name: "진행 중 영역" })).getByRole("button", { name: /수정한 할 일/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /수정한 할 일/ }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "수정" }));
    expect(screen.getByLabelText("마감일")).toHaveValue("2026-08-27");
    fireEvent.change(screen.getByLabelText("할 일 제목"), { target: { value: "취소할 제목" } });
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(screen.queryByText("취소할 제목")).not.toBeInTheDocument();
  });

  it("운동 수정은 중복을 만들지 않고 취소 후 새 입력과 분리된다", () => {
    render(createElement(LifeFlowApp));
    login();
    fireEvent.click(screen.getByRole("button", { name: "운동" }));
    fireEvent.click(screen.getByRole("button", { name: /하체 근력 운동/ }));
    expect(screen.getByRole("dialog", { name: "하체 근력 운동" })).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "수정" }));
    expect(screen.getByLabelText("중량(kg)")).toHaveValue(80);
    fireEvent.change(screen.getByLabelText("운동명"), { target: { value: "수정 운동" } });
    fireEvent.change(screen.getByLabelText("중량(kg)"), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "수정 저장" }));
    expect(screen.getAllByRole("button", { name: /수정 운동/ })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: /수정 운동/ }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "수정" }));
    expect(screen.getByLabelText("중량(kg)")).toHaveValue(0);
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "+ 운동 기록" }));
    expect(screen.getByRole("button", { name: "운동 저장" })).toBeInTheDocument();
    expect(screen.getByLabelText("중량(kg)")).toHaveValue(80);
  });

  it("가계부 수정은 금액을 검증하고 합계와 기존 계좌를 유지한다", () => {
    render(createElement(LifeFlowApp));
    login();
    fireEvent.click(screen.getByRole("button", { name: "가계부" }));
    fireEvent.click(screen.getByRole("button", { name: /월급/ }));
    expect(screen.getByRole("dialog", { name: "월급" })).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "수정" }));
    expect(screen.getByLabelText("수입 / 지출")).toHaveValue("income");
    expect(screen.getByLabelText("금융 계좌")).toHaveValue("생활비 계좌");
    fireEvent.change(screen.getByLabelText("금액"), { target: { value: "-1" } });
    fireEvent.click(screen.getByRole("button", { name: "수정 저장" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(within(screen.getByRole("dialog")).getByRole("alert")).toHaveTextContent("금액은 0원보다 커야 합니다.");
    fireEvent.change(screen.getByLabelText("금액"), { target: { value: "4300000" } });
    fireEvent.click(screen.getByRole("button", { name: "수정 저장" }));
    expect(screen.getByText("3건")).toBeInTheDocument();
    expect(within(screen.getByText("이번 달 잔액").closest("article")!).getByText("+4,282,500원")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /월급/ }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "수정" }));
    expect(screen.getByLabelText("금융 계좌")).toHaveValue("생활비 계좌");
  });

  it("로그인 후 대시보드와 주요 메뉴를 표시한다", () => {
    render(createElement(LifeFlowApp));

    login();

    expect(screen.getByRole("heading", { name: "좋은 아침이에요" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "할 일" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "가계부" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "프로젝트" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "할 일" }));

    const projectHeading = screen.getByRole("heading", { name: "프로젝트" });
    const taskHeading = screen.getByRole("heading", { name: "할 일 보기" });
    expect(projectHeading).toBeInTheDocument();
    expect(projectHeading.compareDocumentPosition(taskHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "월" }));

    expect(screen.getByRole("grid", { name: "2026년 8월 할 일 달력" })).toBeInTheDocument();
    expect(screen.getByRole("gridcell", { name: "2026년 8월 31일" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /병원 예약하기/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "이전 달" }));

    expect(screen.getByRole("grid", { name: "2026년 7월 할 일 달력" })).toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox", { name: "조회할 연도" }), { target: { value: "2027" } });
    fireEvent.change(screen.getByRole("combobox", { name: "조회할 월" }), { target: { value: "02" } });

    expect(screen.getByRole("grid", { name: "2027년 2월 할 일 달력" })).toBeInTheDocument();
    expect(screen.getByRole("gridcell", { name: "2027년 2월 28일" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "칸반" }));
    const task = screen.getByRole("button", { name: /배포 문서 리뷰/ });
    const doneColumn = screen.getByRole("group", { name: "완료 영역" });
    Object.defineProperty(document, "elementFromPoint", { configurable: true, value: vi.fn(() => doneColumn) });
    fireEvent.pointerDown(task, { pointerType: "mouse", pointerId: 1, button: 0, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(task, { pointerType: "mouse", pointerId: 1, buttons: 1, clientX: 30, clientY: 10 });
    fireEvent.pointerUp(task, { pointerType: "mouse", pointerId: 1, button: 0, clientX: 30, clientY: 10 });

    expect(within(doneColumn).getByRole("button", { name: /배포 문서 리뷰/ })).toBeInTheDocument();
    Object.defineProperty(document, "elementFromPoint", { configurable: true, value: undefined });

    fireEvent.click(screen.getByRole("button", { name: "가계부" }));

    expect(screen.getByRole("heading", { name: "가계부" })).toBeInTheDocument();
    expect(screen.getByText("전월 잔액")).toBeInTheDocument();
    expect(screen.getByText("이번 달 잔액")).toBeInTheDocument();
    expect(screen.getByText("전월 대비 지출")).toBeInTheDocument();
    expect(screen.getByLabelText("시작일")).toBeInTheDocument();
    expect(screen.getByLabelText("종료일")).toBeInTheDocument();

    fireEvent.click(screen.getByText("카테고리 전체"));
    fireEvent.click(screen.getByLabelText("소비 › 식비"));
    fireEvent.click(screen.getByLabelText("수입 › 급여"));

    expect(screen.getByText("카테고리 2개")).toBeInTheDocument();
    expect(screen.getByText("2건")).toBeInTheDocument();
  });

  it("마우스 드래그를 취소하면 카드 위치와 강조를 초기화한다", () => {
    render(createElement(LifeFlowApp));
    login();
    fireEvent.click(screen.getByRole("button", { name: "할 일" }));
    fireEvent.click(screen.getByRole("button", { name: "칸반" }));

    const task = screen.getByRole("button", { name: /배포 문서 리뷰/ });
    const todo = screen.getByRole("group", { name: "할 일 영역" });
    const doing = screen.getByRole("group", { name: "진행 중 영역" });
    const elementFromPoint = vi.fn<() => HTMLElement | null>(() => todo);
    Object.defineProperty(document, "elementFromPoint", { configurable: true, value: elementFromPoint });
    fireEvent.pointerDown(task, { pointerType: "mouse", pointerId: 1, button: 0, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(task, { pointerType: "mouse", pointerId: 1, buttons: 1, clientX: 25, clientY: 10 });
    expect(task).toHaveClass("pointer-dragging");
    expect(todo).toHaveClass("active-drop-target");
    expect(doing).not.toHaveClass("active-drop-target");
    expect(document.querySelectorAll(".active-drop-target")).toHaveLength(1);

    elementFromPoint.mockReturnValue(doing);
    fireEvent.pointerMove(task, { pointerType: "mouse", pointerId: 1, buttons: 1, clientX: 45, clientY: 10 });
    expect(todo).not.toHaveClass("active-drop-target");
    expect(doing).toHaveClass("active-drop-target");
    expect(document.querySelectorAll(".active-drop-target")).toHaveLength(1);
    expect(screen.getByText("옮길 날짜 또는 영역 위에서 카드를 놓으세요.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(task).not.toHaveClass("pointer-dragging");
    expect(task.style.transform).toBe("");
    expect(screen.queryByText("옮길 날짜 또는 영역 위에서 카드를 놓으세요.")).not.toBeInTheDocument();
    expect(document.querySelectorAll(".active-drop-target")).toHaveLength(0);
    Object.defineProperty(document, "elementFromPoint", { configurable: true, value: undefined });
  });

  it("회사 개인을 기본으로 표시하고 추가한 성당 구분으로 등록 필터 수정한다", () => {
    render(createElement(LifeFlowApp));
    login();
    fireEvent.click(screen.getByRole("button", { name: "할 일" }));

    const areaFilter = screen.getByRole("group", { name: "할 일 구분" });
    expect(within(areaFilter).getAllByRole("button").map((button) => button.textContent)).toEqual(["전체", "회사", "개인"]);
    fireEvent.click(within(areaFilter).getByRole("button", { name: "개인" }));
    expect(screen.getByRole("button", { name: /병원 예약하기/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /배포 문서 리뷰/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "+ 할 일" }));
    const areaSelect = screen.getByLabelText("구분");
    expect(areaSelect).toHaveValue("company");
    expect(screen.getByLabelText("프로젝트")).toBeInTheDocument();
    fireEvent.change(areaSelect, { target: { value: "personal" } });
    expect(screen.queryByLabelText("프로젝트")).not.toBeInTheDocument();
    const form = within(screen.getByRole("dialog"));
    fireEvent.click(form.getByRole("button", { name: "+ 구분 추가" }));
    fireEvent.change(form.getByLabelText("새 구분 이름"), { target: { value: "성당" } });
    fireEvent.click(form.getByRole("button", { name: "구분 추가하기" }));
    expect(areaSelect).toHaveValue("성당");
    expect(screen.queryByLabelText("프로젝트")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("할 일 제목"), { target: { value: "성당 봉사 일정 확인" } });
    fireEvent.click(screen.getByRole("button", { name: "할 일 저장" }));

    fireEvent.click(within(areaFilter).getByRole("button", { name: "성당" }));
    const churchTask = screen.getByRole("button", { name: /성당 봉사 일정 확인/ });
    expect(churchTask).toHaveTextContent("성당 · P1");
    fireEvent.click(churchTask);
    const detail = screen.getByRole("dialog", { name: "성당 봉사 일정 확인" });
    expect(within(detail).getByText("성당")).toBeInTheDocument();
    expect(within(detail).queryByText("프로젝트")).not.toBeInTheDocument();
    fireEvent.click(within(detail).getByRole("button", { name: "수정" }));
    expect(screen.getByLabelText("구분")).toHaveValue("성당");
    fireEvent.change(screen.getByLabelText("할 일 제목"), { target: { value: "변경한 봉사 일정" } });
    fireEvent.click(screen.getByRole("button", { name: "수정 저장" }));
    expect(screen.getByRole("button", { name: /변경한 봉사 일정/ })).toHaveTextContent("성당 · P1");
  });

  it("목록에서 추가한 구분은 중복을 막고 앱을 다시 열어도 선택할 수 있다", () => {
    const app = render(createElement(LifeFlowApp));
    login();
    fireEvent.click(screen.getByRole("button", { name: "할 일" }));
    fireEvent.click(screen.getByRole("button", { name: "+ 구분 추가" }));
    fireEvent.change(screen.getByLabelText("새 구분 이름"), { target: { value: "  회사  " } });
    fireEvent.click(screen.getByRole("button", { name: "구분 추가하기" }));
    expect(screen.getByRole("alert")).toHaveTextContent("이미 있는 구분");
    fireEvent.change(screen.getByLabelText("새 구분 이름"), { target: { value: "  공부  " } });
    fireEvent.keyDown(screen.getByLabelText("새 구분 이름"), { key: "Enter" });
    expect(within(screen.getByRole("group", { name: "할 일 구분" })).getByRole("button", { name: "공부" })).toBeInTheDocument();
    app.unmount();
    render(createElement(LifeFlowApp));
    login();
    fireEvent.click(screen.getByRole("button", { name: "할 일" }));
    fireEvent.click(screen.getByRole("button", { name: "+ 할 일" }));
    expect(within(screen.getByLabelText("구분")).getByRole("option", { name: "공부" })).toBeInTheDocument();
  });

  it("월 보기에서 할 일 카드를 다른 날짜로 옮긴다", () => {
    render(createElement(LifeFlowApp));
    login();
    fireEvent.click(screen.getByRole("button", { name: "할 일" }));
    fireEvent.click(screen.getByRole("button", { name: "월" }));

    const task = screen.getByRole("button", { name: /병원 예약하기/ });
    const sourceDate = screen.getByRole("gridcell", { name: "2026년 8월 28일" });
    const targetDate = screen.getByRole("gridcell", { name: "2026년 8월 29일" });
    Object.defineProperty(document, "elementFromPoint", { configurable: true, value: vi.fn(() => targetDate) });

    fireEvent.pointerDown(task, { pointerType: "mouse", pointerId: 1, button: 0, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(task, { pointerType: "mouse", pointerId: 1, buttons: 1, clientX: 30, clientY: 10 });
    expect(sourceDate).not.toHaveClass("active-drop-target");
    expect(targetDate).toHaveClass("active-drop-target");
    expect(document.querySelectorAll(".active-drop-target")).toHaveLength(1);
    fireEvent.pointerUp(task, { pointerType: "mouse", pointerId: 1, button: 0, clientX: 30, clientY: 10 });

    expect(within(targetDate).getByRole("button", { name: /병원 예약하기/ })).toBeInTheDocument();
    expect(document.querySelectorAll(".active-drop-target")).toHaveLength(0);
    Object.defineProperty(document, "elementFromPoint", { configurable: true, value: undefined });
  });

  it("프로젝트 카드를 다른 진행 상태로 드래그한다", () => {
    render(createElement(LifeFlowApp));
    login();
    fireEvent.click(screen.getByRole("button", { name: "할 일" }));

    fireEvent.click(screen.getByRole("button", { name: /여행 계획/ }));
    expect(screen.getByRole("dialog", { name: "여행 계획" })).toBeInTheDocument();
    expect(within(screen.getByRole("dialog")).getByText("프로젝트 설명")).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "수정" }));
    expect(screen.getByRole("dialog", { name: "프로젝트 수정" })).toBeInTheDocument();
    expect(screen.getByLabelText("프로젝트 이름")).toHaveValue("여행 계획");
    fireEvent.change(screen.getByLabelText("프로젝트 이름"), { target: { value: "수정한 여행 계획" } });
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "수정 저장" }));

    const project = screen.getByRole("button", { name: /수정한 여행 계획/ });
    const ready = screen.getByRole("group", { name: "프로젝트 준비 영역" });
    const doing = screen.getByRole("group", { name: "프로젝트 진행 중 영역" });
    Object.defineProperty(document, "elementFromPoint", { configurable: true, value: vi.fn(() => doing) });
    fireEvent.pointerDown(project, { pointerType: "mouse", pointerId: 1, button: 0, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(project, { pointerType: "mouse", pointerId: 1, buttons: 1, clientX: 30, clientY: 10 });
    expect(ready).not.toHaveClass("active-drop-target");
    expect(doing).toHaveClass("active-drop-target");
    expect(document.querySelectorAll(".active-drop-target")).toHaveLength(1);
    fireEvent.pointerUp(project, { pointerType: "mouse", pointerId: 1, button: 0, clientX: 30, clientY: 10 });

    expect(within(doing).getByRole("button", { name: /수정한 여행 계획/ })).toBeInTheDocument();
    Object.defineProperty(document, "elementFromPoint", { configurable: true, value: undefined });
  });

  it("터치 드래그로 할 일을 다른 칸반 영역에 놓는다", () => {
    render(createElement(LifeFlowApp));
    login();
    fireEvent.click(screen.getByRole("button", { name: "할 일" }));
    fireEvent.click(screen.getByRole("button", { name: "칸반" }));

    const task = screen.getByRole("button", { name: /배포 문서 리뷰/ });
    const doneColumn = screen.getByRole("group", { name: "완료 영역" });
    Object.defineProperty(document, "elementFromPoint", { configurable: true, value: vi.fn(() => doneColumn) });

    fireEvent.pointerDown(task, { pointerType: "touch", pointerId: 1, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(task, { pointerType: "touch", pointerId: 1, clientX: 30, clientY: 10 });
    fireEvent.pointerUp(task, { pointerType: "touch", pointerId: 1, clientX: 30, clientY: 10 });

    expect(within(doneColumn).getByRole("button", { name: /배포 문서 리뷰/ })).toBeInTheDocument();
    Object.defineProperty(document, "elementFromPoint", { configurable: true, value: undefined });
  });

  it("현재 날짜가 바뀌면 가계부의 월별 요약과 기본 기간도 함께 바뀐다", () => {
    vi.setSystemTime(new Date("2026-09-02T09:00:00+09:00"));
    render(createElement(LifeFlowApp));
    login();
    fireEvent.click(screen.getByRole("button", { name: "가계부" }));

    expect(screen.getByLabelText("시작일")).toHaveValue("2026-09-01");
    expect(screen.getByLabelText("종료일")).toHaveValue("2026-09-30");
    expect(within(screen.getByText("전월 잔액").closest("article")!).getByText("+3,086,000원")).toBeInTheDocument();
    expect(within(screen.getByText("이번 달 잔액").closest("article")!).getByText("+4,182,500원")).toBeInTheDocument();
  });

  it("연도 선택 범위를 벗어나 달을 이동해도 선택값과 달력을 유지한다", () => {
    render(createElement(LifeFlowApp));
    login();
    fireEvent.click(screen.getByRole("button", { name: "할 일" }));
    fireEvent.click(screen.getByRole("button", { name: "월" }));

    fireEvent.change(screen.getByRole("combobox", { name: "조회할 연도" }), { target: { value: "2000" } });
    fireEvent.change(screen.getByRole("combobox", { name: "조회할 월" }), { target: { value: "01" } });
    fireEvent.click(screen.getByRole("button", { name: "이전 달" }));

    expect(screen.getByRole("combobox", { name: "조회할 연도" })).toHaveValue("1999");
    expect(screen.getByRole("grid", { name: "1999년 12월 할 일 달력" })).toBeInTheDocument();
  });

  it("잘못된 거래 금액을 저장하지 않고 입력 오류를 알린다", () => {
    render(createElement(LifeFlowApp));
    login();
    fireEvent.click(screen.getByRole("button", { name: "가계부" }));
    fireEvent.click(screen.getByRole("button", { name: "+ 거래 등록" }));

    fireEvent.change(screen.getByLabelText("금액"), { target: { value: "-1000" } });
    fireEvent.click(screen.getByRole("button", { name: "등록" }));

    expect(screen.getByRole("status")).toHaveTextContent("금액은 0원보다 커야 합니다.");
    expect(screen.getByRole("dialog", { name: "가계부 거래 등록" })).toBeInTheDocument();
  });

  it("모달은 ESC로 닫히고 오늘 계획 분석 상태를 초기화한다", () => {
    render(createElement(LifeFlowApp));
    login();
    fireEvent.click(screen.getByRole("button", { name: "오늘 계획 입력" }));

    expect(screen.getByLabelText("오늘 계획")).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "분석하기" }));
    expect(screen.getByText("일정 · 10:00 팀 회의")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "오늘 계획 입력" }));
    expect(screen.queryByText("일정 · 10:00 팀 회의")).not.toBeInTheDocument();
  });

  it("키보드로 할 일을 선택해 다른 칸반 영역으로 옮긴다", () => {
    render(createElement(LifeFlowApp));
    login();
    fireEvent.click(screen.getByRole("button", { name: "할 일" }));
    fireEvent.click(screen.getByRole("button", { name: "칸반" }));

    const task = screen.getByRole("button", { name: /배포 문서 리뷰/ });
    fireEvent.keyDown(task, { key: "m", altKey: true });
    const doneColumn = screen.getByRole("group", { name: "완료 영역" });
    fireEvent.keyDown(doneColumn, { key: "Enter" });

    expect(within(doneColumn).getByRole("button", { name: /배포 문서 리뷰/ })).toBeInTheDocument();
  });
});
