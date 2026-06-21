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
  commit, never squash. Note that GitHub's "Rebase and merge" button **rewrites
  the commit hashes** (it replays commits with new committer timestamps), so the
  promotion is *not* a true fast-forward and `main` ends up with the same trees
  but different SHAs than `develop`. To keep one linear history, realigning
  `develop` onto `main` immediately after promoting is **mandatory**:

  ```
  git fetch origin
  git push origin origin/main:refs/heads/develop --force-with-lease
  ```

  The trees are identical after a rebase-merge, so this loses no work — it just
  restores `main` as an ancestor of `develop`. Always use `--force-with-lease`
  (never a bare `--force`): if someone pushed to `develop` in the meantime, the
  lease check aborts the realignment instead of clobbering their work.

Never use "Create a merge commit" or "Squash and merge" anywhere. Both `develop`
and `main` keep one linear history, and — after the realignment step above —
`main` is always an ancestor of `develop`.
