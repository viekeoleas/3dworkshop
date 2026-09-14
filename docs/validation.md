# MVP verification — 2026-09-14

## Automated checks

`npm test` covers disk persistence in a new Store instance, stale revision rejection, invalid parameter rejection without a disk change, approval snapshot isolation, hash tampering detection, version-specific handoff, invalid transfer receipt rejection, successful receipt persistence, local-origin restrictions and static-file allowlisting. Analytic volumes of both supplied parts match their independently verified CAD volumes.

`npm run test:browser` uses the pinned Playwright development dependency and an installed Edge browser. It starts an isolated server against temporary project copies; production drafts and approvals are untouched.

The browser check passed in Edge: changing numeric controls, autosave, approving a version, changing the draft, reopening the unchanged version, invalid parameters retaining the last geometry, reloading disk values, speaker-specific controls, front view, adjustable section, external edit conflict, delayed save followed by a newer edit, page reload, a different bracket parameter schema, and a 390-pixel viewport without horizontal overflow. No page JavaScript errors occurred.

The handoff test starts a separate Node process with only the project directory and shared contract. It reads purpose, decisions, history and remaining work, updates a parameter through the revision-checked API, and preserves the documentation. This is a reproducible handoff simulation, not a claim that a separate Claude Code session was run.

A separate Codex agent with no inherited conversation then performed the actual handoff acceptance check. It recovered the bracket's purpose, dimensions, two holes and unverified load assumptions solely from repository documentation. In a copy outside the repository it changed the foot from 30 to 32 mm through Store.save, added a reasoned history entry, and read the result through a new Store. It verified bounds of 50 × 40 × 32 mm, unchanged upright panel and holes, rejection of a stale revision with 409, valid foot boundaries 15 and 80 mm, and rejection of 81 mm. The original project hash remained unchanged. No blockers were found; its documentation clarification is included in the project contract. This check used Codex, not a Claude Code session.

## Live Fusion

The generated translator was executed in Autodesk Fusion on a separate validation document and then on the exact approved speaker snapshot `82fabd6f-8acd-4e3b-820f-bffe9f2139e8`.

- SHA-256: `5942156a8ea6c596499fa38ffa02f569ad80df64baa666de0709ba6490357f17`.
- One solid body and one connected lump.
- Bounds: 180 × 180 × 180 mm.
- Volume: 529870.1652942309 mm³; expected 529870.1652942279 mm³.
- Saved in Fusion project «корпус динамика», document `Workshop speaker 82fabd6f`, version 1.
- A later read confirmed `isSaved: true`, `isModified: false` and the cloud file ID. The corresponding receipt is in the speaker project.

Before Fusion was launched, its connection returned an HTTP transport failure. No successful receipt was written for this failure. Retrying after launching Fusion succeeded. Every generated transfer creates a new document, so an existing model is not silently overwritten.

The initial cover and speaker snapshots reproduce the designs accepted earlier in chat. Existing Fusion model references are historical sources, not claims that the workshop transferred those files. Only the newly verified speaker document has a workshop transfer receipt.

## Limits

The viewer supports boxes and circularly perforated panels, including their compositions. Section surfaces are not capped. Draft calculations are synchronous; saving is serialized with revision checks. Agents are expected to edit sequentially. Hashes detect accidental snapshot changes; they are not access control against someone who can rewrite project files.

Physical fit, acoustics, structural strength and actual printing have not been tested. The nominal 180 mm bounds leave no extra room for an external brim on an A1 mini.
