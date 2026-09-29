# Contributing

## Local run

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000` so camera APIs run in a secure development context.

## Regression checks

```bash
npm test
```

The current tests are zero-dependency Node.js checks around the static runtime contract. As modules are extracted, add deterministic unit tests for geometry and tracking.

## Engineering principles

- Keep photo/manual mode available when automatic detection fails.
- Do not turn detector confidence into a claim of geometric accuracy.
- Keep user images local unless an upload feature is explicitly designed and documented.
- Pin external runtime versions.
- Prefer focused PRs: detection, tracking, geometry, rendering and UX changes should be reviewable independently.
- Add a regression test when changing a deterministic rule or runtime contract.

## Commit examples

- `fix: fall back to CPU when GPU detector init fails`
- `refactor: extract cylinder geometry helpers`
- `test: add line-fit regression fixtures`
- `docs: document packaging validation matrix`
