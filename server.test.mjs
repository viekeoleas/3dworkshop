import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, cp, rm, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createServer } from "./server.mjs";
import { Store } from "./store.mjs";
import { resolve } from "./model.mjs";
test("persistence, conflicts, invalid draft, immutable versions, handoff and receipts", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "workshop-test-"));
  let server;
  try {
    await cp(new URL("./projects", import.meta.url), root, { recursive: true });
    const store = new Store(root);
    const initial = await store.read("cover");
    const v = await store.approve("cover", initial.revision);
    const saved = await store.save("cover", initial.revision, {
      ...initial.project.values,
      width: 179,
    });
    assert.equal(
      (await new Store(root).read("cover")).project.values.width,
      179,
    );
    assert.equal(
      (await store.version("cover", v.id)).snapshot.project.values.width,
      180,
    );
    await assert.rejects(
      store.save("cover", initial.revision, initial.project.values),
      /изменён/,
    );
    await assert.rejects(
      store.save("cover", saved.revision, {
        ...saved.project.values,
        width: 1,
      }),
      /допустимо/,
    );
    assert.equal((await store.read("cover")).revision, saved.revision);
    server = createServer(root);
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    const base = `http://127.0.0.1:${server.address().port}`;
    const handoff = await (
      await fetch(`${base}/api/projects/cover/handoff?version=${v.id}`)
    ).json();
    assert.equal(handoff.hash, v.hash);
    assert.deepEqual(handoff.geometry.bounds.size, [180, 180, 180]);
    assert.match(handoff.script, /TemporaryBRepManager/);
    assert.equal(
      (
        await fetch(base + "/api/projects", {
          headers: { Origin: "https://example.com" },
        })
      ).status,
      403,
    );
    assert.equal((await fetch(base + "/store.mjs")).status, 404);
    await assert.rejects(
      store.record("cover", {
        versionId: v.id,
        hash: "wrong",
        destination: "Fusion",
        verified: true,
      }),
    );
    const before = (await store.transfers("cover")).length;
    await store.record("cover", {
      versionId: v.id,
      hash: v.hash,
      destination: "Fusion test",
      verified: true,
    });
    assert.equal((await store.transfers("cover")).length, before + 1);
    const file = path.join(root, "cover", "versions", v.id + ".json");
    const tampered = JSON.parse(await readFile(file));
    tampered.snapshot.project.values.width = 1;
    await writeFile(file, JSON.stringify(tampered));
    await assert.rejects(store.version("cover", v.id), /изменена/);
  } finally {
    if (server) await new Promise((r) => server.close(r));
    await rm(root, { recursive: true, force: true });
  }
});
test("seed bounds and circular cutout volumes match CAD", async () => {
  for (const [id, expected] of [
    ["cover", 625216],
    ["speaker", 529870.1652942279],
  ]) {
    // Baseline CAD checks use immutable approved snapshots, not user-edited drafts.
    const baselineId =
      id === "cover"
        ? "018d0dcd-b8dc-4fdd-8bc6-d51a8644e7c7"
        : "82fabd6f-8acd-4e3b-820f-bffe9f2139e8";
    const baseline = JSON.parse(
      await readFile(
        new URL(
          `./projects/${id}/versions/${baselineId}.json`,
          import.meta.url,
        ),
      ),
    );
    const p = baseline.snapshot.project;
    const g = resolve(p);
    assert.deepEqual(g.bounds.size, [180, 180, 180]);
    const volume = g.parts.reduce(
      (v, p) =>
        v +
        p.size[0] * p.size[1] * p.size[2] -
        p.holes.reduce(
          (v, h) => v + Math.PI * h.radius * h.radius * p.size[2],
          0,
        ),
      0,
    );
    assert.ok(Math.abs(volume - expected) < 0.001);
    if (id === "speaker")
      assert.throws(
        () => resolve(p, { ...p.values, diameter: 165 }),
        /Отверстие/,
      );
  }
});
