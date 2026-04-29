# fixture

---

```yaml
---
id: fixture:BL-001
type: BrownfieldBaseline
freshness_token: 0000000000000000000000000000000000000000000000000000000000000000
baseline_commit_sha: 0000000000000000000000000000000000000000
---
```

```yaml
---
id: fixture:IMP-001
type: ImplementationBinding
target_ids:
  - fixture:BEH-001
binding:
  command: src/foo.ts
---
```
