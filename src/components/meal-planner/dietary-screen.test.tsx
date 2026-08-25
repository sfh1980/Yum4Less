// @vitest-environment jsdom

import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DietaryScreen } from "@/components/meal-planner/dietary-screen";
import { testForm } from "@/components/meal-planner/test-fixtures";

describe("DietaryScreen", () => {
  it("advances as soon as a dietary focus is chosen", () => {
    const setForm = vi.fn();
    const onContinue = vi.fn();
    render(
      createElement(DietaryScreen, {
        form: testForm,
        setForm,
        onContinue,
      }),
    );

    expect(
      screen.queryByRole("button", { name: "Continue to ingredients" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Vegetarian" }));
    expect(setForm).toHaveBeenCalledTimes(1);
    const updater = setForm.mock.calls[0]?.[0] as (current: typeof testForm) => typeof testForm;
    expect(updater(testForm)).toEqual({ ...testForm, dietaryFocus: "vegetarian" });
    expect(onContinue).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Anything" }));
    expect(onContinue).toHaveBeenCalledTimes(2);
  });
});
