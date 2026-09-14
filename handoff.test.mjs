import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, cp, rm, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { Store } from "./store.mjs";

test("handoff simulation: fresh process reads intent and continues the disk project", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "workshop-handoff-"));
  try {
    await cp(
      new URL("./projects/demo", import.meta.url),
      path.join(root, "demo"),
      { recursive: true },
    );
    const before = await new Store(root).read("demo");
    const nextProcess = spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `
      import {Store} from ${JSON.stringify(new URL("./store.mjs", import.meta.url).href)};
      const store=new Store(process.argv[1]);
      const current=await store.read('demo');
      const doc=current.project.documentation;
      if(!doc.purpose||!doc.decisions.length||!doc.history.length||!doc.todo.length)throw Error('Incomplete handoff');
      await store.save('demo',current.revision,{...current.project.values,foot:35});
      console.log(JSON.stringify({purpose:doc.purpose,remaining:doc.todo}));
    `,
        root,
      ],
      { encoding: "utf8" },
    );
    assert.equal(nextProcess.status, 0, nextProcess.stderr);
    assert.equal(
      JSON.parse(nextProcess.stdout).purpose,
      before.project.documentation.purpose,
    );
    const after = await new Store(root).read("demo");
    assert.equal(after.project.values.foot, 35);
    assert.deepEqual(after.project.documentation, before.project.documentation);
    assert.notEqual(after.revision, before.revision);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
