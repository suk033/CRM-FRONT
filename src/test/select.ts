import { fireEvent, screen, within } from "@testing-library/react";

/** Opens the styled Select labelled `label` and picks the option named `option`. */
export function chooseOption(
  label: string | RegExp,
  option: string | RegExp,
  container: HTMLElement = document.body,
) {
  const scope = within(container);
  fireEvent.click(scope.getByRole("combobox", { name: label }));
  fireEvent.click(scope.getByRole("option", { name: option }));
}

/** Returns the option labels of the styled Select labelled `label`, leaving it closed. */
export function optionLabels(
  label: string | RegExp,
  container: HTMLElement = document.body,
) {
  const scope = within(container);
  const combobox = scope.getByRole("combobox", { name: label });
  fireEvent.click(combobox);
  const labels = screen
    .getAllByRole("option")
    .map((option) => option.textContent ?? "");
  fireEvent.click(combobox);
  return labels;
}
