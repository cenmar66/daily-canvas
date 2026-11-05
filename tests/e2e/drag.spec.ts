import { expect, test, type Page } from "@playwright/test";
import { addTask, openPlanner } from "./helpers";

/** Drag a task by its handle and drop it over a point inside `target`. */
async function dragTo(page: Page, title: string, target: ReturnType<Page["locator"]>, yFraction = 0.5) {
  const row = page.locator("[data-task-row]", { hasText: title }).first();
  await row.hover();
  const handle = row.getByRole("button", { name: /Drag to reorder or move/ });
  const from = (await handle.boundingBox())!;
  const to = (await target.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + 40, from.y + 10, { steps: 4 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height * yFraction, { steps: 12 });
  await page.mouse.up();
}

test.describe("drag and drop between sections", () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== "desktop", "pointer drag is covered on desktop"));

  test("moves a Must Do into Work To-Dos, with undo", async ({ page }) => {
    await openPlanner(page);
    await addTask(page, "What matters most today?", "Draft the estimate");
    await addTask(page, "Add a work to-do…", "Order supplies");
    await dragTo(page, "Draft the estimate", page.locator("#section-work"), 0.3);
    await expect(page.locator("#section-work").getByText("Draft the estimate")).toBeVisible();
    await expect(page.locator("#section-must").getByText("Draft the estimate")).toHaveCount(0);
    // Landed above the existing item (dropped near the top).
    const titles = await page.locator("#section-work [data-task-row]").allInnerTexts();
    expect(titles.findIndex((t) => t.includes("Draft the estimate"))).toBeLessThan(titles.findIndex((t) => t.includes("Order supplies")));
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.locator("#section-must").getByText("Draft the estimate")).toBeVisible();
  });

  test("dropping on Appointments asks for a time and makes an appointment", async ({ page }) => {
    await openPlanner(page);
    await addTask(page, "What matters most today?", "Meet the adjuster");
    await dragTo(page, "Meet the adjuster", page.locator("#section-appointments"));
    const dialog = page.getByRole("dialog", { name: "Make it an appointment" });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Starts").fill("14:30");
    await dialog.getByLabel("Where (optional)").fill("123 Main St");
    await dialog.getByRole("button", { name: "Make appointment" }).click();
    const appts = page.locator("#section-appointments");
    await expect(appts.getByText("Meet the adjuster")).toBeVisible();
    await expect(appts.getByText("2:30 PM")).toBeVisible();
    await expect(page.locator("#section-must").getByText("Meet the adjuster")).toHaveCount(0);
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.locator("#section-must").getByText("Meet the adjuster")).toBeVisible();
    await expect(appts.getByText("Meet the adjuster")).toHaveCount(0);
  });

  test("still reorders within a section", async ({ page }) => {
    await openPlanner(page);
    await addTask(page, "Add a work to-do…", "First");
    await addTask(page, "Add a work to-do…", "Second");
    await dragTo(page, "Second", page.locator("#section-work [data-task-row]", { hasText: "First" }), 0.1);
    const titles = await page.locator("#section-work [data-task-row]").allInnerTexts();
    expect(titles.findIndex((t) => t.includes("Second"))).toBeLessThan(titles.findIndex((t) => t.includes("First")));
  });
});

test("task details: Make it an appointment (works without dragging)", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  await openPlanner(page);
  await addTask(page, "Add a personal to-do…", "Dentist");
  await page.getByRole("button", { name: "Details for Dentist" }).click();
  await page.getByRole("button", { name: "Make it an appointment" }).click();
  const dialog = page.getByRole("dialog", { name: "Make it an appointment" });
  await dialog.getByLabel("Starts").fill("09:00");
  await dialog.getByRole("button", { name: "Make appointment" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("#section-appointments").getByText("Dentist")).toBeVisible();
  await expect(page.locator("#section-personal").getByText("Dentist")).toHaveCount(0);
});
