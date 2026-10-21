import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import {buildWorkQueue} from "../src/workspace-model.js";

const root = new URL("../", import.meta.url);
const baseURL = process.env.OPTIMO_URL || "http://127.0.0.1:5173";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const failures = [];
let scenarios = 0;
const sources = Object.fromEntries(
  await Promise.all(
    [
      ["v53", "references/v53.html"],
      ["r7", "references/r7.html"],
    ].map(async ([id, path]) => [
      id,
      await readFile(new URL(path, root), "utf8"),
    ]),
  ),
);
const originalScripts = (id) =>
  [...sources[id].matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map((m) =>
    m[1].replace(/\r\n?/g, "\n"),
  );
async function getFrames(page) {
  await page.waitForFunction(
    () => window.OptimoWorkspace?.ready.v53 && window.OptimoWorkspace.ready.r7,
  );
  const frames = page.frames().filter((frame) => frame !== page.mainFrame());
  const map = {};
  for (const frame of frames) {
    const kind = await frame.evaluate(() =>
      window.OptimoV53Guide ? "v53" : window.OptimoR7Guide ? "r7" : null,
    );
    if (kind) map[kind] = frame;
  }
  assert(map.v53 && map.r7, "Both complete source frames initialized");
  return map;
}
async function scenario(
  name,
  fn,
  {
    url = baseURL,
    mobile = false,
    blockReferences = false,
    offlineArtifact = false,
  } = {},
) {
  if (
    process.env.OPTIMO_SCENARIO &&
    !name.toLowerCase().includes(process.env.OPTIMO_SCENARIO.toLowerCase())
  )
    return;
  scenarios++;
  const context = await browser.newContext({
    viewport: mobile
      ? { width: 390, height: 844 }
      : { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  const errors = [];
  const requests = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => requests.push(request.url()));
  page.setDefaultTimeout(12000);
  if (blockReferences)
    await context.route("**/references/**", (route) => route.abort());
  if (offlineArtifact)
    await context.route("**/*", (route) =>
      route.request().isNavigationRequest() &&
      route.request().frame() === page.mainFrame()
        ? route.continue()
        : route.abort(),
    );
  try {
    await page.goto(url);
    await fn(page, { context, errors, requests });
    assert.deepEqual(
      errors,
      [],
      "No uncaught errors in the parent or either source frame",
    );
    console.log(`PASS ${name}`);
  } catch (error) {
    failures.push({ name, error });
    console.error(`FAIL ${name}: ${error.message}`);
  } finally {
    await context.close();
  }
}
const activate = (page, source, id, args = {}) =>
  page.evaluate(
    ([source, id, args]) => window.OptimoWorkspace.activate(source, id, args),
    [source, id, args],
  );
const panel = (frame) => frame.locator("#drawer");
const goDashboard = (page) =>
  page.locator('.workspace-side [data-action="area"][data-id="home"]').click();
const queue = (page) => page.evaluate(() => OptimoWorkspace.workQueue());
// Retained r7 operations are regression-only; active Events/Resources use V53.
const legacyQueue = async (page) => buildWorkQueue({}, await page.evaluate(() => OptimoWorkspace.snapshot("r7")), {v53:false,r7:true});

try {
  await scenario(
    "Both original script stacks remain intact, with all bridge entry points available",
    async (page) => {
      const frames = await getFrames(page);
      for (const [id, count] of [
        ["v53", 35],
        ["r7", 17],
      ]) {
        const expected = originalScripts(id);
        assert.equal(expected.length, count, `${id} reference script count`);
        const actual = await frames[id].evaluate(() =>
          [...document.scripts].map((script) =>
            script.textContent.replace(/\r\n?/g, "\n"),
          ),
        );
        assert(actual.length > expected.length, `${id} has additive guidance`);
        assert.deepEqual(
          actual.slice(0, expected.length),
          expected,
          `${id} original scripts are unchanged`,
        );
      }
      const snapshot = await frames.v53.evaluate(() =>
        OptimoV53Guide.snapshot(),
      );
      assert(
        snapshot.sessions.length >= 13 &&
          snapshot.privates.length >= 3 &&
          snapshot.resources.length >= 15,
      );
      assert(
        Object.values(snapshot.functionPresence).every(Boolean),
        "All native V53 workflow entry points remain available",
      );
      const catalogs = await page.evaluate(() => ({
        workspace: OptimoWorkspace.catalog(),
        r7: OptimoWorkspace.snapshot("r7").counts,
      }));
      assert(catalogs.workspace.length >= 27);
      assert(
        catalogs.r7.views >= catalogs.r7.originalViews &&
          catalogs.r7.actions >= catalogs.r7.originalActions,
      );
      assert(
        catalogs.r7.facilityEngineFunctions >= 132 &&
          catalogs.r7.operationsEngineFunctions >= 189,
      );
    },
  );

  await scenario(
    "Task picker opens the complete quantity assignment and partial-coverage review",
    async (page) => {
      const { v53 } = await getFrames(page);
      await page.locator('[data-action="show-tasks"]').first().click();
      await page
        .locator('.task-choice[data-source="v53"][data-id="assign"]')
        .click();
      await page.locator("#task-target").selectOption("s2");
      await page.locator('[data-action="open-task"]').click();
      await panel(v53)
        .getByRole("button", { name: "Add", exact: true })
        .first()
        .click();
      assert.match(await panel(v53).innerText(), /4\s*\/\s*6/);
      await panel(v53)
        .getByRole("button", { name: "Review & apply", exact: true })
        .click();
      const text = await panel(v53).innerText();
      assert.match(text, /2 places will remain unallocated/);
      assert.match(text, /compatible remaining slots today/);
      assert(
        await panel(v53)
          .getByRole("button", {
            name: "Apply partial assignment",
            exact: true,
          })
          .isVisible(),
      );
      await panel(v53).getByRole("button", {name: "Apply partial assignment", exact: true}).click();
      const applied=await v53.evaluate(()=>({row:OptimoV53Operations.occurrences().find(row=>row.key==='s2@2026-08-24'),cases:OptimoV53Operations.snapshot().cases,audit:OptimoAudit.entries()}));
      assert.equal(applied.row.assigned,4);
      assert.equal(applied.row.att-applied.row.assigned,2);
      assert(applied.cases.some(item=>item.kind==='assignment'&&item.remaining===1));
      assert(applied.audit.some(item=>item.action==='Assign resources'));
      await page.reload();
      const restored=await getFrames(page);
      assert.equal(await restored.v53.evaluate(()=>OptimoV53Operations.occurrences().find(row=>row.key==='s2@2026-08-24').assigned),4);
    },
  );

  await scenario(
    "Public rescheduling retains customer, unallocated, package, price and undecided choices",
    async (page) => {
      const { v53 } = await getFrames(page);
      await activate(page, "v53", "publicReschedule", { id: "s1" });
      const text = await panel(v53).innerText();
      for (const phrase of [
        "Daniel Brooks",
        "Unallocated only",
        "Leave undecided",
        "Different price",
        "Booking data differs",
        "Booking Manager",
        "Review moves",
      ])
        assert(text.includes(phrase), phrase);
      const only = panel(v53).locator(
        'input[type="checkbox"][onchange*="Unallocated"]',
      );
      assert(await only.isChecked());
      await only.uncheck();
      const expanded = await panel(v53).innerText();
      assert.match(expanded, /Affected bookings · 5(?:\n|$)/);
      assert(
        expanded.includes("Faisal Al Harbi") && expanded.includes("Aisha Khan"),
        "Allocated customer bookings are restored to the list",
      );
    },
  );

  await scenario(
    "Private rescheduling keeps the whole booking, duration, customer and supply context",
    async (page) => {
      const { v53 } = await getFrames(page);
      await activate(page, "v53", "privateReschedule", { id: "p3" });
      const text = await panel(v53).innerText();
      for (const phrase of [
        "BK-24131",
        "Ahmed Rahman",
        "Guest Experience Team",
        "60 minutes",
        "whole booking",
        "Uttunga Gaikwad",
        "eBikes",
        "Reception Area",
      ])
        assert(text.includes(phrase), phrase);
      assert(
        await panel(v53)
          .getByRole("button", {
            name: "Leave selected booking unchanged",
            exact: true,
          })
          .isVisible(),
      );
    },
  );

  await scenario(
    "Linked-item capacity retains timeslot and rest-of-day scope and impact review",
    async (page) => {
      const { v53 } = await getFrames(page);
      await activate(page, "v53", "capacity", { id: "s1" });
      const values = await panel(v53)
        .locator("#v48CapScope option")
        .evaluateAll((options) =>
          options.map((option) => ({
            value: option.value,
            text: option.textContent,
          })),
        );
      assert.equal(values.length, 2);
      assert(
        values.some((x) => /timeslot only/i.test(x.text)) &&
          values.some((x) => /later timeslots/i.test(x.text)),
      );
      await panel(v53).locator("#v48CapValue").fill("3");
      await panel(v53).locator("#v48CapScope").selectOption(values[1].value);
      await panel(v53)
        .getByRole("button", { name: "Review impact", exact: true })
        .click();
      const text = await panel(v53).innerText();
      assert.match(text, /capacity|impact/i);
      assert.match(text, /Hassan Mwanzia/);
      assert.match(text, /release|unallocat|reduc|affected/i);
    },
  );

  await scenario(
    "Bulk assignment preserves two dated occurrences and the original review result boundary",
    async (page) => {
      const { v53 } = await getFrames(page);
      const ids = ["s1@2026-08-24", "s1@2026-08-25"];
      await activate(page, "v53", "bulkAssign", { ids });
      assert.match(await panel(v53).innerText(), /Selected sessions · 2/);
      await panel(v53)
        .getByRole("button", { name: "Add", exact: true })
        .first()
        .click();
      await panel(v53)
        .getByRole("button", { name: "Next session →", exact: true })
        .click();
      await panel(v53)
        .getByRole("button", { name: "Add", exact: true })
        .first()
        .click();
      await panel(v53)
        .getByRole("button", { name: "Review all", exact: true })
        .click();
      const text = await panel(v53).innerText();
      assert(text.includes("2026-08-24") && text.includes("2026-08-25"));
      assert.match(text, /2 selected sessions/);
      assert(
        await panel(v53)
          .getByRole("button", { name: "Apply assignments", exact: true })
          .isVisible(),
      );
      const selected = await v53.evaluate(
        () => OptimoV53Guide.snapshot().selected.public,
      );
      assert.deepEqual(selected, ids);
    },
  );

  await scenario(
    "All 47 native scenario setups remain valid without mutating current live plans",
    async (page) => {
      const { r7 } = await getFrames(page);
      const result = await r7.evaluate(() => {
        const before = { st: JSON.stringify(ST), os: JSON.stringify(OS) },
          rows = [];
        for (let n = 1; n <= 47; n++) {
          const demo =
            n <= 14 ? E.demoFrame(__SEED__, n) : O.demoFrame(__SEED_OPS__, n);
          rows.push({
            n,
            hasState: !!(demo?.st || demo?.os),
            view: demo?.ui?.view,
            error: demo?.error || "",
          });
        }
        return {
          unchanged:
            before.st === JSON.stringify(ST) &&
            before.os === JSON.stringify(OS),
          rows,
        };
      });
      assert(
        result.unchanged,
        "Constructing native demo states does not replace live state",
      );
      assert.equal(result.rows.length, 47);
      for (const row of result.rows) {
        assert(
          row.hasState && row.view,
          `Native scenario ${row.n} has a state and view`,
        );
        assert.equal(row.error, "", `Native scenario ${row.n}`);
      }
    },
  );

  await scenario(
    "All 47 original scenario views still render with additive guidance",
    async (page) => {
      const { r7 } = await getFrames(page);
      // This isolated test context deliberately loads each existing Demo frame; it never resets another user's working tab.
      for (let n = 1; n <= 47; n++) {
        const result = await r7.evaluate((n) => {
          if (n <= 14) ACT.dmFrame({ n });
          else ACT.opDemo({ n });
          render();
          return {
            view: UI.view,
            error: document.querySelector(".errbox")?.textContent || "",
            missing: !!document.querySelector('[data-t="not-built"]'),
          };
        }, n);
        assert.equal(result.error, "", `Native scenario ${n} renders`);
        assert.equal(
          result.missing,
          false,
          `Native scenario ${n} is implemented`,
        );
        assert(result.view);
      }
    },
  );

  await scenario(
    "Native closure, linked-part comparison and pending review survive workspace navigation",
    async (page) => {
      const { v53, r7 } = await getFrames(page);
      await activate(page, "r7", "closeSpace");
      await r7.locator('[data-t="close-sp-gB"]').click();
      await r7.locator('[data-t="close-why-wet-weather"]').click();
      await r7.locator('[data-t="close-go"]').click();
      await r7.locator('[data-t="list-plan-BK-30117@2026-10-17"]').click();
      await r7.locator('[data-t="cpb"]').click();
      assert.match(
        await r7.locator(".scr-closure").innerText(),
        /Compare places for Ridgeway Rovers Touch/,
      );
      assert(
        await r7.locator('[data-t="cmp-pick-gA"]').isVisible(),
        "Constraint override remains in comparison",
      );
      await r7.locator('[data-t="drw-back"]').click();
      await r7.locator('[data-t="card-primary"]').click();
      await r7.locator('[data-t="hbar-review"]').click();
      assert.match(
        await r7.locator(".scr-review").innerText(),
        /1 of 3 decided. 2 still to decide./,
      );
      assert.match(
        await r7.locator(".scr-review").innerText(),
        /To finish after Apply/i,
      );
      const before = await r7
        .evaluate(() => ({
          view: UI.view,
          cid: UI.cid,
          pending: OptimoR7Guide.snapshot().pending.facilities,
        }))
        .then(({ view, cid, pending }) => ({ view, cid, pending }));
      await r7.evaluate(
        () => (window.__preservationMarker = "same-native-frame"),
      );
      await v53.evaluate(
        () => (window.__preservationMarker = "same-v53-frame"),
      );
      await activate(page, "v53", "events");
      await page.locator('[data-action="area"][data-id="home"]').click();
      const after = await r7.evaluate(() => ({
        view: UI.view,
        cid: UI.cid,
        pending: OptimoR7Guide.snapshot().pending.facilities,
        marker: window.__preservationMarker,
      }));
      assert.equal(after.marker, "same-native-frame");
      assert.equal(after.cid, before.cid);
      assert.equal(after.view, before.view);
      assert.equal(after.pending.decided, 1);
      assert.equal(after.pending.toDecide, 2);
      assert.equal(
        await v53.evaluate(() => window.__preservationMarker),
        "same-v53-frame",
      );
    },
  );

  await scenario(
    "Mobile workspace and task picker fit the viewport and keep task controls available",
    async (page) => {
      await getFrames(page);
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth),
        390,
      );
      await page.locator('[data-action="show-tasks"]').first().click();
      const dialog = page.locator("#workspace-dialog");
      const rect = await dialog.boundingBox();
      assert(rect.width <= 390 && rect.x >= 0);
      await page.locator("#task-search").fill("capacity");
      assert(
        await page.locator('.task-choice[data-id="capacity"]').isVisible(),
      );
      await page.keyboard.press("Escape");
      assert.equal(await dialog.evaluate((element) => element.open), false);
    },
    { mobile: true },
  );

  await scenario(
    "Dashboard distinguishes loaded readiness, real booking issues and unapplied selections",
    async (page) => {
      const { v53 } = await getFrames(page);
      const initial = await queue(page);
      assert.equal(initial.loaded, 2);
      assert.equal(initial.complete, true);
      assert.equal(initial.clear, false);
      assert(await page.locator('[data-readiness="attention"]').isVisible());
      const s2 = initial.issues.find((item) => item.id === "v53-public-s2");
      assert(s2 && s2.action === "assign" && s2.detail.includes("6"));
      await page
        .locator('[data-work-id="v53-public-s2"] [data-action="resume-work"]')
        .click();
      assert.match(await panel(v53).innerText(), /E-Foil Lesson/);
      assert.match(await panel(v53).innerText(), /6 attendee places remaining/);
      const opened = await queue(page);
      assert.equal(
        opened.drafts.length,
        0,
        "Opening a task does not create a draft",
      );
      await goDashboard(page);
      await page
        .locator('.metric-card[data-action="queue-tab"][data-id="drafts"]')
        .click();
      assert.match(
        await page.locator("#workspace-dialog").innerText(),
        /No draft changes waiting/,
      );
      assert(
        await page
          .locator('[data-action="resume-source"][data-source="v53"]')
          .isVisible(),
      );
      await page
        .locator('[data-action="resume-source"][data-source="v53"]')
        .click();
      assert.match(await panel(v53).innerText(), /E-Foil Lesson/);
    },
  );

  await scenario(
    "Dashboard refreshes to clear from changed source readiness and retains non-cover issues",
    async (page) => {
      const { v53 } = await getFrames(page);
      await page.locator("#dashboard-scope").selectOption("custom");
      await page.locator("#scope-from").fill("2026-08-24");
      await page.locator("#scope-to").fill("2026-08-24");
      assert(
        (await queue(page)).issues.some((item) => item.id === "v53-public-s2"),
      );
      await v53.evaluate(() => {
        sessions.forEach((session) => {
          session.assigned = session.att;
          session.status = session.preliminary ? "preliminary" : "covered";
          session.detail = "All required supply assigned";
        });
        privates.forEach((booking) => {
          booking.attention = false;
        });
        renderEvent();
      });
      await page.locator(".home-title h1").click();
      await page.waitForFunction(
        () => OptimoWorkspace.workQueue().clear === true,
      );
      await page.locator('[data-readiness="clear"]').waitFor();
      const clear = await queue(page);
      assert.equal(
        clear.issues.length + clear.drafts.length + clear.followUps.length,
        0,
      );
      await v53.evaluate(() => {
        const session = sessions.find((s) => s.id === "s1");
        session.status = "attention";
        session.detail = "Facility closed: choose another space";
        renderEvent();
      });
      await page.waitForFunction(() =>
        OptimoWorkspace.workQueue().issues.some(
          (item) => item.id === "v53-public-s1",
        ),
      );
      await page.locator('[data-readiness="attention"]').waitFor();
      const issue = (await queue(page)).issues.find(
        (item) => item.id === "v53-public-s1",
      );
      assert.equal(
        issue.action,
        "session",
        "Full staff cover does not erase another operational issue",
      );
      assert.match(issue.detail, /Facility closed/);
    },
  );

  await scenario(
    "Dashboard date scope excludes dated work while retaining actionable undated bookings",
    async (page) => {
      const { v53 } = await getFrames(page);
      await v53.evaluate(() => {
        const source = privates.find((p) => p.id === "p3");
        privates.push({
          ...source,
          id: "qa-undated",
          ref: "QA-UNDATED",
          name: "Undated fixture booking",
          date: null,
          attention: true,
        });
        renderEvent();
      });
      await page.locator("#dashboard-scope").selectOption("custom");
      await page.locator("#scope-from").fill("2030-01-01");
      await page.locator("#scope-to").fill("2030-01-02");
      const q = await queue(page);
      assert(
        q.issues.length > 0 && q.issues.every((item) => item.date === null),
      );
      assert(
        q.issues.some((item) => item.id === "v53-private-qa-undated"),
        "Undated private work remains visible",
      );
      assert.equal(q.clear, false);
      await page
        .locator(
          '[data-work-id="v53-private-qa-undated"] [data-action="resume-work"]',
        )
        .click();
      assert.match(
        await panel(v53).innerText(),
        /QA-UNDATED|Undated fixture booking/,
      );
    },
  );

  await scenario(
    "Future unrostered work remains actionable and opens its exact dated assignment rather than the base day",
    async (page) => {
      const { v53 } = await getFrames(page);
      const occurrences = await v53.evaluate(() =>
        OptimoV53Guide.snapshot().attentionOccurrences.filter(
          (item) => item.origin === "unrostered-scenario",
        ),
      );
      assert.equal(
        occurrences.length,
        5,
        "Five published future operating sessions require roster decisions",
      );
      const future = occurrences[0].date;
      await v53.evaluate(() => {
        sessions.forEach((session) => {
          session.assigned = session.att;
          session.status = session.preliminary ? "preliminary" : "covered";
        });
        privates.forEach((booking) => (booking.attention = false));
        renderEvent();
      });
      await page.locator("#dashboard-scope").selectOption("custom");
      await page.locator("#scope-from").fill(future);
      await page.locator("#scope-to").fill(future);
      await page.locator(".home-title h1").click();
      let q = await queue(page);
      assert.equal(
        q.issues.length,
        5,
        "Covering base-day work cannot silently resolve another operating date",
      );
      assert(
        q.issues.every((item) => item.source === "v53" && item.date === future),
      );
      assert.equal(q.clear, false);
      const issue = q.issues.find((item) => item.action === "bulkAssign"),
        source = occurrences.find((item) => item.key === issue?.args.ids[0]);
      assert(issue && source);
      await page
        .locator(`[data-work-id="${issue.id}"] [data-action="resume-work"]`)
        .click();
      assert.deepEqual(
        await v53.evaluate(() => OptimoV53Guide.snapshot().selected.public),
        [source.key],
      );
      const work = await panel(v53).innerText();
      assert(
        work.includes(future) && work.includes(source.time),
        "Native assignment identifies the selected occurrence date and time",
      );
      assert.match(
        work,
        new RegExp(
          `${source.attendees}.*(?:originally needed|still required|remaining)`,
        ),
      );
      await goDashboard(page);
      q = await queue(page);
      const empty = q.issues.find((item) => item.action === "session");
      assert(
        empty,
        "A zero-booking event still needs its future operating decision",
      );
      await page
        .locator(`[data-work-id="${empty.id}"] [data-action="resume-work"]`)
        .click();
      assert.match(await panel(v53).innerText(), /E-SUP Rental/);
      assert(
        (await panel(v53).innerText()).includes(future),
        "Zero-booking event detail retains the future date",
      );
    },
  );

  await scenario(
    "Shared booking vocabulary separates family, confirmation, publication and private recurrence",
    async (page) => {
      const frames = await getFrames(page);
      for (const [name, frame] of [
        ["parent", page],
        ...Object.entries(frames),
      ]) {
        const result = await frame.evaluate(() => {
          const model = OptimoBookingModel;
          return {
            legend: model.legend,
            empty: model.publicEvent({
              confirmOnFirstBooking: true,
              bookings: 0,
            }),
            booked: model.publicEvent({
              confirmOnFirstBooking: true,
              bookings: 1,
            }),
            draft: model.publicEvent({
              preliminary: true,
              confirmation: "confirmed",
              bookings: 0,
            }),
            privates: ["casual", "regular", "seasonal"].map((recurrence) =>
              model.privateBooking({ recurrence }),
            ),
            block: model.block({ reason: "Maintenance" }),
          };
        });
        assert.deepEqual(
          result.legend.map((item) => item.family),
          ["public", "private", "block"],
          name,
        );
        assert.equal(result.empty.confirmation, "provisional");
        assert.equal(result.booked.confirmation, "confirmed");
        assert.equal(result.empty.family, result.booked.family);
        assert.equal(result.empty.tone, result.booked.tone);
        assert.equal(result.draft.publication, "draft");
        assert.equal(result.draft.confirmation, "confirmed");
        assert(
          result.privates.every(
            (item) => item.family === "private" && item.tone === "private",
          ),
        );
        assert.deepEqual(
          result.privates.map((item) => item.recurrence),
          ["casual", "regular", "seasonal"],
        );
        assert.equal(result.block.family, "block");
        assert.equal(result.block.reason, "Maintenance");
      }
    },
  );

  await scenario(
    "All 47 native demo states enforce Apply guards, pending decisions, follow-up flags and Undo limits",
    async (page) => {
      const { r7 } = await getFrames(page);
      const result = await r7.evaluate(() => {
        const live = [JSON.stringify(ST), JSON.stringify(OS)],
          facility = [],
          operations = [];
        for (let n = 1; n <= 14; n++) {
          const d = E.demoFrame(__SEED__, n),
            s = d.st,
            cid = d.ui.cid || "board",
            review = E.review(s, cid),
            before = s.history.length,
            beforeFlags = E.flags(s).filter(flag=>!['waiting','unconfirmed'].includes(flag.kind)).length,
            existingUndo = s.history
              .filter((record) => record.kind === "apply")
              .map((record) => E.canUndo(s, record.id)),
            check = E.applyCheck(s, cid),
            applied = E.apply(s, cid);
          facility.push({
            n,
            disabled: review.apply.disabled,
            check,
            applied,
            newRecords: s.history.length - before,
            beforeFlags,
            existingUndo,
            flags: E.flags(s).length,
            internal: (s.optimoExtensions?.internalTasks||[]).filter(task=>task.status==='open').length,
            undo: applied.historyId ? E.canUndo(s, applied.historyId) : null,
          });
        }
        for (let n = 15; n <= 47; n++) {
          const s = O.demoFrame(__SEED_OPS__, n).os,
            before = s.history.length,
            pending = O.pending(s),
            beforeFlags = O.toFinish(s).n,
            existingUndo = s.history
              .filter((record) => record.kind === "apply")
              .map((record) => O.canUndo(s, record.id)),
            check = O.applyCheck(s),
            applied = O.apply(s);
          operations.push({
            n,
            pending: { n: pending.n, decide: pending.decide },
            check,
            applied,
            newRecords: s.history.length - before,
            afterPending: O.pending(s).n,
            beforeFlags,
            existingUndo,
            flags: O.toFinish(s).n,
            undo: applied.recordId ? O.canUndo(s, applied.recordId) : null,
          });
        }
        const expired = O.demoFrame(__SEED_OPS__, 27).os,
          applied = O.apply(expired);
        O.setNow(expired, "2026-10-15T10:51");
        return {
          facility,
          operations,
          expired: O.canUndo(expired, applied.recordId),
          unchanged:
            live[0] === JSON.stringify(ST) && live[1] === JSON.stringify(OS),
        };
      });
      assert(
        result.unchanged,
        "Guard checks use disposable cloned demo states",
      );
      assert.equal(result.facility.length + result.operations.length, 47);
      for (const row of result.facility) {
        assert(
          Array.isArray(row.check.good) && typeof row.check.fail === "object",
        );
        assert(
          row.existingUndo.every((undo) => undo.ok),
          "Existing native after-state records retain their valid Undo window",
        );
        if (![2, 12].includes(row.n)) {
          assert.equal(row.applied.ok, false);
          assert.equal(row.newRecords, 0);
          assert.equal(
            row.flags,
            row.beforeFlags,
            "Refused Apply cannot change follow-up work",
          );
          assert.equal(row.disabled, true);
        } else {
          assert.equal(
            Object.keys(row.check.fail).length,
            0,
            "No invalid facility decision is applied",
          );
          assert.equal(row.disabled, false);
          assert.equal(row.applied.n, row.n === 12 ? 10 : 1);
          assert.equal(row.flags, row.n === 12 ? 2 : 0);
          assert.equal(row.undo.ok, true);
        }
        if ([13, 14].includes(row.n)) {
          assert.equal(
            row.beforeFlags,
            4,
            "Financial/details follow-ups remain; customer waiting becomes a separate internal task",
          );
          assert.equal(row.internal,1);
        }
      }
      for (const row of result.operations) {
        assert.equal(typeof row.check.ok, "boolean");
        assert(
          row.existingUndo.every((undo) => undo.ok),
          "Existing native operations after-state records retain their valid Undo window",
        );
        if ([27, 35, 37].includes(row.n)) {
          assert.equal(
            row.check.ok,
            true,
            "No invalid operations decision is applied",
          );
          assert.equal(row.applied.ok, true);
          assert(row.newRecords > 0);
          assert.equal(row.undo.ok, true);
          assert.equal(row.afterPending, 0);
        } else {
          assert.equal(row.applied.ok, false);
          assert.equal(row.newRecords, 0);
          assert.equal(
            row.afterPending,
            row.pending.n,
            "Refused Apply retains pending decisions",
          );
          assert.equal(
            row.flags,
            row.beforeFlags,
            "Refused Apply retains unfinished tasks",
          );
        }
        if ([28, 46].includes(row.n))
          assert.equal(
            row.beforeFlags,
            2,
            "Native after-states retain two unfinished operations tasks",
          );
        if ([32, 33, 34, 36, 42, 43].includes(row.n))
          assert(
            row.pending.decide > 0,
            "In-progress native scenarios keep their pending decisions explicit",
          );
      }
      assert.equal(result.expired.ok, false);
      assert.match(result.expired.text, /Undo closed/);
    },
  );

  await scenario(
    "Native facility Apply can be undone before follow-up work is completed",
    async (page) => {
      const { r7 } = await getFrames(page);
      await activate(page, "r7", "facilities");
      await r7.evaluate(() => {
        ACT.dmFrame({ n: 12 });
        render();
      });
      await r7.locator('[data-act="rvApply"]').click();
      let status = await r7.evaluate(() => ({
        flags: E.flags(ST).length,
        undo: E.canUndo(
          ST,
          ST.history.find((record) => record.kind === "apply").id,
        ),
      }));
      assert.equal(status.flags, 2);
      assert.equal(status.undo.ok, true);
      assert.equal((await queue(page)).followUps.length, 2);
      await r7.locator('[data-act="toastUndo"]').click();
      status = await r7.evaluate(() => ({
        view: UI.view,
        flags: E.flags(ST).length,
        check: E.applyCheck(ST, UI.cid),
      }));
      assert.equal(status.view, "review");
      assert.equal(status.flags, 0);
      assert.equal(status.check.good.length, 10);
      assert.deepEqual(status.check.fail, {});
      assert.equal((await queue(page)).followUps.length, 0);
      assert(
        (await queue(page)).drafts.some(
          (item) => item.source === "r7" && item.area === "Facilities",
        ),
      );
    },
  );

  await scenario(
    "Finishing a facility fee refreshes the queue and blocks unsafe Undo",
    async (page) => {
      const {r7}=await getFrames(page);
      await activate(page,"r7","facilities");
      await r7.evaluate(()=>{ACT.dmFrame({n:12});render();});
      await r7.locator('[data-act="rvApply"]').click();
      const before=await queue(page);
      assert.equal(before.followUps.length,2,"Fixed seasonal pricing and removed customer acceptance leave only genuine follow-ups");
      const fee=before.followUps.find(item=>item.args.bookingId==="BK-24077");
      assert(fee&&fee.family==="private");
      await goDashboard(page);
      await page.locator('.metric-card[data-id="followUps"]').click();
      await page.locator(`[data-queue="followUps"] [data-action="resume-work"][data-id="${fee.id}"]`).click();
      assert.match(await r7.locator("body").innerText(),/Fee to update/);
      if(await r7.evaluate(()=>UI.view!=="bm")) await r7.locator('button[data-act="bdBm"]').click();
      await r7.locator('[data-act="bmFinish"]').click();
      const after=await queue(page);
      assert.equal(after.followUps.length,1);
      assert(!after.followUps.some(item=>item.id===fee.id));
      const undo=await r7.evaluate(()=>E.canUndo(ST,ST.history.find(record=>record.kind==="apply").id));
      assert.equal(undo.ok,false);
      assert.match(undo.reason,/flag.*finished in Booking Manager/i);
    },
  );

  await scenario(
    "Undoing applied operations after a fee update retains compensating credit work",
    async (page) => {
      const { r7 } = await getFrames(page);
      await activate(page, "r7", "opReview");
      await r7.evaluate(() => {
        ACT.opDemo({ n: 27 });
        render();
      });
      await r7.locator('[data-act="opApply"]').click();
      let status = await r7.evaluate(() => ({
        pending: O.pending(OS).n,
        flags: O.toFinish(OS).n,
        record: OS.history.find((r) => r.kind === "apply").id,
      }));
      assert.equal(status.pending, 0);
      assert.equal(status.flags, 2);
      const fee = (await legacyQueue(page)).followUps.find(
        (item) => item.args.bookingId === "BK-24156",
      );
      assert(fee);
      await activate(page,"r7",fee.action,fee.args);
      assert.equal(await r7.evaluate(() => UI.view), "opBm");
      assert.match(
        await r7.locator(".scr-opbm").innerText(),
        /Sven Olsen|BK-24156/,
      );
      await r7.locator('[data-act="opBmFinish"][data-flag-id="f1"]').click();
      assert.equal((await legacyQueue(page)).followUps.length, 1);
      await activate(page, "r7", "opHistory");
      await r7.locator(`[data-t="op-hs-undo-${status.record}"]`).click();
      status = await r7.evaluate(() => ({
        pending: O.pending(OS).n,
        flags: O.toFinish(OS),
      }));
      assert.equal(status.pending, 7);
      assert.equal(status.flags.n, 1);
      assert.match(status.flags.rows[0].text, /Credit to give SAR 80/);
      assert(
        (await legacyQueue(page)).drafts.some(
          (item) => item.id === "operations-plan",
        ),
      );
      assert(
        (await legacyQueue(page)).followUps.some((item) =>
          /Credit to give SAR 80/.test(item.detail),
        ),
      );
      const credit = (await legacyQueue(page)).followUps.find((item) =>
        /Credit to give SAR 80/.test(item.detail),
      );
      await activate(page, "r7", credit.action, credit.args);
      const amount = r7.locator('[data-act="opBmCredit"]');
      const finish = r7.locator(
        `[data-act="opBmFinish"][data-flag-id="${credit.args.id}"]`,
      );
      await amount.fill("-1");
      await finish.click();
      assert(
        (await legacyQueue(page)).followUps.some((item) => item.id === credit.id),
        "A negative credit cannot silently finish the original amount",
      );
      await amount.fill("");
      await finish.click();
      assert(
        (await legacyQueue(page)).followUps.some((item) => item.id === credit.id),
        "An explicitly blank credit remains unfinished",
      );
      await amount.fill("80");
      await finish.click();
      assert(
        !(await legacyQueue(page)).followUps.some((item) => item.id === credit.id),
        "A valid completed credit clears its exact follow-up",
      );
      assert(
        (await legacyQueue(page)).drafts.some(
          (item) => item.id === "operations-plan",
        ),
        "Finishing money work does not erase restored draft decisions",
      );
    },
  );

  await scenario(
    "Action centre keyboard tabs work and task context keeps its owning workspace",
    async (page) => {
      const { v53 } = await getFrames(page);
      await page.locator('.metric-card[data-id="issues"]').click();
      const first = page.locator('.queue-tabs [role="tab"][data-id="issues"]');
      await first.focus();
      await page.keyboard.press("ArrowRight");
      assert.equal(
        await page.evaluate(() => document.activeElement.dataset.id),
        "drafts",
      );
      assert.equal(
        await page
          .locator('.queue-tabs [data-id="drafts"]')
          .getAttribute("aria-selected"),
        "true",
      );
      await page.keyboard.press("End");
      assert.equal(
        await page.evaluate(() => document.activeElement.dataset.id),
        "followUps",
      );
      await page.keyboard.press("Home");
      assert.equal(
        await page.evaluate(() => document.activeElement.dataset.id),
        "issues",
      );
      const native = (await queue(page)).issues.find(
        (item) => item.source === "v53",
      );
      assert(native);
      await page
        .locator(
          `[data-queue="issues"] [data-action="resume-work"][data-id="${native.id}"]`,
        )
        .click();
      assert.match(await panel(v53).innerText(), /Kayak|E-Foil|Private/);
      await page
        .locator('.workspace-side [data-action="area"][data-id="events"]')
        .click();
      assert.equal(
        await page
          .locator("#frame-host iframe")
          .evaluateAll(
            (frames) =>
              frames.find((frame) => !frame.hidden)?.contentWindow
                ?.OptimoV53Guide != null,
          ),
        true,
        "Events navigation uses the preferred V53 event workspace",
      );
    },
  );

  await scenario(
    "Retained legacy resource job routes preserve native decisions without entering the active queue",
    async (page) => {
      const { r7 } = await getFrames(page);
      await activate(page, "r7", "opResources");
      await r7.evaluate(() => {
        ACT.opDemo({ n: 32 });
        render();
      });
      const before = await r7.evaluate(() => ({
        pending: O.pending(OS).n,
        decide: O.pending(OS).decide,
      }));
      await goDashboard(page);
      const q = await legacyQueue(page);
      assert.equal((await queue(page)).drafts.length,0,"The competing legacy r7 resource plan is excluded from active queues");
      assert.equal(q.drafts.length, 1);
      const plan = q.drafts.find((item) => item.id === "operations-plan"),
        job = plan?.children.find((item) => item.args.id === "j1");
      assert(
        job,
        "The aggregate operations draft offers the exact resource job",
      );
      await activate(page,"r7",job.action,job.args);
      assert.equal(await r7.evaluate(() => UI.view), "rsJob");
      assert.equal(await r7.evaluate(() => UI.rsjId), "j1");
      assert.equal(await page.locator("#crumb").innerText(), "Resources");
      assert.deepEqual(
        await r7.evaluate(() => ({
          pending: O.pending(OS).n,
          decide: O.pending(OS).decide,
        })),
        before,
        "Resuming a job retains its unresolved native decisions",
      );
    },
  );

  await scenario(
    "Events keep Calendar/List independent of date scope and retain dated occurrence selection",
    async (page) => {
      const { v53 } = await getFrames(page);
      await activate(page, "v53", "events", {
        view: "calendar",
        scope: "day",
        grouping: "facility",
        date: "2026-08-24",
      });
      assert.equal(await v53.locator("#hybridEventGrouping").count(),0,"Actual V53 uses the shared time calendar without V56 inspector grouping");
      await v53.locator('[data-hybrid-event-view="list"]').click();
      let state = await v53.evaluate(
        () => OptimoV53Guide.snapshot().eventPresentation,
      );
      assert.deepEqual(
        [state.view, state.scope, state.grouping],
        ["list", "day", "facility"],
      );
      assert(await v53.locator("#screen-event.hybrid-events-list").isVisible());
      assert.equal(await v53.locator("#hybridEventGrouping").count(), 0);
      await v53.locator("#hybridEventScope").selectOption("period");
      await v53.locator("#hybridEventTo").fill("2026-08-26");
      await v53.locator("#hybridEventTo").blur();
      await v53.locator('[data-hybrid-event-view="calendar"]').click();
      state = await v53.evaluate(
        () => OptimoV53Guide.snapshot().eventPresentation,
      );
      assert.deepEqual(
        [state.view, state.scope, state.from, state.to],
        ["calendar", "period", "2026-08-24", "2026-08-26"],
      );
      assert.equal(await v53.locator("#eventPeriodContent .hybrid-period-day").count(), 3);
      const placement = await v53
        .locator("#eventPeriodContent .hybrid-period-occurrence")
        .evaluateAll((nodes) =>
          nodes.map((node) => ({
            key: node.dataset.occurrenceKey,
            date: node.closest("[data-date]").dataset.date,
            top: parseFloat(node.style.top),
            height: parseFloat(node.style.height),
            family: node.dataset.family,
          })),
        );
      assert(
        placement.length >= 6,
        "Date range calendar shows actual dated work",
      );
      assert(
        placement.every(
          (item) => item.key.includes("@" + item.date) && item.height > 0,
        ),
      );
      assert(
        new Set(
          placement
            .filter((item) => item.date === "2026-08-24")
            .map((item) => item.top),
        ).size > 1,
        "Occurrences are placed by time within each date",
      );
      for (const key of ["s1@2026-08-24", "s1@2026-08-25"])
        await v53.locator(`#eventPeriodContent [data-hybrid-occurrence="${key}"]`).check();
      await v53.locator('[data-hybrid-event-view="list"]').click();
      assert.equal(
        await v53.locator(".hybrid-period-calendar:visible").count(),
        0,
        "List is a separate presentation",
      );
      assert.deepEqual(
        await v53.evaluate(() => OptimoV53Guide.snapshot().selected.public),
        ["s1@2026-08-24", "s1@2026-08-25"],
      );
      await v53.locator('[data-hybrid-event-view="calendar"]').click();
      assert(
        await v53
          .locator('#eventPeriodContent [data-hybrid-occurrence="s1@2026-08-25"]')
          .isChecked(),
      );
      await v53
        .locator(
          '#eventPeriodContent [data-hybrid-open="session"][data-occurrence-key="s1@2026-08-25"]',
        )
        .click();
      assert.match(await panel(v53).innerText(), /Single Kayak Rental/);
    },
  );

  await scenario(
    "Attention links reveal their exact native booking after unrelated event filters and dates",
    async (page) => {
      const { v53 } = await getFrames(page);
      const issue=(await queue(page)).issues.find(item=>item.id==='v53-public-s2');
      assert(issue,"The primary event engine supplies the attention link");
      await activate(page,'v53','events',{scope:'period',from:'2030-01-01',to:'2030-01-02',view:'list'});
      await v53.evaluate(()=>{v49EventFilterSets.venue.clear();v49EventFilterSets.venue.add('nonmatching-fixture-venue');renderEvent();});
      await activate(page,issue.source,issue.action,issue.args);
      assert.match(await panel(v53).innerText(),/E-Foil Lesson/);
      assert.match(await panel(v53).innerText(),/6 attendee places remaining/);
      assert.equal(await v53.evaluate(()=>v44AssignCtx.id),'s2');
    },
  );

  await scenario(
    "One-day event ranges retain all eight scheduled day records in Calendar and List",
    async (page) => {
      const { v53 } = await getFrames(page);
      await activate(page, "v53", "events", {
        view: "calendar",
        scope: "day",
        grouping: "facility",
        date: "2026-08-24",
      });
      const dayCalendar = await v53
        .locator("#eventDayContent .hybrid-period-occurrence")
        .evaluateAll(nodes=>nodes.map(node=>`${node.dataset.family}:${node.dataset.occurrenceKey.split('@')[0]}`).sort());
      assert.equal(
        dayCalendar.length,
        8,
        "The original day has five public sessions and three private bookings",
      );
      const listRecords = () =>
        v53.evaluate(() =>
          [
            ...document.querySelectorAll(
              (OptimoV53Guide.snapshot().eventPresentation.scope === "day"
                ? "#eventDayContent"
                : "#eventPeriodContent") +
                " .v49-table tr.click input.check[onchange]",
            ),
          ]
            .map((node) => {
              const match = node
                .getAttribute("onchange")
                .match(/v49Toggle(Public|Private)\('([^']+)'/);
              return `${match[1].toLowerCase()}:${match[2].split("@")[0]}`;
            })
            .sort(),
        );
      await v53.locator('[data-hybrid-event-view="list"]').click();
      assert.deepEqual(
        await listRecords(),
        dayCalendar,
        "Day List retains every Day Calendar booking",
      );
      await v53.locator("#hybridEventScope").selectOption("period");
      await v53.locator("#hybridEventTo").fill("2026-08-24");
      await v53.locator("#hybridEventTo").blur();
      assert.deepEqual(
        await listRecords(),
        dayCalendar,
        "A one-day date range cannot lose native scheduled bookings",
      );
      await v53.locator('[data-hybrid-event-view="calendar"]').click();
      const rangeCalendar = await v53
        .locator("#eventPeriodContent .hybrid-period-occurrence")
        .evaluateAll((nodes) =>
          nodes
            .map(
              (node) =>
                `${node.dataset.family}:${node.dataset.occurrenceKey.split("@")[0]}`,
            )
            .sort(),
        );
      assert.deepEqual(
        rangeCalendar,
        dayCalendar,
        "One-day range Calendar and List show the same complete records",
      );
    },
  );

  await scenario(
    "Date range calendar cards and their actions remain separate for adjacent and concurrent occurrences",
    async (page) => {
      const { v53 } = await getFrames(page);
      await activate(page, "v53", "events", {
        view: "calendar",
        scope: "period",
        from: "2026-08-24",
        to: "2026-08-26",
      });
      const geometry = await v53
        .locator("#eventPeriodContent .hybrid-period-day")
        .evaluateAll((days) => {
          const rect = (node) => {
            const r = node.getBoundingClientRect();
            return {
              x: r.x,
              y: r.y,
              right: r.right,
              bottom: r.bottom,
              width: r.width,
              height: r.height,
            };
          };
          return days.map((day) => ({
            date: day.dataset.date,
            cards: [...day.querySelectorAll(".hybrid-period-occurrence")].map(
              (node) => ({
                key: node.dataset.occurrenceKey,
                rect: rect(node),
                actions: [...node.querySelectorAll("button,input")].map(rect),
              }),
            ),
          }));
        });
      assert(
        geometry.length >= 3 && geometry.some((day) => day.cards.length >= 8),
        "The test exercises the complete busy day and additional dates",
      );
      const intersects = (a, b) =>
        Math.min(a.right, b.right) - Math.max(a.x, b.x) > 1 &&
        Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y) > 1;
      for (const day of geometry) {
        for (let i = 0; i < day.cards.length; i++) {
          const card = day.cards[i];
          assert(card.rect.width > 0 && card.rect.height > 0);
          for (const action of card.actions) {
            assert(action.width > 0 && action.height > 0);
            assert(
              action.x >= card.rect.x - 1 &&
                action.right <= card.rect.right + 1 &&
                action.y >= card.rect.y - 1 &&
                action.bottom <= card.rect.bottom + 1,
              `Actions stay inside ${card.key}`,
            );
          }
          for (const other of day.cards.slice(i + 1)) {
            assert(
              !intersects(card.rect, other.rect),
              `Calendar cards ${card.key} and ${other.key} do not collide`,
            );
            assert(
              card.actions.every((action) =>
                other.actions.every((target) => !intersects(action, target)),
              ),
              `Actions for ${card.key} and ${other.key} remain independently clickable`,
            );
          }
        }
      }
    },
  );

  await scenario(
    "Public confirmation policy changes independently from publication and derives confirmation from first booking",
    async (page) => {
      const { v53 } = await getFrames(page);
      await activate(page, "v53", "session", { id: "s5" });
      await v53
        .locator("#hybridConfirmationPolicy")
        .selectOption("provisional");
      let event = await v53.evaluate(() =>
        OptimoV53Guide.snapshot().sessions.find((item) => item.id === "s5"),
      );
      assert.deepEqual(
        [
          event.canonical.family,
          event.canonical.confirmation,
          event.canonical.publication,
        ],
        ["public", "provisional", "published"],
      );
      assert(event.confirmOnFirstBooking);
      await v53.evaluate(() => {
        sessions.find((item) => item.id === "s5").bookings = 1;
        renderEvent();
        openSession("s5");
      });
      event = await v53.evaluate(() =>
        OptimoV53Guide.snapshot().sessions.find((item) => item.id === "s5"),
      );
      assert.equal(event.canonical.confirmation, "confirmed");
      assert.equal(event.canonical.family, "public");
      assert.match(
        await v53.locator("#hybridSessionConfirmation").innerText(),
        /Confirmed/i,
      );
      await activate(page, "v53", "session", { id: "s6" });
      await v53
        .locator("#hybridConfirmationPolicy")
        .selectOption("provisional");
      event = await v53.evaluate(() =>
        OptimoV53Guide.snapshot().sessions.find((item) => item.id === "s6"),
      );
      assert.deepEqual(
        [event.canonical.confirmation, event.canonical.publication],
        ["provisional", "draft"],
      );
      await v53.locator("#hybridConfirmationPolicy").selectOption("confirmed");
      event = await v53.evaluate(() =>
        OptimoV53Guide.snapshot().sessions.find((item) => item.id === "s6"),
      );
      assert.deepEqual(
        [event.canonical.confirmation, event.canonical.publication],
        ["confirmed", "draft"],
      );
    },
  );

  await scenario(
    "Resource reassignment selects an explicit dated work period and retains occurrence dates through native review",
    async (page) => {
      const { v53 } = await getFrames(page);
      // One undated diary row proves it requires a separate, explicit selection.
      await v53.evaluate(() =>
        resources
          .find((item) => item.name === "Hassan Mwanzia")
          .assign.push([
            "18:00–19:00",
            "QA undated lesson",
            "public",
            "St Regis",
            "2 attendee places",
          ]),
      );
      await activate(page, "v53", "reassign", {
        id: "Hassan Mwanzia",
        from: "2026-08-24",
        to: "2026-08-26",
      });
      let scope = await v53.evaluate(
        () => OptimoV53Guide.snapshot().reassignScope,
      );
      assert.equal(scope.datedCount, 4);
      assert.equal(scope.undatedCount, 1);
      assert.deepEqual(scope.selectedDates, [
        "2026-08-24",
        "2026-08-25",
        "2026-08-26",
      ]);
      assert(scope.selectedKeys.every((key) => !key.startsWith("undated:")));
      assert.equal(
        await v53.locator('input[data-occurrence-key^="undated:"]').isChecked(),
        false,
      );
      await v53.locator('[name="hybridReassignFrom"]').fill("2026-08-25");
      await v53.locator("[data-hybrid-reassign-range]").click();
      scope = await v53.evaluate(() => OptimoV53Guide.snapshot().reassignScope);
      assert.equal(scope.datedCount, 2);
      assert.deepEqual(scope.selectedDates, ["2026-08-25", "2026-08-26"]);
      const selected = [...scope.selectedKeys];
      await panel(v53)
        .getByRole("button", { name: "Choose replacements", exact: true })
        .click();
      scope = await v53.evaluate(() => OptimoV53Guide.snapshot().reassignScope);
      assert.equal(scope.stage, 2);
      assert.deepEqual(scope.selectedKeys, selected);
      assert.equal(
        await v53
          .locator('.v50-work-item[data-work-date="2026-08-25"]')
          .count(),
        1,
      );
      await panel(v53)
        .getByRole("button", { name: "Review re-assignment", exact: true })
        .click();
      scope = await v53.evaluate(() => OptimoV53Guide.snapshot().reassignScope);
      assert.equal(scope.stage, 3);
      assert.deepEqual(scope.selectedKeys, selected);
      assert.deepEqual(
        await v53
          .locator(".v50-review-row")
          .evaluateAll((rows) => rows.map((row) => row.dataset.workDate)),
        ["2026-08-25", "2026-08-26"],
      );
      assert.match(
        await panel(v53).innerText(),
        /Unresolved|remaining|No replacement/i,
        "Missing replacement decisions remain visible in review",
      );
    },
  );

  await scenario(
    "Facilities support Day/Week and Calendar/List independently with actionable schedule rows",
    async (page) => {
      const { r7 } = await getFrames(page);
      await activate(page, "r7", "boardView", {
        period: "day",
        display: "calendar",
        date: "2026-10-17",
      });
      const read = () => r7.evaluate(() => OptimoR7Guide.snapshot().schedule);
      let state = await read();
      assert.equal(state.period, "day");
      assert.equal(state.display, "calendar");
      assert(
        state.records.length > 0 &&
          state.records.every((item) => item.date === "2026-10-17"),
      );
      assert(await r7.locator('[data-t="r7g-period-controls"]').isVisible());
      await r7.locator('[data-t="r7g-display-list"]').click();
      state = await read();
      assert.equal(state.period, "day");
      assert.equal(state.display, "list");
      assert.equal(
        await r7
          .locator('[data-t="r7g-facility-list"] tbody tr[data-family]')
          .count(),
        state.records.length,
      );
      await r7.locator('[data-guide-t="r7g-period-week"]').click();
      state = await read();
      assert.equal(state.period, "week");
      assert.equal(state.display, "list");
      assert.equal(state.from, "2026-10-17");
      assert.equal(state.to, "2026-10-23");
      assert(new Set(state.records.map((item) => item.date)).size > 1);
      const weekIDs = state.records.map((item) => item.id);
      await r7.locator('[data-t="r7g-display-calendar"]').click();
      state = await read();
      assert.equal(state.period, "week");
      assert.equal(state.display, "calendar");
      assert.deepEqual(
        state.records.map((item) => item.id),
        weekIDs,
        "Changing presentation retains identical native schedule records",
      );
      assert.equal(await r7.locator('[data-t="r7g-facility-list"]').count(), 0);
      assert(
        (await r7.locator('.r7g-booking[data-family="private"]').count()) > 0,
      );
      await r7.locator('[data-t="r7g-display-list"]').click();
      const record = state.records.find(
        (item) =>
          item.family === "private" && item.partId && item.planState === "live",
      );
      assert(record);
      const row = r7.locator(`[data-t="r7g-record-${record.id}"]`);
      assert.equal(await row.getAttribute("data-family"), "private");
      assert.match(await row.innerText(), /Private booking/);
      await row.getByRole("button", { name: "Details", exact: true }).click();
      assert.equal(
        await r7.evaluate(() => UI.boardPop),
        "part:" + record.partId,
      );
      assert(await r7.locator('[data-t="part-pop"]').isVisible());
      assert.match(
        await r7.locator('[data-t="part-pop"]').innerText(),
        new RegExp(record.title),
      );
    },
  );

  await scenario(
    "Packed standalone opens both full prototypes without external resource requests",
    async (page, { context, requests }) => {
      const frames = await getFrames(page);
      for (const id of ["v53", "r7"])
        assert.deepEqual(
          await frames[id].evaluate(
            (n) =>
              [...document.scripts]
                .slice(0, n)
                .map((s) => s.textContent.replace(/\r\n?/g, "\n")),
            originalScripts(id).length,
          ),
          originalScripts(id),
        );
      assert(
        requests.every(
          (url) =>
            url === new URL("/dist/optimo-full-hybrid.html", baseURL).href ||
            url.endsWith("/favicon.ico"),
        ),
        "No styles, scripts or reference files are requested separately",
      );
      await context.setOffline(true);
      await activate(page, "v53", "assign", { id: "s2" });
      assert.match(
        await panel(frames.v53).innerText(),
        /Coverage still required/,
      );
      await activate(page, "r7", "closeSpace");
      assert(await frames.r7.locator('[data-t="close-when-days"]').isVisible());
    },
    {
      url: new URL("/dist/optimo-full-hybrid.html", baseURL).href,
      offlineArtifact: true,
    },
  );

  await scenario(
    "Standalone local-file loader accepts both original HTML fixtures and initializes full workflows",
    async (page) => {
      await page.waitForFunction(() => window.OptimoWorkspace);
      assert.equal((await queue(page)).clear, false);
      assert(await page.locator('[data-readiness="loading"]').isVisible());
      await page
        .locator('[data-source-file="v53"]')
        .setInputFiles(fileURLToPath(new URL("references/v53.html", root)));
      await page.waitForFunction(() => OptimoWorkspace.ready.v53);
      assert.equal((await queue(page)).loaded, 1);
      assert.equal((await queue(page)).clear, false);
      assert(await page.locator('[data-readiness="loading"]').isVisible());
      await page
        .locator('[data-source-file="r7"]')
        .setInputFiles(fileURLToPath(new URL("references/r7.html", root)));
      const frames = await getFrames(page);
      assert(
        (await page.evaluate(() => OptimoWorkspace.catalog())).length >= 27,
      );
      await activate(page, "v53", "privateReschedule", { id: "p3" });
      assert.match(await panel(frames.v53).innerText(), /Ahmed Rahman/);
    },
    {
      url: new URL("/dist/optimo-workspace-loader.html", baseURL).href,
      blockReferences: true,
    },
  );
} finally {
  await browser.close();
}
if (failures.length) {
  console.error(
    `${failures.length} of ${scenarios} full-workflow scenarios failed.`,
  );
  process.exitCode = 1;
} else console.log(`All ${scenarios} full-workflow browser scenarios passed.`);
