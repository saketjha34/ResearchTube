# ResearchTube System Architecture & Diagrams (Archify Specifications)

Interactive architecture, execution sequence, multi-agent workflow, and state lifecycle diagrams generated using **Archify**.

---

## 🎨 Interactive Archify Viewers

> [!TIP]
> Click the links below to open the self-contained interactive Archify HTML/SVG viewers in your browser. Features include Dark/Light Theme Toggles, Node Inspection, Route Tracing, and SVG/PNG Exporting.

- 🔄 **Pipeline Execution Lifecycle**: [`lifecycle_diagram.html`](file:///c:/Saket/Projects/ResearchTube/docs/architecture/lifecycle_diagram.html)
- 🔀 **Multi-Agent RAG Pipeline Workflow**: [`workflow_diagram.html`](file:///c:/Saket/Projects/ResearchTube/docs/architecture/workflow_diagram.html)
- 🏗️ **High-Level System Overview**: [`high_level_system_overview.html`](file:///c:/Saket/Projects/ResearchTube/docs/architecture/high_level_system_overview.html)
- ⏱️ **Pipeline Execution Sequence**: [`sequence_diagram.html`](file:///c:/Saket/Projects/ResearchTube/docs/architecture/sequence_diagram.html)

---

## 1. Lifecycle Specification Overview

The Archify JSON spec [`researchtube.lifecycle.json`](researchtube.lifecycle.json) models the pipeline state transitions, retries, rate limits, out-of-band exceptions, and terminal states:

```json
{
  "diagram_type": "lifecycle",
  "meta": {
    "title": "ResearchTube Multi-Agent Pipeline Lifecycle",
    "subtitle": "States, retries, waits, terminal outcomes, and proxy failure recovery loops",
    "output": "lifecycle_diagram.html"
  },
  "lanes": [
    { "id": "main", "label": "Main Execution Flow" },
    { "id": "waiting", "label": "Interruption Gates" },
    { "id": "exceptions", "label": "Recovery & Retry Loop" },
    { "id": "terminal", "label": "Terminal Outcomes" }
  ]
}
```

---

## 2. Archify Delivery Verification Log

All specifications were validated against typed JSON schemas, passed all automated composition and clearance checks, and delivered as standalone HTML interactive viewers:

| Diagram Type | Specification Source | Output Path | SHA-256 Digest | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Pipeline Lifecycle** | [`researchtube.lifecycle.json`](researchtube.lifecycle.json) | [`lifecycle_diagram.html`](lifecycle_diagram.html) | `9978a7e97b3f271c493de7a56b3e8d401dc5b88e67108c5e4c058a1bfc00196d` | ✅ Pass (0 errors) |
| **Pipeline Workflow** | [`researchtube.workflow.v2.json`](researchtube.workflow.v2.json) | [`workflow_diagram.html`](workflow_diagram.html) | `0dda9f22d018f00a37e49d34114ce49dc81802d9e4e2c0f1827b0ac7b717867f` | ✅ Pass (0 errors) |
| **System Overview** | [`high_level_system_overview.json`](high_level_system_overview.json) | [`high_level_system_overview.html`](high_level_system_overview.html) | `e58cb3a27ff1446358f392dee2bdd225453a0870056f6425e5035b9d3f2f5f5a` | ✅ Pass (0 errors) |
| **Execution Sequence** | [`researchtube.sequence.json`](researchtube.sequence.json) | [`sequence_diagram.html`](sequence_diagram.html) | `92b8a927385ef6379f686e4d07c0c323dc0a3c3e24163bedb374e77d0594b0ef` | ✅ Pass (0 errors) |
