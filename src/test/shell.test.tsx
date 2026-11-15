import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Shell } from "../layout/Shell";

const user = {
  id: "1",
  email: "ana@supra.test",
  role: "admin" as const,
  is_active: true,
  created_at: "2025-01-01T00:00:00Z",
};

afterEach(() => vi.unstubAllGlobals());

function compactViewport() {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

function RouteChange() {
  const navigate = useNavigate();
  return <button onClick={() => navigate("/inmuebles")}>Cambiar ruta</button>;
}

describe("shell autenticada", () => {
  it("expande menú inline; Escape cierra y devuelve el foco", () => {
    compactViewport();
    render(
      <MemoryRouter>
        <Shell user={user} onLogout={vi.fn()}>
          <p>Contenido</p>
        </Shell>
      </MemoryRouter>,
    );
    const toggle = screen.getByRole("button", { name: /menú de módulos/i });
    const nav = screen.getByRole("navigation", { hidden: true });
    expect(nav).toHaveAttribute("aria-label", "Módulos");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveAttribute("aria-controls", nav.id);
    expect(nav).toHaveAttribute("hidden");
    const closedHomeLink = screen.queryByRole("link", { name: "Inicio" });
    expect(closedHomeLink).not.toBeInTheDocument();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByRole("navigation")).toHaveLength(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    screen.getByRole("link", { name: "Empresas" }).focus();
    fireEvent.keyDown(nav, { key: "Escape" });
    expect(nav).toHaveAttribute("hidden");
    expect(toggle).toHaveFocus();
    fireEvent.click(toggle);
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("cierra al seleccionar rutas y cambiar pathname", () => {
    compactViewport();
    render(
      <MemoryRouter>
        <Shell user={user} onLogout={vi.fn()}>
          <RouteChange />
        </Shell>
      </MemoryRouter>,
    );
    const toggle = screen.getByRole("button", { name: /menú de módulos/i });
    fireEvent.click(toggle);
    fireEvent.click(screen.getByRole("link", { name: "Empresas" }));
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(screen.getByRole("link", { name: "Empresas" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    fireEvent.click(screen.getByRole("button", { name: "Cambiar ruta" }));
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(screen.getByRole("link", { name: "Inmuebles" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("muestra carga honesta, Asesor/Inactivo y logout real", () => {
    const onLogout = vi.fn();
    const view = render(
      <MemoryRouter>
        <Shell onLogout={onLogout}>
          <p>Contenido</p>
        </Shell>
      </MemoryRouter>,
    );
    expect(screen.getByText("Cargando usuario…")).toBeInTheDocument();
    expect(screen.queryByText(/Asesor|Inactivo/)).not.toBeInTheDocument();
    view.rerender(
      <MemoryRouter>
        <Shell
          user={{ ...user, role: "advisor", is_active: false }}
          onLogout={onLogout}
        >
          <p>Contenido</p>
        </Shell>
      </MemoryRouter>,
    );
    expect(screen.getByText("Asesor · Inactivo")).toBeInTheDocument();
    expect(screen.getAllByText(user.email)).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Cerrar sesión" }));
    expect(onLogout).toHaveBeenCalledOnce();
  });

  it("conserva una navegación al cruzar el breakpoint", () => {
    let matches = false;
    let notify = () => {};
    const removeEventListener = vi.fn();
    vi.stubGlobal("matchMedia", () => ({
      matches,
      addEventListener: (_event: string, callback: () => void) => {
        notify = callback;
      },
      removeEventListener,
    }));
    const view = render(
      <MemoryRouter>
        <Shell user={user} onLogout={vi.fn()}>
          <p>Contenido</p>
        </Shell>
      </MemoryRouter>,
    );
    const nav = screen.getByRole("navigation", { hidden: true });
    expect(nav).toHaveAttribute("hidden");
    act(() => {
      matches = true;
      notify();
    });
    expect(screen.getByRole("navigation", { name: "Módulos" })).toBe(nav);
    expect(nav).not.toHaveAttribute("hidden");
    expect(screen.getByRole("link", { name: "Inicio" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    act(() => {
      matches = false;
      notify();
    });
    expect(nav).toHaveAttribute("hidden");
    view.unmount();
    expect(removeEventListener).toHaveBeenCalledWith("change", notify);
  });

  it("mantiene identidad SUPRA y módulos reales habilitados", () => {
    render(
      <MemoryRouter initialEntries={["/empresas"]}>
        <Shell user={user} onLogout={vi.fn()}>
          <section className="workspace-card">
            <p className="eyebrow">EMPRESAS</p>
            <h1>Crear empresa</h1>
          </section>
        </Shell>
      </MemoryRouter>,
    );

    expect(screen.getByRole("banner")).toHaveTextContent("SUPRA CRM");
    expect(screen.getByText("ana@supra.test")).toBeInTheDocument();
    expect(screen.getByText(/Administrador · Activo/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /cerrar sesión/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^empresas$/i })).toHaveAttribute(
      "aria-current",
      "page",
    );
    const nav = screen.getByRole("navigation", { name: "Módulos" });
    expect(
      within(nav)
        .getAllByRole("link")
        .map((link) => [link.textContent, link.getAttribute("href")]),
    ).toEqual([
      ["Inicio", "/"],
      ["Empresas", "/empresas"],
      ["Inmuebles", "/inmuebles"],
      ["Perfil", "/perfil"],
    ]);
    expect(within(nav).queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveTextContent(/crear empresa/i);
    expect(
      screen.queryByText(/gráfica|métrica|ventas/i),
    ).not.toBeInTheDocument();
  });

  it.each([
    ["/inmuebles", "Inmuebles"],
    ["/empresas/abc", "Empresas"],
    ["/perfil", "Perfil"],
  ])("muestra el contexto del módulo en %s", (path, context) => {
    render(
      <MemoryRouter initialEntries={[path]}>
        <Shell user={user} onLogout={vi.fn()}>
          <p>Contenido</p>
        </Shell>
      </MemoryRouter>,
    );
    expect(screen.getByRole("banner")).toHaveTextContent(context);
    expect(screen.getByRole("link", { name: context })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("ubica los requerimientos dentro de Empresas", () => {
    render(
      <MemoryRouter initialEntries={["/requerimientos/abc"]}>
        <Shell user={user} onLogout={vi.fn()}>
          <p>Contenido</p>
        </Shell>
      </MemoryRouter>,
    );
    expect(screen.getByRole("banner")).toHaveTextContent("Empresas");
    expect(screen.getByRole("banner")).not.toHaveTextContent("Inicio");
  });
});
