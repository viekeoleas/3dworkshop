import * as THREE from "three";
import { OrbitControls } from "/OrbitControls.js";
import { resolve } from "/model.mjs";
const $ = (id) => document.getElementById(id);
let entries = [],
  current,
  values,
  revision,
  versions = [],
  viewing = "",
  dirty = false,
  busy = false,
  valid = true,
  conflict = false,
  timer;
const scene = new THREE.Scene();
scene.background = new THREE.Color("#e9edf2");
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 10000),
  renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.localClippingEnabled = true;
$("canvas").append(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
scene.add(new THREE.HemisphereLight(0xffffff, 0x738296, 3));
const light = new THREE.DirectionalLight(0xffffff, 3);
light.position.set(200, 400, 300);
scene.add(light);
let group = new THREE.Group(),
  geometry;
scene.add(group);
new ResizeObserver(() => {
  const w = $("canvas").clientWidth,
    h = $("canvas").clientHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}).observe($("canvas"));
renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
});
async function api(url, data) {
  const r = await fetch(
    url,
    data
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }
      : {},
  );
  const x = await r.json();
  if (!r.ok) throw Error(x.error);
  return x;
}
const endpoint = (action) => `/api/projects/${current.folder}/${action}`;
function error(message = "") {
  $("error").hidden = !message;
  $("error").textContent = message;
}
function state(message) {
  $("status").textContent = message;
  $("approve").disabled = busy || dirty || !valid || conflict || !!viewing;
  $("versions").disabled = busy || dirty;
  $("reload").disabled = busy || dirty;
  document
    .querySelectorAll("#projects button")
    .forEach(
      (b) => (b.disabled = busy || dirty || b.dataset.invalid === "true"),
    );
}
function draw(g, reset = false) {
  geometry = g;
  for (const m of [...group.children]) {
    m.geometry.dispose();
    m.material.dispose();
    group.remove(m);
  }
  const center = g.bounds.min.map((v, i) => (v + g.bounds.max[i]) / 2);
  for (const p of g.parts) {
    let meshGeometry;
    if (p.type === "panel") {
      const shape = new THREE.Shape();
      shape.moveTo(0, 0);
      shape.lineTo(p.size[0], 0);
      shape.lineTo(p.size[0], p.size[1]);
      shape.lineTo(0, p.size[1]);
      shape.closePath();
      for (const h of p.holes) {
        const hole = new THREE.Path();
        hole.absarc(h.x, h.y, h.radius, 0, Math.PI * 2, true);
        shape.holes.push(hole);
      }
      meshGeometry = new THREE.ExtrudeGeometry(shape, {
        depth: p.size[2],
        bevelEnabled: false,
        curveSegments: 96,
      });
    } else {
      meshGeometry = new THREE.BoxGeometry(...p.size);
      meshGeometry.translate(...p.size.map((x) => x / 2));
    }
    const mesh = new THREE.Mesh(
      meshGeometry,
      new THREE.MeshStandardMaterial({
        color: 0x527aa2,
        roughness: 0.55,
        metalness: 0.05,
        side: THREE.DoubleSide,
      }),
    );
    mesh.position.set(...p.origin.map((v, i) => v - center[i]));
    group.add(mesh);
  }
  $("bounds").textContent = [
    g.bounds.size[0],
    g.bounds.size[2],
    g.bounds.size[1],
  ]
    .map((x) => Number(x.toFixed(2)))
    .join(" × ");
  $("print").textContent = g.bounds.size.some((x) => x > 180)
    ? "Габариты превышают область печати A1 mini 180 × 180 × 180 мм."
    : g.bounds.size.some((x) => x >= 180)
      ? "На границе области A1 mini: места для внешней каймы нет."
      : "Габариты укладываются в область A1 mini 180 × 180 × 180 мм.";
  clip();
  if (reset) setView("iso");
}
function setView(view) {
  if (!geometry) return;
  const d = Math.max(...geometry.bounds.size) * 2.5;
  camera.up.set(0, 1, 0);
  camera.position.set(
    ...(view === "top"
      ? [0, d, 0.001]
      : view === "front"
        ? [0, 0, d]
        : [d * 0.8, d * 0.65, d]),
  );
  controls.target.set(0, 0, 0);
  controls.update();
}
function clip() {
  if (!geometry) return;
  const z = geometry.bounds.size[2] * (Number($("cut").value) / 100 - 0.5);
  for (const m of group.children)
    m.material.clippingPlanes = $("section").checked
      ? [new THREE.Plane(new THREE.Vector3(0, 0, -1), z)]
      : [];
}
document
  .querySelectorAll("[data-view]")
  .forEach((b) => (b.onclick = () => setView(b.dataset.view)));
$("section").onchange = clip;
$("cut").oninput = clip;
function parameters(project, readonly = false) {
  $("params").replaceChildren();
  for (const p of project.parameters) {
    const row = document.createElement("div");
    row.className = "parameter";
    const label = document.createElement("label");
    label.textContent = `${p.label} · ${p.unit || "мм"}`;
    label.htmlFor = `num-${p.key}`;
    const number = document.createElement("input"),
      range = document.createElement("input");
    number.type = "number";
    number.id = `num-${p.key}`;
    range.type = "range";
    range.setAttribute("aria-label", p.label);
    for (const input of [number, range]) {
      input.min = p.min;
      input.max = p.max;
      input.step = p.step;
      input.value = project.values[p.key];
      input.disabled = readonly;
      input.oninput = () => {
        const value = input.value === "" ? NaN : Number(input.value);
        if (input === range) number.value = input.value;
        else if (Number.isFinite(value)) range.value = input.value;
        values[p.key] = value;
        changed();
      };
    }
    row.append(label, number, range);
    $("params").append(row);
  }
}
function changed() {
  clearTimeout(timer);
  dirty = true;
  try {
    const g = resolve(current.project, values);
    valid = true;
    error();
    draw(g);
    state("Изменения…");
    timer = setTimeout(save, 350);
  } catch (e) {
    valid = false;
    error(e.message);
    dirty = false;
    state("Недопустимые параметры — показана последняя корректная модель");
  }
}
async function save() {
  if (busy || !valid || conflict || !dirty) return;
  busy = true;
  const sent = { ...values };
  state("Сохранение…");
  try {
    const result = await api(endpoint("draft"), { revision, values: sent });
    revision = result.revision;
    current.revision = result.revision;
    current.project = result.project;
    dirty = JSON.stringify(values) !== JSON.stringify(sent) && valid;
  } catch (e) {
    conflict = true;
    dirty = false;
    error(e.message);
  } finally {
    busy = false;
    state(
      conflict
        ? "Сохранение остановлено — загрузите данные с диска"
        : !valid
          ? "Недопустимые параметры"
          : dirty
            ? "Изменения…"
            : "Черновик сохранён",
    );
    if (dirty) save();
  }
}
function docs(project) {
  $("docs").replaceChildren();
  for (const [key, value] of Object.entries(project.documentation || {})) {
    const p = document.createElement("p");
    const labels = {
      purpose: "Назначение",
      decisions: "Решения",
      history: "История",
      todo: "Дальше",
      reference: "Источник",
    };
    p.textContent = `${labels[key] || key}: ${Array.isArray(value) ? value.join(" · ") : typeof value === "object" ? JSON.stringify(value) : value}`;
    $("docs").append(p);
  }
}
async function select(entry) {
  clearTimeout(timer);
  current = entry;
  revision = entry.revision;
  values = { ...entry.project.values };
  dirty = false;
  valid = true;
  conflict = false;
  viewing = "";
  error();
  $("title").textContent = entry.project.name;
  parameters(entry.project);
  docs(entry.project);
  draw(resolve(entry.project), true);
  document
    .querySelectorAll("#projects button")
    .forEach((b) =>
      b.setAttribute("aria-current", b.dataset.folder === entry.folder),
    );
  $("versions").replaceChildren(new Option("Черновик", ""));
  $("versionInfo").textContent = "";
  state("Черновик сохранён");
  const folder = entry.folder;
  try {
    const data = await api(endpoint("versions"));
    if (current.folder !== folder) return;
    versions = data.versions.sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    );
    versions.forEach((v, i) =>
      $("versions").add(
        new Option(
          `Версия ${i + 1} · ${new Date(v.createdAt).toLocaleString("ru")}`,
          v.id,
        ),
      ),
    );
  } catch (e) {
    error(e.message);
  }
}
$("versions").onchange = () => {
  viewing = $("versions").value;
  const v = versions.find((x) => x.id === viewing);
  const project = v ? v.snapshot.project : current.project;
  values = { ...project.values };
  valid = true;
  error();
  parameters(project, !!v);
  docs(project);
  draw(v ? v.snapshot.geometry : resolve(project), true);
  $("versionInfo").textContent = v ? `ID: ${v.id}\nSHA-256: ${v.hash}` : "";
  state(v ? "Утверждённая версия · только просмотр" : "Черновик сохранён");
};
$("approve").onclick = async () => {
  busy = true;
  document
    .querySelectorAll("#params input")
    .forEach((input) => (input.disabled = true));
  state("Сохраняю версию…");
  try {
    const v = await api(endpoint("approve"), { revision });
    versions.push(v);
    $("versions").add(
      new Option(
        `Версия ${versions.length} · ${new Date(v.createdAt).toLocaleString("ru")}`,
        v.id,
      ),
    );
    $("versions").value = v.id;
    $("versions").onchange();
  } catch (e) {
    conflict = true;
    error(e.message);
  } finally {
    busy = false;
    if (!viewing)
      document
        .querySelectorAll("#params input")
        .forEach((input) => (input.disabled = false));
    state(
      viewing
        ? "Утверждённая версия · только просмотр"
        : "Утверждение не выполнено — загрузите данные с диска",
    );
  }
};
async function load() {
  try {
    const data = await api("/api/projects");
    entries = data.projects;
    $("projects").replaceChildren();
    for (const entry of entries) {
      const b = document.createElement("button");
      b.textContent = entry.project?.name || entry.folder;
      b.dataset.folder = entry.folder;
      if (entry.error) {
        b.disabled = true;
        b.dataset.invalid = "true";
        b.title = entry.error;
      } else b.onclick = () => select(entry);
      $("projects").append(b);
    }
    const next =
      entries.find((x) => x.folder === current?.folder && !x.error) ||
      entries.find((x) => !x.error);
    if (next) await select(next);
    else error("Нет корректных проектов на диске");
  } catch (e) {
    error(e.message);
  }
}
$("reload").onclick = load;
window.addEventListener("beforeunload", (e) => {
  if (dirty || busy) {
    e.preventDefault();
    e.returnValue = "";
  }
});
load();
