import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { requestMessage } from "./labels";

const TEMPLATE_NAME = "plantilla_locales_supra.csv";
const TEMPLATE = [
  "titulo;tipo;ciudad;distrito;direccion;latitud;longitud;area_m2;pisos;renta_mensual;moneda;caracteristicas;estado;propietario;documento_propietario;notas",
  "Local esquina Av. Angamos;local_comercial;Lima;Surquillo;Av. Angamos Este 1520, Surquillo;-12.1125;-77.0190;175;1;14500;PEN;esquina|alto_transito|bano;disponible;Inversiones Angamos S.A.C.;20555000101;Ideal para comida rápida",
].join("\r\n");
const BOM = String.fromCharCode(0xfeff);
const templateHref = `data:text/csv;charset=utf-8,${encodeURIComponent(`${BOM}${TEMPLATE}\r\n`)}`;

type RowError = { row: number; field: string; message: string };
type ImportFailure = { message: string; errors: RowError[] };
type ImportResult = {
  created: number;
  owners_created: number;
  items: { code: string }[];
};

function failure(error: unknown, response?: Response): ImportFailure {
  const detail =
    typeof error === "object" && error !== null && "detail" in error
      ? (error as { detail: unknown }).detail
      : undefined;
  if (
    response?.status === 422 &&
    typeof detail === "object" &&
    detail !== null &&
    "errors" in detail
  ) {
    const typed = detail as { message?: string; errors: RowError[] };
    return {
      message: `No se importó ningún inmueble. ${typed.message ?? ""}`.trim(),
      errors: typed.errors,
    };
  }
  return { message: requestMessage(error, response), errors: [] };
}

function readText(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("unreadable file"));
    reader.readAsText(file, "utf-8");
  });
}

function plural(count: number, singular: string, pluralForm: string) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

export function PropertyImport() {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const importFile = useMutation<ImportResult, ImportFailure, File>({
    mutationFn: async (selected) => {
      let content: string;
      try {
        content = await readText(selected);
      } catch {
        throw {
          message: "No se pudo leer el archivo seleccionado.",
          errors: [],
        } satisfies ImportFailure;
      }
      let result;
      try {
        result = await api.POST("/api/v1/properties/import", {
          body: { content },
        });
      } catch {
        throw failure(undefined);
      }
      if (!result.response.ok || !result.data) {
        throw failure(result.error, result.response);
      }
      return result.data;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["properties"] }),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (file) importFile.mutate(file);
  }

  return (
    <section
      className="workspace-card feature-card module-card"
      aria-labelledby="property-import-title"
    >
      <h2 id="property-import-title">Importar locales</h2>
      <p>
        Completa la plantilla en Excel (separada por punto y coma) y súbela. Si
        una fila tiene errores no se importa nada y te indicamos qué corregir.
      </p>
      <form className="filter-form" onSubmit={submit}>
        <div className="field-group">
          <label className="form-field" htmlFor="property-import-file">
            Archivo CSV de locales
          </label>
          <input
            id="property-import-file"
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => {
              setFile(event.currentTarget.files?.[0] ?? null);
              importFile.reset();
            }}
          />
        </div>
        <button
          className="primary-action"
          type="submit"
          disabled={!file || importFile.isPending}
        >
          {importFile.isPending ? "Importando…" : "Importar locales"}
        </button>
        <a
          className="secondary-action"
          href={templateHref}
          download={TEMPLATE_NAME}
        >
          Descargar plantilla CSV
        </a>
      </form>
      {importFile.isSuccess && (
        <p role="status">
          Se importaron{" "}
          {plural(importFile.data.created, "inmueble", "inmuebles")} (
          {importFile.data.items.map((item) => item.code).join(", ")}) y{" "}
          {plural(
            importFile.data.owners_created,
            "propietario nuevo",
            "propietarios nuevos",
          )}
          .
        </p>
      )}
      {importFile.isError && (
        <div className="form-error" role="alert">
          <p>{importFile.error.message}</p>
          {importFile.error.errors.length > 0 && (
            <ul>
              {importFile.error.errors.map((error, index) => (
                <li key={`${error.row}-${error.field}-${index}`}>
                  Fila {error.row} · {error.field}: {error.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
