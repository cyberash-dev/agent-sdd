# fixture

---

```yaml
---
id: fixture:BL-001
type: BrownfieldBaseline
freshness_token: 1111111111111111111111111111111111111111111111111111111111111111
baseline_commit_sha: 2222222222222222222222222222222222222222
---
```

```yaml
---
id: fixture:IMP-001
type: ImplementationBinding
target_ids:
  - fixture:BEH-001
  - fixture:CTR-001
binding:
  command: src/foo.ts
  nested:
    files:
      - src/bar.ts
      - src/nested
ignored_number: 42
---
```

```yaml
---
id: fixture:IMP-002
type: ImplementationBinding
target_ids:
  - fixture:BEH-002
binding:
  command: src/foo.ts
---
```

```yaml
---
id: fixture:IMP-003
type: ImplementationBinding
target_ids:
  - fixture:BEH-003
---
```
