import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "../App";

describe("frontend foundation", () => {
  it("renders an accessible readiness landing", () => {
    render(<App />);

    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /la base del crm está lista/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: /preparada para la siguiente fase/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("list")).toHaveTextContent(
      /contrato openapi tipado/i,
    );
  });
});
