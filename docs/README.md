# Enstore documentation

This directory contains the Mintlify documentation site.

From the repository root:

```bash
bun run docs
```

Quality checks:

```bash
bun run docs:check
bun run docs:links
```

Update `docs.json` whenever pages are added, removed, or moved. Mintlify deployment can be connected to the repository with this directory selected as the docs root.
