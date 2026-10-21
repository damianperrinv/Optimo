import assert from "node:assert/strict";
import { chromium } from "playwright";
import { createSeed, addEvent, assignResource } from "../src/domain.js";

const baseURL = process.env.OPTIMO_URL || "http://127.0.0.1:5173";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const failures = [];
const key = "optimo-hybrid-v1";
const stored = (page) =>
  page.evaluate(
    (storageKey) => JSON.parse(localStorage.getItem(storageKey)),
    key,
  );
async function scenario(name, fn, mobile = false) {
  const context = await browser.newContext({
    viewport: mobile
      ? { width: 390, height: 844 }
      : { width: 1440, height: 1000 },
    isMobile: mobile,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.setDefaultTimeout(10000);
  try {
    await page.goto(baseURL);
    await fn(page);
    assert.deepEqual(errors, [], "No uncaught browser errors");
    console.log(`PASS ${name}`);
  } catch (error) {
    failures.push({ name, error });
    console.error(`FAIL ${name}: ${error.message}`);
  } finally {
    await context.close();
  }
}
async function nav(page, name, mobile = false) {
  if (mobile)
    await page
      .getByRole("button", { name: "Toggle menu", exact: true })
      .click();
  await page.locator(".nav-item").filter({ hasText: name }).click();
}
async function assign(page, eventId, resourceId, quantity, type = "Staff") {
  const scope = (await page.locator('[role="dialog"]').count())
    ? page.locator('[role="dialog"]')
    : page;
  await scope
    .locator(`[data-action="assign"][data-id="${eventId}"]`)
    .first()
    .click();
  if (type === "Equipment")
    await page
      .locator('[data-action="assign-type"][data-id="Equipment"]')
      .click();
  await page.locator(`input[type="radio"][value="${resourceId}"]`).click();
  await page
    .getByLabel("Assignment quantity", { exact: true })
    .fill(String(quantity));
  await page
    .getByRole("button", { name: "Save assignment", exact: true })
    .click();
  assert.equal(
    await page.locator('[role="dialog"]').count(),
    0,
    "Assignment saved and panel closed",
  );
}
async function applyClosure(page) {
  await nav(page, "Facilities");
  await page
    .getByRole("button", { name: "Close a space", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Check affected events", exact: true })
    .click();
  await page.locator('[data-move="e4"]').selectOption("lake-b");
  await page
    .getByRole("button", { name: "Review changes", exact: true })
    .click();
  assert.match(
    await page.locator('[role="dialog"]').innerText(),
    /Nothing has changed yet/,
  );
  await page
    .getByRole("button", { name: "Apply closure", exact: true })
    .click();
}

try {
  await scenario(
    "Assign eligible staff and resolve a real coverage gap",
    async (page) => {
      await nav(page, "Events");
      await assign(page, "e1", "hassan", 4);
      const state = await stored(page),
        event = state.events.find((e) => e.id === "e1");
      assert.equal(
        event.assignments.find((a) => a.resourceId === "hassan").quantity,
        4,
      );
      assert.equal(
        await page
          .locator("tr")
          .filter({ has: page.locator('[data-action="event"][data-id="e1"]') })
          .getByText("Ready to go", { exact: true })
          .count(),
        1,
      );
      await page.reload();
      assert.equal(
        (await stored(page)).events
          .find((e) => e.id === "e1")
          .assignments.find((a) => a.resourceId === "hassan").quantity,
        4,
      );
    },
  );
  await scenario(
    "Review, apply, undo and persist a facility closure",
    async (page) => {
      await applyClosure(page);
      let state = await stored(page);
      assert.equal(state.closures.length, 1);
      assert.equal(
        state.events.find((e) => e.id === "e4").facilityId,
        "lake-b",
      );
      await page.locator('#toast-root [data-action="undo"]').click();
      state = await stored(page);
      assert.equal(state.closures.length, 0);
      assert.equal(
        state.events.find((e) => e.id === "e4").facilityId,
        "lake-a",
      );
      await page.reload();
      assert.equal((await stored(page)).closures.length, 0);
      await applyClosure(page);
      await page.reload();
      state = await stored(page);
      assert.equal(state.closures.length, 1);
      assert.equal(
        state.events.find((e) => e.id === "e4").facilityId,
        "lake-b",
      );
    },
  );
  await scenario(
    "Replace affected assignments before marking staff unavailable",
    async (page) => {
      await nav(page, "Resources");
      await page
        .getByRole("button", { name: "Mark unavailable", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Check affected events", exact: true })
        .click();
      await page.locator('[data-replacement="e1"]').selectOption("hassan");
      await page.locator('[data-replacement="e7"]').selectOption("hassan");
      await page
        .getByRole("button", { name: "Review cover", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Apply changes", exact: true })
        .click();
      const state = await stored(page);
      assert.equal(
        state.resources.find((r) => r.id === "mindy").unavailable.length,
        1,
      );
      for (const id of ["e1", "e7"]) {
        const event = state.events.find((e) => e.id === id);
        assert(!event.assignments.some((a) => a.resourceId === "mindy"));
        assert.equal(
          event.assignments.find((a) => a.resourceId === "hassan").quantity,
          8,
        );
      }
    },
  );
  await scenario(
    "Create an event and cover staff and equipment separately",
    async (page) => {
      await nav(page, "Events");
      await page
        .getByRole("button", { name: "New event", exact: true })
        .click();
      await page
        .getByLabel("Event name", { exact: true })
        .fill("Early kayak discovery");
      await page.getByLabel("Date", { exact: true }).fill("2026-10-21");
      await page.getByLabel("Starts", { exact: true }).fill("06:00");
      await page.getByLabel("Ends", { exact: true }).fill("07:00");
      await page
        .getByRole("button", { name: "Create event", exact: true })
        .click();
      let state = await stored(page);
      const event = state.events.find(
        (e) => e.title === "Early kayak discovery",
      );
      assert(event);
      assert.equal(event.start, "06:00");
      await assign(page, event.id, "hassan", 8);
      await page
        .locator(`[data-action="event"][data-id="${event.id}"]`)
        .first()
        .click();
      assert.match(
        await page.locator('[role="dialog"]').innerText(),
        /equipment/i,
      );
      await assign(page, event.id, "kayaks", 8, "Equipment");
      assert.equal(
        await page
          .locator("tr")
          .filter({
            has: page.locator(`[data-action="event"][data-id="${event.id}"]`),
          })
          .getByText("Ready to go", { exact: true })
          .count(),
        1,
      );
      await nav(page, "Facilities");
      assert(
        await page
          .locator(`.timeline-block[data-id="${event.id}"]`)
          .isVisible(),
        "Off-hours booking remains visible on the facility schedule",
      );
    },
  );
  await scenario(
    "Reject an invalid closure period without changing state",
    async (page) => {
      await nav(page, "Facilities");
      await page
        .getByRole("button", { name: "Close a space", exact: true })
        .click();
      await page.getByLabel("From", { exact: true }).fill("14:00");
      await page.getByLabel("Until", { exact: true }).fill("12:00");
      await page
        .getByRole("button", { name: "Check affected events", exact: true })
        .click();
      assert.match(
        await page.getByRole("alert").innerText(),
        /end time|End time/,
      );
      assert.equal(await stored(page), null);
    },
  );
  await scenario(
    "Reject a conflicting move then reschedule with resources retained",
    async (page) => {
      await nav(page, "Events");
      await page.locator('[data-action="event"][data-id="e7"]').first().click();
      await page.locator('[data-action="move"][data-id="e7"]').click();
      await page.getByLabel("Starts", { exact: true }).fill("09:00");
      await page.getByLabel("Ends", { exact: true }).fill("10:00");
      await page
        .locator('select[data-draft="facilityId"]')
        .selectOption("lake-a");
      await page
        .getByRole("button", { name: "Review move", exact: true })
        .click();
      assert.match(
        await page.getByRole("alert").innerText(),
        /another event|booked/i,
      );
      assert.equal(
        await stored(page),
        null,
        "Rejected move did not mutate state",
      );
      await page.getByLabel("Date", { exact: true }).fill("2026-10-21");
      await page.getByLabel("Starts", { exact: true }).fill("10:00");
      await page.getByLabel("Ends", { exact: true }).fill("11:00");
      await page
        .locator('select[data-draft="facilityId"]')
        .selectOption("lake-b");
      await page
        .getByRole("button", { name: "Review move", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Move event", exact: true })
        .click();
      const moved = (await stored(page)).events.find((e) => e.id === "e7");
      assert.equal(moved.date, "2026-10-21");
      assert.equal(moved.start, "10:00");
      assert.equal(moved.end, "11:00");
      assert.equal(moved.facilityId, "lake-b");
      assert.deepEqual(moved.assignments, [
        { resourceId: "mindy", quantity: 8 },
        { resourceId: "kayaks", quantity: 8 },
      ]);
      assert.equal(
        await page.locator('[data-control="date"]').inputValue(),
        "2026-10-21",
      );
      assert(
        await page
          .getByRole("button", { name: "Guided paddle", exact: true })
          .isVisible(),
      );
    },
  );
  await scenario(
    "Show concurrent equipment demand in separate visible schedule lanes",
    async (page) => {
      let state = createSeed();
      const fields = {
        type: "Public",
        activity: "Kayaking",
        date: "2026-10-21",
        attendees: 6,
      };
      state = addEvent(state, {
        ...fields,
        title: "Kayak group A",
        start: "09:00",
        end: "10:00",
        facilityId: "lake-a",
      });
      const firstId = state.events.at(-1).id;
      state = assignResource(state, firstId, "mindy", 6);
      state = assignResource(state, firstId, "kayaks", 6);
      state = addEvent(state, {
        ...fields,
        title: "Kayak group B",
        start: "09:30",
        end: "10:30",
        facilityId: "lake-b",
      });
      const secondId = state.events.at(-1).id;
      state = assignResource(state, secondId, "hassan", 6);
      state = assignResource(state, secondId, "kayaks", 6);
      await page.evaluate(
        ({ storageKey, state }) =>
          localStorage.setItem(storageKey, JSON.stringify(state)),
        { storageKey: key, state },
      );
      await page.reload();
      await nav(page, "Resources");
      await page.locator('[data-control="date"]').fill("2026-10-21");
      await page
        .locator('[data-action="resource-type"][data-id="Equipment"]')
        .click();
      const first = page.locator(`.timeline-block[data-id="${firstId}"]`),
        second = page.locator(`.timeline-block[data-id="${secondId}"]`);
      assert(await first.isVisible());
      assert(await second.isVisible());
      const a = await first.boundingBox(),
        b = await second.boundingBox();
      assert(
        a.y + a.height <= b.y || b.y + b.height <= a.y,
        "Concurrent equipment blocks occupy distinct vertical lanes",
      );
      assert.match(await first.innerText(), /6 units/);
      assert.match(await second.innerText(), /6 units/);
    },
  );
  await scenario(
    "Keyboard focus stays in the panel and Escape closes it",
    async (page) => {
      await page.locator(".attention-row").first().click();
      await page.locator('input[type="radio"][value="hassan"]').click();
      await page.locator(".drawer-close").focus();
      await page.keyboard.press("Shift+Tab");
      assert(
        await page.evaluate(() =>
          document.querySelector(".drawer").contains(document.activeElement),
        ),
      );
      assert.equal(
        await page.evaluate(() => document.activeElement.dataset.action),
        "save-assignment",
      );
      await page.keyboard.press("Escape");
      assert.equal(await page.locator('[role="dialog"]').count(), 0);
      assert.equal(
        await page.evaluate(() => document.activeElement.dataset.action),
        "assign",
      );
    },
  );
  await scenario(
    "Mobile navigation, form entry and fixed footer submission",
    async (page) => {
      assert.equal(
        await page.evaluate(() => innerWidth),
        390,
        "Layout width matches the mobile viewport",
      );
      await nav(page, "Events", true);
      await page
        .getByRole("button", { name: "New event", exact: true })
        .click();
      await page
        .getByLabel("Event name", { exact: true })
        .fill("Mobile sample event");
      await page.getByLabel("Date", { exact: true }).fill("2026-10-22");
      await page
        .getByRole("button", { name: "Create event", exact: true })
        .click();
      assert(
        (await stored(page)).events.some(
          (e) => e.title === "Mobile sample event",
        ),
      );
      await page
        .getByRole("button", { name: "Close panel", exact: true })
        .click();
      await page.locator('[data-control="date"]').fill("2026-10-20");
      await page.locator('[data-action="assign"][data-id="e1"]').click();
      await page.locator('input[type="radio"][value="hassan"]').click();
      await page
        .getByRole("button", { name: "Save assignment", exact: true })
        .click();
      assert.equal(
        (await stored(page)).events
          .find((e) => e.id === "e1")
          .assignments.find((a) => a.resourceId === "hassan").quantity,
        4,
      );
    },
    true,
  );
} finally {
  await browser.close();
}
if (failures.length) {
  console.error(`${failures.length} browser scenario(s) failed.`);
  process.exitCode = 1;
} else console.log("All 9 browser scenarios passed.");
