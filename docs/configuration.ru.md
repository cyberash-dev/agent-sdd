# Конфигурация

> Русский · [English](configuration.md)

Всё, что `agent-sdd` нужно знать о вашем репозитории, хранится в одном файле:
`<repo_root>/.sdd/config.json`. Этот документ — полный справочник по полям, а также
блок Brownfield-базовой линии, который CLI читает из вашей спецификации. Формальная
JSON-схема — [`schema/sdd.config.schema.json`](../schema/sdd.config.schema.json).

---

## `.sdd/config.json`

Минимальный пример:

```json
{
  "$schema": "https://github.com/cyberash-dev/agent-sdd/blob/main/schema/sdd.config.schema.json",
  "spec_file": "spec/spec.md",
  "baseline_id": "my-partition:BL-001",
  "discovery_scope": ["src", "tests", "package.json", "tsconfig.json"],
  "mechanism": "git_tree_hash_v1"
}
```

Неизвестные поля верхнего уровня **отклоняются** (код выхода 2, `config-invalid`).

### Справочник по полям

| Field | Type | Required | Default | Значение |
|-------|------|----------|---------|---------|
| `spec_file` | string | да | — | Путь к файлу SDD-спецификации относительно корня репозитория. |
| `baseline_id` | string | да | — | Полный `<partition>:BL-<n>` блока BrownfieldBaseline, который нужно прочитать. |
| `discovery_scope` | string[] | да | — | Pathspec-выражения (каталоги, файлы, glob-шаблоны) относительно корня репозитория, передаваемые активному VCS-адаптеру. |
| `mechanism` | string | да | — | Идентификатор отпечатка активного VCS-адаптера (грамматика `^[a-z][a-z0-9_]*$`); встроенный git объявляет `git_tree_hash_v1`. |
| `vcs` | string | нет | `"git"` | Селектор VCS-адаптера: `"git"` (встроенный) или спецификатор модуля пакета внешнего адаптера. |
| `footprint.binding_id_prefix` | string | нет | `"IMP-"` | Префикс нейтрального ID, сканируемый для путей footprint. |
| `footprint.binding_field` | string | нет | `"binding"` | YAML-ключ, под которым в блоках IMP лежат пути к файлам. |
| `lint.spec_files` | string[] | нет | `[spec_file]` | Glob-шаблоны (posix) для файлов спецификации, сканируемых `sdd lint` / `sdd approve`. |
| `lint.approver_blocklist` | string[] | нет | `[]` | Дополнительные идентичности утверждающих, которые нужно отклонять поверх встроенного списка агентов. |
| `partitions` | object | нет | absent → flat shorthand | Режим нескольких партиций (`CTR-015`). Для каждой партиции `spec_paths` (обязательно), `test_paths`, `sandbox_paths`. |
| `test_paths` (top-level) | string[] | нет | `[]` | Сокращение, применяемое к синтезированному запасному варианту с единственной партицией, когда `partitions` отсутствует. |
| `sandbox_paths` (top-level) | string[] | нет | `[]` | Сокращение, применяемое к синтезированному запасному варианту с единственной партицией, когда `partitions` отсутствует. |

### Грамматика partition/baseline-id

`baseline_id` и каждый ключ `partitions.<name>` соответствуют:

```
^[a-z][a-z0-9-]*(:[a-z][a-z0-9-]*)*$
```

один или несколько токенов в нижнем регистре, соединённых `:`. Примеры: `pipeline-driver:BL-001`,
`bridge:commands:CON-004`. Односегментные ID — исходное значение по умолчанию, они
сохраняются без изменений.

---

## Советы по области обнаружения

- Запись области, которая разрешается в **ноль файлов** на HEAD, — жёсткая ошибка
  конфигурации. Это защищает от опечаток вроде `spec/0[0-9]-*.md`, когда таких
  файлов ещё не существует.
- Glob-шаблоны используют синтаксис git pathspec (`*`, `?`, `[abc]`) и разрешаются
  относительно `git ls-tree -r --name-only HEAD`.
- Порядок не имеет значения: `git ls-tree` канонизирует по имени, поэтому итоговый
  токен стабилен при любых перестановках.
- Держите область узкой и осмысленной. Она определяет, что означает «содержимое
  репозитория» для токена свежести: всё внутри неё отслеживается на дрейф, всё за её
  пределами — `unmodeled`.
- Включайте только источники наблюдаемого поведения: код, исходники
  API-контракта, тесты. Не включайте пути деплоя и платформы: конфиги окружений с
  хостами, адресами БД или ссылками на секреты, IaC и манифесты деплоя
  (`deploy/`, `k8s/`, `helm/`, `terraform/`), конфиги CI и релизов
  (`.github/workflows/`, `a.yaml`), Dockerfile. Иначе любое эксплуатационное
  изменение, например удаление хоста БД, делает базовую линию устаревшей.

---

## Блок Brownfield-базовой линии

`agent-sdd` ищет в `<spec_file>` единственный YAML-блок, у которого `id` равен
`config.baseline_id`, а `type` равен `BrownfieldBaseline`. Из него он читает два
поля:

```yaml
---
id: my-partition:BL-001
type: BrownfieldBaseline
freshness_token: <64-char hex>       # sha256 по области обнаружения (Discovery scope)
baseline_commit_sha: <40-char hex>   # коммит, на котором вычислен токен
mechanism: git_tree_hash_v1
# ... lifecycle, discovery_scope, coverage_evidence и т. д.
---
```

Два блока базовой линии с одинаковым `id` трактуются как ошибка конфигурации
(`baseline-block-duplicate`). В свежем репозитории оставьте `freshness_token` и
`baseline_commit_sha` в виде заглушек и заполните их через процедуру начальной
загрузки (см.
[sdd-methodology.ru.md → Разобранные сценарии](sdd-methodology.ru.md#разобранные-сценарии)).

---

## Режим нескольких партиций

Плоская форма `.sdd/config.json` сохраняется как **сокращение для единственной
партиции**, когда `partitions` отсутствует. Для репозитория, разбитого на несколько
зон владения, объявите их явно:

```json
{
  "spec_file": "spec/spec.md",
  "baseline_id": "my-partition:BL-001",
  "discovery_scope": ["src", "tests"],
  "mechanism": "git_tree_hash_v1",
  "partitions": {
    "my-partition": {
      "spec_paths": ["spec/spec.md"],
      "test_paths": ["tests/**/*.test.ts"],
      "sandbox_paths": ["spike/**"]
    },
    "billing": {
      "spec_paths": ["spec/billing.md"],
      "test_paths": ["tests/billing/**/*.test.ts"],
      "sandbox_paths": ["spike/billing/**"]
    }
  }
}
```

- **`spec_paths`** (обязательно для каждой партиции) — какими файлами спецификации
  владеет эта партиция.
- **`test_paths`** — где `sdd ready` ищет маркеры `@covers`, засчитываемые в пользу
  ID этой партиции.
- **`sandbox_paths`** — где ID со статусом `proposed`/`draft` разрешено находиться,
  не вызывая срабатывания `[unapproved]`.

Гейты выполняются по каждой партиции, поэтому дрейф или неутверждённый ID в одной
зоне никогда не блокирует другую. Кросс-партиционный тест, который законно
покрывает ID из двух партиций, должен присутствовать в `test_paths` **обеих**
партиций — неявного кросс-зачёта не предусмотрено.

---

## Выбор VCS-бэкенда

Бэкенд по умолчанию — **git** (`mechanism: git_tree_hash_v1`). Чтобы использовать
другую систему контроля версий, установите пакет внешнего адаптера и укажите на него
через `vcs`:

```json
{
  "spec_file": "spec/spec.md",
  "baseline_id": "my:BL-001",
  "discovery_scope": ["src", "tests"],
  "vcs": "my-vcs-adapter",
  "mechanism": "myvcs_content_v1"
}
```

Объявленный адаптером `mechanism` должен совпадать с `config.mechanism`, иначе CLI
завершается с кодом 2. Создание такого адаптера полностью разобрано в
[writing-vcs-adapters.md](writing-vcs-adapters.ru.md).

---

## См. также

- [commands.md](commands.ru.md) — как каждая команда использует эту конфигурацию.
- [sdd-methodology.md](sdd-methodology.ru.md) — базовая линия, токен и гейты, которые
  питает эта конфигурация.
- [`schema/sdd.config.schema.json`](../schema/sdd.config.schema.json) — формальная
  схема.
