import http from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { spawn } from "node:child_process";
import { Store } from "./store.mjs";
import { fusionScript } from "./fusion.mjs";
const root = path.dirname(fileURLToPath(import.meta.url));
const files = {
  "/": ["public/index.html", "text/html; charset=utf-8"],
  "/app.js": ["public/app.js", "text/javascript"],
  "/model.mjs": ["model.mjs", "text/javascript"],
  "/style.css": ["public/style.css", "text/css"],
  "/three.js": ["node_modules/three/build/three.module.js", "text/javascript"],
  "/three.core.js": [
    "node_modules/three/build/three.core.js",
    "text/javascript",
  ],
  "/OrbitControls.js": [
    "node_modules/three/examples/jsm/controls/OrbitControls.js",
    "text/javascript",
  ],
};
export function createServer(projectDir = path.join(root, "projects")) {
  const store = new Store(projectDir);
  return http.createServer(async (req, res) => {
    const send = (status, data, type = "application/json") => {
      res.writeHead(status, {
        "Content-Type": type,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(type === "application/json" ? JSON.stringify(data) : data);
    };
    const host = req.headers.host;
    if (!/^(127\.0\.0\.1|localhost):\d+$/.test(host || ""))
      return send(403, { error: "Только локальное подключение" });
    if (req.headers.origin && req.headers.origin !== `http://${host}`)
      return send(403, { error: "Недопустимый источник запроса" });
    const url = new URL(req.url, `http://${host}`),
      route = url.pathname;
    try {
      if (req.method === "GET" && route === "/api/health")
        return send(200, { app: "3dworkshop", version: 2 });
      if (req.method === "GET" && route === "/api/projects")
        return send(200, { projects: await store.list() });
      const match = route.match(
        /^\/api\/projects\/([a-zA-Z0-9_-]+)\/(draft|approve|versions|handoff|transfers)$/,
      );
      if (match) {
        const [, id, action] = match;
        if (req.method === "GET") {
          if (action === "versions")
            return send(200, { versions: await store.versions(id) });
          if (action === "transfers")
            return send(200, { transfers: await store.transfers(id) });
          if (action === "handoff") {
            const v = await store.version(id, url.searchParams.get("version"));
            return send(200, {
              versionId: v.id,
              hash: v.hash,
              geometry: v.snapshot.geometry,
              script: fusionScript(v),
            });
          }
          return send(405, { error: "Метод не поддерживается" });
        }
        if (
          req.method !== "POST" ||
          req.headers["content-type"] !== "application/json"
        )
          return send(405, { error: "Нужен POST application/json" });
        let body = "";
        for await (const chunk of req) {
          body += chunk;
          if (body.length > 100000)
            throw Object.assign(Error("Слишком большой запрос"), {
              status: 413,
            });
        }
        const data = JSON.parse(body);
        if (action === "draft")
          return send(200, await store.save(id, data.revision, data.values));
        if (action === "approve")
          return send(200, await store.approve(id, data.revision));
        if (action === "transfers")
          return send(200, { transfers: await store.record(id, data) });
        return send(405, { error: "Метод не поддерживается" });
      }
      if (req.method !== "GET")
        return send(405, { error: "Метод не поддерживается" });
      if (!files[route]) return send(404, { error: "Не найдено" });
      const [file, type] = files[route];
      return send(200, await readFile(path.join(root, file)), type);
    } catch (e) {
      return send(e.status || (e.code === "ENOENT" ? 404 : 400), {
        error: e.message || "Ошибка проекта",
      });
    }
  });
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const port = Number(process.env.PORT || 4317),
    url = `http://127.0.0.1:${port}`;
  const open = () => {
    if (process.argv.includes("--open") && process.platform === "win32")
      spawn("explorer.exe", [url], {
        detached: true,
        stdio: "ignore",
        windowsHide: true,
      }).unref();
  };
  const server = createServer();
  server.on("error", async (e) => {
    if (e.code === "EADDRINUSE") {
      try {
        const r = await fetch(url + "/api/health");
        if ((await r.json()).app === "3dworkshop") {
          console.log("Мастерская уже запущена: " + url);
          open();
          return;
        }
      } catch {}
      console.error("Порт занят: " + port);
    } else console.error(e.message);
    process.exitCode = 1;
  });
  server.listen(port, "127.0.0.1", () => {
    console.log("3D Workshop: " + url);
    open();
  });
}
