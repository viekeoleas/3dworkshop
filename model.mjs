// Declarative millimetre geometry shared by the server, viewer and Fusion handoff.
export function evaluate(expr, values) {
  if (typeof expr === "number" && Number.isFinite(expr)) return expr;
  if (typeof expr === "string" && Object.hasOwn(values, expr))
    return values[expr];
  if (!Array.isArray(expr) || expr.length < 2)
    throw Error("Неизвестное выражение размера");
  const [op, ...rest] = expr,
    args = rest.map((x) => evaluate(x, values));
  let result;
  if (op === "+") result = args.reduce((a, b) => a + b, 0);
  else if (op === "*") result = args.reduce((a, b) => a * b, 1);
  else if (op === "-" && args.length === 2) result = args[0] - args[1];
  else if (op === "/" && args.length === 2) result = args[0] / args[1];
  else throw Error("Неизвестная операция размера");
  if (!Number.isFinite(result))
    throw Error("Размер не является конечным числом");
  return result;
}
export function resolve(project, values = project.values) {
  if (
    project.schemaVersion !== 2 ||
    !Array.isArray(project.parameters) ||
    !Array.isArray(project.geometry) ||
    project.units !== "mm"
  )
    throw Error("Неподдерживаемый формат проекта");
  const names = new Set();
  for (const p of project.parameters) {
    if (names.has(p.key) || !/^[A-Za-z][A-Za-z0-9_]*$/.test(p.key))
      throw Error("Повторяющийся или неверный параметр");
    names.add(p.key);
    if (
      ![p.min, p.max, p.step, values[p.key]].every(Number.isFinite) ||
      p.step <= 0 ||
      p.min > p.max ||
      values[p.key] < p.min ||
      values[p.key] > p.max
    )
      throw Error(
        `${p.label}: допустимо от ${p.min} до ${p.max} ${p.unit || "мм"}`,
      );
  }
  if (Object.keys(values).some((k) => !names.has(k)))
    throw Error("Неизвестный параметр");
  for (const c of project.constraints || []) {
    const a = evaluate(c.left, values),
      b = evaluate(c.right, values);
    const ok =
      c.op === "<"
        ? a < b
        : c.op === "<="
          ? a <= b
          : c.op === ">"
            ? a > b
            : c.op === ">="
              ? a >= b
              : c.op === "=="
                ? Math.abs(a - b) < 1e-8
                : false;
    if (!ok) throw Error(c.message || "Несовместимые размеры");
  }
  if (!project.geometry.length || project.geometry.length > 200)
    throw Error("Недопустимое количество элементов");
  const parts = project.geometry.map((p) => {
    if (!["box", "panel"].includes(p.type))
      throw Error(`Не поддерживается геометрия ${p.type}`);
    const size = p.size.map((x) => evaluate(x, values)),
      origin = p.origin.map((x) => evaluate(x, values));
    if (
      size.length !== 3 ||
      origin.length !== 3 ||
      size.some((x) => x <= 0 || x > 10000)
    )
      throw Error("Элемент имеет недопустимый размер");
    const holes = (p.holes || []).map((h) => ({
      x: evaluate(h.x, values),
      y: evaluate(h.y, values),
      radius: evaluate(h.radius, values),
    }));
    for (const h of holes)
      if (
        h.radius <= 0 ||
        h.x - h.radius <= 0 ||
        h.x + h.radius >= size[0] ||
        h.y - h.radius <= 0 ||
        h.y + h.radius >= size[1]
      )
        throw Error(
          "Отверстие должно находиться внутри панели с запасом до края",
        );
    for (let i = 0; i < holes.length; i++)
      for (let j = 0; j < i; j++)
        if (
          Math.hypot(holes[i].x - holes[j].x, holes[i].y - holes[j].y) <=
          holes[i].radius + holes[j].radius
        )
          throw Error("Отверстия пересекаются");
    if (p.type === "box" && holes.length)
      throw Error("Отверстия поддерживаются в панели");
    return { name: p.name || "Элемент", type: p.type, size, origin, holes };
  });
  const min = [0, 1, 2].map((i) => Math.min(...parts.map((p) => p.origin[i]))),
    max = [0, 1, 2].map((i) =>
      Math.max(...parts.map((p) => p.origin[i] + p.size[i])),
    );
  return {
    units: "mm",
    parts,
    bounds: { min, max, size: max.map((x, i) => x - min[i]) },
  };
}
