import { test, expect } from "vitest";
import { render } from "../src/lib/prompt-template.js";

test("customer-support.system renders Ana es-AR", () => {
  const out = render("customer-support.system", {
    userName: "Ana",
    locale: "es-AR",
  });
  expect(out).toMatchSnapshot();
});

test("customer-support.system renders Carlos es-ES", () => {
  const out = render("customer-support.system", {
    userName: "Carlos",
    locale: "es-ES",
  });
  expect(out).toMatchSnapshot();
});

test("intent-classifier.system renders sin variables", () => {
  const out = render("intent-classifier.system", {});
  expect(out).toMatchSnapshot();
});
