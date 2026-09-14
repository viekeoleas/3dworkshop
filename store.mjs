import {
  readFile,
  readdir,
  mkdir,
  writeFile,
  rename,
  unlink,
} from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { resolve } from "./model.mjs";
const hash = (x) =>
  createHash("sha256").update(JSON.stringify(x)).digest("hex");
const fail = (status, message) => Object.assign(Error(message), { status });
export class Store {
  constructor(root) {
    this.root = root;
    this.queue = Promise.resolve();
  }
  location(id) {
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw fail(400, "Неверный идентификатор");
    return path.join(this.root, id);
  }
  async read(id) {
    const dir = this.location(id);
    const project = JSON.parse(
      await readFile(path.join(dir, "project.json"), "utf8"),
    );
    resolve(project);
    return { project, revision: hash(project) };
  }
  async list() {
    const result = [];
    for (const d of await readdir(this.root, { withFileTypes: true })) {
      if (!d.isDirectory()) continue;
      try {
        const x = await this.read(d.name);
        result.push({ folder: d.name, ...x });
      } catch (e) {
        result.push({ folder: d.name, error: e.message });
      }
    }
    return result;
  }
  async versions(id) {
    const dir = path.join(this.location(id), "versions");
    await mkdir(dir, { recursive: true });
    const all = [];
    for (const name of (await readdir(dir))
      .filter((x) => x.endsWith(".json"))
      .sort()) {
      const v = JSON.parse(await readFile(path.join(dir, name), "utf8"));
      if (v.hash !== hash(v.snapshot))
        throw fail(409, "Утверждённая версия изменена на диске");
      all.push(v);
    }
    return all;
  }
  async version(id, version) {
    if (!/^[a-f0-9-]{36}$/.test(version)) throw fail(400, "Неверная версия");
    const v = (await this.versions(id)).find((v) => v.id === version);
    if (!v) throw fail(404, "Версия не найдена");
    return v;
  }
  transaction(fn) {
    const next = this.queue.then(fn);
    this.queue = next.catch(() => {});
    return next;
  }
  async save(id, revision, values) {
    return this.transaction(async () => {
      const current = await this.read(id);
      if (current.revision !== revision)
        throw fail(
          409,
          "Проект изменён другим агентом. Сначала загрузите данные с диска.",
        );
      const p = {
        ...current.project,
        values,
        updatedAt: new Date().toISOString(),
      };
      resolve(p);
      const file = path.join(this.location(id), "project.json"),
        tmp = file + "." + randomUUID() + ".tmp";
      await writeFile(tmp, JSON.stringify(p, null, 2) + "\n");
      try {
        if ((await this.read(id)).revision !== revision)
          throw fail(409, "Проект изменился во время сохранения");
        await rename(tmp, file);
      } catch (e) {
        await unlink(tmp).catch(() => {});
        throw e;
      }
      return { project: p, revision: hash(p) };
    });
  }
  async approve(id, revision) {
    return this.transaction(async () => {
      const current = await this.read(id);
      if (current.revision !== revision)
        throw fail(409, "Черновик изменился. Загрузите данные с диска.");
      const geometry = resolve(current.project);
      const snapshot = { project: current.project, geometry };
      const v = {
        id: randomUUID(),
        createdAt: new Date().toISOString(),
        hash: hash(snapshot),
        snapshot,
      };
      await mkdir(path.join(this.location(id), "versions"), {
        recursive: true,
      });
      await writeFile(
        path.join(this.location(id), "versions", v.id + ".json"),
        JSON.stringify(v, null, 2) + "\n",
        { flag: "wx" },
      );
      return v;
    });
  }
  async transfers(id) {
    try {
      return JSON.parse(
        await readFile(path.join(this.location(id), "transfers.json"), "utf8"),
      );
    } catch (e) {
      if (e.code === "ENOENT") return [];
      throw e;
    }
  }
  async record(id, entry) {
    return this.transaction(async () => {
      const v = await this.version(id, entry.versionId);
      if (
        entry.hash !== v.hash ||
        typeof entry.destination !== "string" ||
        !entry.destination.trim() ||
        entry.verified !== true
      )
        throw fail(400, "Нужны версия, хеш, назначение и успешная проверка");
      const all = await this.transfers(id);
      all.push({
        versionId: v.id,
        hash: v.hash,
        destination: entry.destination,
        verified: true,
        recordedAt: new Date().toISOString(),
      });
      const file = path.join(this.location(id), "transfers.json"),
        tmp = file + ".tmp";
      await writeFile(tmp, JSON.stringify(all, null, 2) + "\n");
      await rename(tmp, file);
      return all;
    });
  }
}
