const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const fs = require("node:fs/promises"),
  os = require("node:os"),
  path = require("node:path"),
  assert = require("node:assert/strict");
(async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "workshop-ui-"));
  let b, s;
  try {
    await fs.cp(path.join(__dirname, "../projects"), root, { recursive: true });
    const { createServer } = await import("../server.mjs");
    s = createServer(root);
    await new Promise((r) => s.listen(0, "127.0.0.1", r));
    const base = "http://127.0.0.1:" + s.address().port;
    b = await chromium.launch({
      channel: "msedge",
      headless: true,
      args: ["--enable-unsafe-swiftshader"],
    });
    const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(base);
    await p.waitForFunction(
      () => document.querySelector("#title").textContent === "коробка",
    );
    await p.locator("#num-width").fill("178");
    await p.waitForFunction(
      () =>
        document.querySelector("#status").textContent === "Черновик сохранён" &&
        document.querySelector("#bounds").textContent.startsWith("178"),
    );
    await p.locator("#approve").click();
    await p.waitForFunction(() =>
      document.querySelector("#status").textContent.includes("только просмотр"),
    );
    const version = await p.locator("#versions").inputValue();
    assert.ok(version);
    assert.ok(await p.locator("#num-width").isDisabled());
    await p.locator("#versions").selectOption("");
    await p.locator("#num-width").fill("176");
    await p.waitForFunction(
      () =>
        document.querySelector("#status").textContent === "Черновик сохранён" &&
        document.querySelector("#bounds").textContent.startsWith("176"),
    );
    await p.locator("#versions").selectOption(version);
    assert.equal(await p.locator("#num-width").inputValue(), "178");
    await p.locator("#versions").selectOption("");
    await p.locator("#num-width").fill("1");
    assert.ok(await p.locator("#error").isVisible());
    assert.ok(await p.locator("#approve").isDisabled());
    assert.match(await p.locator("#bounds").textContent(), /^176/);
    await p.locator("#reload").click();
    await p.waitForFunction(
      () => document.querySelector("#num-width").value === "176",
    );
    await p
      .getByRole("button", { name: "корпус динамика", exact: true })
      .click();
    await p.waitForSelector("#num-diameter");
    await p.locator("[data-view=front]").click();
    await p.locator("#section").check();
    await p.locator("#cut").fill("65");
    await p.screenshot({ path: path.join(root, "workshop.png") });
    const file = path.join(root, "speaker", "project.json");
    const disk = JSON.parse(await fs.readFile(file));
    disk.values.depth = 169;
    await fs.writeFile(file, JSON.stringify(disk));
    await p.locator("#num-depth").fill("168");
    await p.waitForFunction(() =>
      document.querySelector("#status").textContent.includes("остановлено"),
    );
    assert.ok(await p.locator("#approve").isDisabled());
    await p.locator("#reload").click();
    await p.waitForFunction(
      () => document.querySelector("#num-depth").value === "169",
    );
    let delayed = false;
    await p.route("**/api/projects/speaker/draft", async (route) => {
      if (!delayed) {
        delayed = true;
        await new Promise((r) => setTimeout(r, 400));
      }
      await route.continue();
    });
    await p.locator("#num-depth").fill("167");
    await p.waitForFunction(
      () => document.querySelector("#status").textContent === "Сохранение…",
    );
    await p.locator("#num-depth").fill("166");
    await p.waitForFunction(
      () =>
        document.querySelector("#status").textContent === "Черновик сохранён" &&
        document.querySelector("#num-depth").value === "166",
    );
    assert.equal(JSON.parse(await fs.readFile(file)).values.depth, 166);
    await p.reload();
    await p
      .getByRole("button", { name: "корпус динамика", exact: true })
      .click();
    await p.waitForFunction(
      () => document.querySelector("#num-depth")?.value === "166",
    );
    await p
      .getByRole("button", { name: "Крепёжный уголок", exact: true })
      .click();
    await p.waitForSelector("#num-foot");
    assert.ok(await p.locator("#docs").textContent());
    await p.setViewportSize({ width: 390, height: 844 });
    assert.ok(
      await p.evaluate(() => document.documentElement.scrollWidth <= 390),
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS: controls, autosave, immutable version, invalid draft, conflict, section, mobile, no JS errors",
    );
  } finally {
    if (b) await b.close();
    if (s) await new Promise((r) => s.close(r));
    await fs.rm(root, { recursive: true, force: true });
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
