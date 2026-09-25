import { createElement } from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LifeFlowApp } from "./life-flow-app";

function login() {
  fireEvent.change(screen.getByLabelText("이메일"), { target: { value: "jejoon@example.com" } });
  fireEvent.change(screen.getByLabelText("비밀번호"), { target: { value: "password123" } });
  fireEvent.click(screen.getByRole("button", { name: "로그인" }));
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-08-28T09:00:00+09:00"));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("LifeFlowApp", () => {
  it("로그인 후 대시보드와 주요 메뉴를 표시한다", () => {
    render(createElement(LifeFlowApp));

    login();

    expect(screen.getByRole("heading", { name: "좋은 아침이에요" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "할 일" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "가계부" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "프로젝트" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "할 일" }));

    expect(screen.getByRole("heading", { name: "프로젝트" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "할 일 보기" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "월" }));

    expect(screen.getByRole("grid", { name: "2026년 8월 할 일 달력" })).toBeInTheDocument();
    expect(screen.getByRole("gridcell", { name: "2026년 8월 31일" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "이전 달" }));

    expect(screen.getByRole("grid", { name: "2026년 7월 할 일 달력" })).toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox", { name: "조회할 연도" }), { target: { value: "2027" } });
    fireEvent.change(screen.getByRole("combobox", { name: "조회할 월" }), { target: { value: "02" } });

    expect(screen.getByRole("grid", { name: "2027년 2월 할 일 달력" })).toBeInTheDocument();
    expect(screen.getByRole("gridcell", { name: "2027년 2월 28일" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "칸반" }));
    const task = screen.getByRole("button", { name: /배포 문서 리뷰/ });
    const dataTransfer = { setData: () => undefined, getData: () => "task-doc", effectAllowed: "move" };
    fireEvent.dragStart(task, { dataTransfer });
    fireEvent.drop(screen.getByRole("group", { name: "완료 영역" }), { dataTransfer });

    expect(within(screen.getByRole("group", { name: "완료 영역" })).getByRole("button", { name: /배포 문서 리뷰/ })).toBeInTheDocument();

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

  it("길게 누른 할 일을 다른 칸반 영역으로 옮긴다", () => {
    render(createElement(LifeFlowApp));
    login();
    fireEvent.click(screen.getByRole("button", { name: "할 일" }));
    fireEvent.click(screen.getByRole("button", { name: "칸반" }));

    const task = screen.getByRole("button", { name: /배포 문서 리뷰/ });
    const dataTransfer = { setData: () => undefined, getData: () => "task-doc", effectAllowed: "move" };
    fireEvent.dragStart(task, { dataTransfer });
    expect(screen.getByText("이동할 날짜 또는 칸반 영역을 선택하세요.")).toBeInTheDocument();
    fireEvent.dragEnd(task, { dataTransfer });
    expect(screen.queryByText("이동할 날짜 또는 칸반 영역을 선택하세요.")).not.toBeInTheDocument();

    fireEvent.pointerDown(task, { clientX: 10, clientY: 10 });
    act(() => vi.advanceTimersByTime(600));
    fireEvent.pointerUp(task, { clientX: 10, clientY: 10 });

    expect(screen.getByText("이동할 날짜 또는 칸반 영역을 선택하세요.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("group", { name: "완료 영역" }));

    expect(within(screen.getByRole("group", { name: "완료 영역" })).getByRole("button", { name: /배포 문서 리뷰/ })).toBeInTheDocument();
  });

  it("현재 날짜가 바뀌면 가계부의 월별 요약과 기본 기간도 함께 바뀐다", () => {
    vi.setSystemTime(new Date("2026-09-02T09:00:00+09:00"));
    render(createElement(LifeFlowApp));
    login();
    fireEvent.click(screen.getByRole("button", { name: "가계부" }));

    expect(screen.getByLabelText("시작일")).toHaveValue("2026-09-01");
    expect(screen.getByLabelText("종료일")).toHaveValue("2026-09-30");
    expect(within(screen.getByText("전월 잔액").closest("article")!).getByText("+4,182,500원")).toBeInTheDocument();
    expect(within(screen.getByText("이번 달 잔액").closest("article")!).getByText("0원")).toBeInTheDocument();
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
