# Adding and continuing parts

1. Read the project's documentation and approved versions before editing. Each directory under `projects` is an independent part. Folder IDs use ASCII letters, digits, underscores and hyphens; display names can be Russian.
2. Create or edit `project.json` with schemaVersion 2. Use the existing cover or speaker as a complete example. Supply id, name, description, units `mm`, parameters, values, constraints, geometry and documentation.
3. Define only useful controls for this part. Each parameter has a unique key, label, min, max, positive step and unit. Values are numeric millimetres. The UI creates controls from this metadata without application edits.
4. Validate defaults and meaningful boundary cases with `resolve` from `model.mjs`. Document constraints the geometry cannot express. Model primitives must meet as one solid for Fusion; independently floating pieces belong in separate projects.
5. Open the browser, reload from disk, check the shape and controls. Record purpose, decisions, history, todo and reference in documentation. Tell the next agent exactly what remains unverified.

## Geometry contract

Coordinates are X = width, Y = height, Z = depth; all distances are millimetres. Each primitive has `type`, `name`, `size: [x,y,z]` and `origin: [x,y,z]`. Supported primitives are `box` and `panel`. A panel accepts `holes: [{x,y,radius}]` in its local XY plane, cut through its Z thickness. Circular holes must remain strictly inside the panel and must not touch each other.

Dimensions and hole coordinates accept numbers, parameter keys, or arithmetic arrays such as `["-","width",["*",2,"wall"]]`. Operators are +, -, \*, /. Constraints contain left and right expressions, an op (<, <=, >, >=, ==) and a human-readable message. Arbitrary code is not evaluated.

This MVP supports compositions of boxes and perforated panels. A new shape that needs curved outer surfaces or a different cutting direction requires extending the geometry contract, viewer and Fusion translator together, with corresponding tests. Do not substitute a misleading approximate preview for unsupported geometry.

## Persistence

GET `/api/projects` returns project definitions and revision hashes. POST `/api/projects/ID/draft` with `{revision,values}` performs validation and optimistic concurrency checking. A conflict requires reading the current file and reconciling changes, rather than repeating a stale write. Disk writes use a temporary file and rename.

POST `/api/projects/ID/approve` with `{revision}` is the user's approval action. It writes a UUID-named version containing a snapshot of the complete project and resolved geometry plus a SHA-256 hash. Treat version files as immutable. GET `/api/projects/ID/versions` verifies hashes. Editing or deleting approved files manually invalidates that guarantee; hashes detect accidental alteration, not a malicious writer with filesystem access.

Copy the complete project directory, including versions and transfers, for handoff. No project-to-project synchronization exists. Keep credentials and machine-specific paths outside this repository.
