# Repository Rules

## Merge strategy (mandatory)

Every merge in this repository uses **Rebase and merge** — always. Rebase
first, then merge. Never merge without rebasing first, never a plain merge
commit, never squash.

```
<any branch>  --(Rebase and merge)-->  develop  --(Rebase and merge)-->  main
```

- **Into `develop`:** always **Rebase and merge**. Every incoming branch
  (`feat/*`, `fix/*`, `chore/*`, etc.) is rebased onto `develop` and merged with
  a linear history.
- **Into `main`:** always **Rebase and merge** from `develop` — never a merge
  commit. Because `main` is kept an ancestor of `develop`, this lands as a clean
  fast-forward: no rewritten hashes, no divergence between the branches.

Never use "Create a merge commit" or "Squash and merge" anywhere. Both `develop`
and `main` keep one linear history, and `main` is always an ancestor of
`develop`.
