import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "../App";

describe("frontend foundation", () => {
  it("renders an accessible sign-in route for unauthenticated visitors", async () => {
    render(<App />);

    expect(await screen.findByRole("main")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: /iniciar sesión/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/correo electrónico/i)).toHaveAttribute(
      "type",
      "email",
    );
    expect(screen.getByLabelText(/contraseña/i)).toHaveAttribute(
      "type",
      "password",
    );
  });
});
