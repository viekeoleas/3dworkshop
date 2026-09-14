# 3D Workshop

Before creating or changing a part, read `docs/project-format.md` and that project's `project.json`, including `documentation`. Keep geometry decisions, history and remaining work there so the next agent can continue without chat history.

Before transferring a part to Fusion, read `docs/fusion-handoff.md`. Transfer the user-selected approved version; the current draft may differ.

Agents work sequentially. Preserve user edits. Use the revision-checked draft API for parameter changes; after changing the definition on disk, tell the user to reload it. Run `npm test` after changes to geometry, storage or the server.
