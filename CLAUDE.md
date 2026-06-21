# Repository Rules

## Merge strategy (mandatory)

All merges in this repository follow a fixed two-stage flow:

```
<any branch>  --(Rebase and merge)-->  develop  --(merge commit)-->  main
```

- **Into `develop`:** always use **Rebase and merge**. Every incoming branch
  (`feat/*`, `fix/*`, `chore/*`, etc.) is rebased onto `develop` and merged with
  a linear history. Never use a merge commit or squash when targeting `develop`.
- **Into `main`:** merge **directly** from `develop` using a standard
  **merge commit** (GitHub "Create a merge commit"). Never rebase or squash into
  `main`.

`main` therefore advances only via merge commits from `develop`, and `develop`
keeps a linear history of rebased branches.
