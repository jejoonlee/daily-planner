import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LifeFlowApp } from "./life-flow-app";

describe("LifeFlowApp", () => {
  it("로그인 후 대시보드와 주요 메뉴를 표시한다", () => {
    render(createElement(LifeFlowApp));

    fireEvent.click(screen.getByRole("button", { name: "로그인" }));

    expect(screen.getByRole("heading", { name: "좋은 아침이에요" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /할 일/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /돈 관리/ })).toBeInTheDocument();
  });
});
