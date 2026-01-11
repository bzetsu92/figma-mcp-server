# Figma + Docs → Prompt Builder Tool

Tool để thu thập context từ Figma + tài liệu → build prompt chuẩn → đưa vào Cursor để generate Unit Tests.

```
Figma API  ─┐
            ├─> MCP Layer ──> JSON Context
Docs Parser ┘

JSON Context
      ↓
Prompt Builder (NodeJS)
      ↓
prompt.md
      ↓
(copy / webhook / agent)
      ↓
Cursor (source local)
      ↓
Generate UT .md → ut-docs/
```

### 1. Figma MCP Server (`figma-mcp/`)

**Mục đích**: Lấy thông tin màn hình từ Figma (không lấy code UI).

**Tool**: `get_figma_data`

Input:
- `fileKey`: Figma file key
- `nodeId`: Node ID (optional)
- `simplified`: `true` để lấy simplified screen data (screen, components, fields, actions)
- `simplified`: `false` (default) để lấy full design data

### 2. Docs Parser MCP Server (`docs_parser-mcp/`)

**Mục đích**: Parse PDF/DOC/XLSX và extract business rules **theo context của screen từ Figma**.

**Tool**: `parse_docs`

Input:
- `filePath`: Đường dẫn đến file
- `screenContext` (optional): Context từ Figma để filter relevant content
  - `screen`: Tên screen
  - `components`: Danh sách components
  - `fields`: Danh sách fields
  - `actions`: Danh sách actions

## License

MIT

