import type { components } from "../../api/schema";
import { featureLabel, formatPercent } from "../inventory/labels";

type Model = components["schemas"]["ModelResponse"];

type ClassificationMetrics = {
  accuracy: number;
  balanced_accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  roc_auc: number;
  log_loss: number;
  brier: number;
  threshold: number;
  confusion_matrix: { tn: number; fp: number; fn: number; tp: number };
};
type ModelMetrics = {
  model?: ClassificationMetrics;
  rule_baseline?: ClassificationMetrics;
  cross_validation?: {
    folds: number;
    metric: string;
    mean: number;
    std: number;
  };
  split?: { train_count: number; test_count: number };
  class_balance?: { accepted: number; rejected: number };
  improves_on_rules?: boolean;
};

const metricRows: [keyof ClassificationMetrics, string][] = [
  ["accuracy", "Exactitud"],
  ["balanced_accuracy", "Exactitud balanceada"],
  ["precision", "Precisión"],
  ["recall", "Sensibilidad (recall)"],
  ["f1", "F1"],
  ["roc_auc", "ROC AUC"],
  ["log_loss", "Log loss (menor es mejor)"],
  ["brier", "Brier (menor es mejor)"],
];

function value(
  metrics: ClassificationMetrics | undefined,
  key: keyof ClassificationMetrics,
) {
  const raw = metrics?.[key];
  return typeof raw === "number" ? raw.toFixed(3) : "—";
}

function ConfusionMatrix({
  matrix,
}: {
  matrix: ClassificationMetrics["confusion_matrix"];
}) {
  return (
    <table className="data-table confusion-table">
      <caption>Matriz de confusión del modelo (conjunto de prueba)</caption>
      <thead>
        <tr>
          <td />
          <th scope="col">Predicho rechazo</th>
          <th scope="col">Predicho aceptación</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <th scope="row">Real rechazo</th>
          <td>VN {matrix.tn}</td>
          <td>FP {matrix.fp}</td>
        </tr>
        <tr>
          <th scope="row">Real aceptación</th>
          <td>FN {matrix.fn}</td>
          <td>VP {matrix.tp}</td>
        </tr>
      </tbody>
    </table>
  );
}

function Coefficients({ model }: { model: Model }) {
  const largest = Math.max(...model.coefficients.map(Math.abs), 1e-9);
  return (
    <ul className="coefficient-list" aria-label="Coeficientes por criterio">
      {model.feature_names.map((name, index) => {
        const coefficient = model.coefficients[index] ?? 0;
        const width = (Math.abs(coefficient) / largest) * 50;
        return (
          <li key={name}>
            <span className="coefficient-name">{featureLabel(name)}</span>
            <span className="coefficient-track" aria-hidden="true">
              <span
                className={
                  coefficient >= 0
                    ? "coefficient-bar positive"
                    : "coefficient-bar negative"
                }
                style={
                  coefficient >= 0
                    ? { left: "50%", width: `${width}%` }
                    : { left: `${50 - width}%`, width: `${width}%` }
                }
              />
            </span>
            <span className="coefficient-value">{coefficient.toFixed(3)}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function ModelReport({ model }: { model: Model }) {
  const metrics = model.metrics as ModelMetrics;
  const cv = metrics.cross_validation;
  return (
    <section
      className="workspace-card feature-card module-card"
      aria-labelledby="model-title"
    >
      <p className="eyebrow">MODELO ACTIVO</p>
      <h2 id="model-title">Regresión logística · versión {model.version}</h2>
      <p>
        Entrenado el {new Date(model.trained_at).toLocaleString("es-PE")} con{" "}
        {model.sample_count} decisiones
        {metrics.split &&
          ` (${metrics.split.train_count} de entrenamiento, ${metrics.split.test_count} de prueba)`}
        .
      </p>
      {metrics.improves_on_rules !== undefined && (
        <p
          className={metrics.improves_on_rules ? "form-success" : "empty-state"}
        >
          {metrics.improves_on_rules
            ? "El modelo mejora a la línea base de reglas en el conjunto de prueba."
            : "El modelo todavía no supera a la línea base de reglas; el ranking conserva las reglas como referencia."}
        </p>
      )}
      <h3>Modelo vs línea base de reglas</h3>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">Métrica</th>
              <th scope="col">Modelo</th>
              <th scope="col">Reglas</th>
            </tr>
          </thead>
          <tbody>
            {metricRows.map(([key, label]) => (
              <tr key={key}>
                <th scope="row">{label}</th>
                <td>{value(metrics.model, key)}</td>
                <td>{value(metrics.rule_baseline, key)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {cv && (
        <p>
          Validación cruzada ({cv.folds} pliegues, {cv.metric}):{" "}
          <strong>
            {cv.mean.toFixed(3)} ± {cv.std.toFixed(3)}
          </strong>
        </p>
      )}
      {metrics.class_balance && (
        <p>
          Balance de clases: {metrics.class_balance.accepted} aceptadas ·{" "}
          {metrics.class_balance.rejected} rechazadas.
        </p>
      )}
      {metrics.model?.confusion_matrix && (
        <ConfusionMatrix matrix={metrics.model.confusion_matrix} />
      )}
      {metrics.model && (
        <p>Umbral de decisión: {formatPercent(metrics.model.threshold, 0)}</p>
      )}
      <h3>Peso de cada criterio</h3>
      <p>
        Coeficientes del modelo (intercepto {model.intercept.toFixed(3)}): a la
        derecha aumentan la probabilidad de aceptación, a la izquierda la
        reducen.
      </p>
      <Coefficients model={model} />
    </section>
  );
}
