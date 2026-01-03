# Figma + Docs → Prompt Builder Tool

Tool để thu thập context từ Figma + tài liệu → build prompt chuẩn → đưa vào Cursor để generate Unit Tests.

## ⚠️ Lưu ý quan trọng

- **Tool KHÔNG hiểu source code**
- **Tool KHÔNG generate Unit Tests**
- **Cursor làm 100% phần "hiểu source" và generate UT**

## Tổng quan luồng kỹ thuật

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

## Thành phần

### 1. Figma MCP Server (`figma-mcp/`)

**Mục đích**: Lấy thông tin màn hình từ Figma (không lấy code UI).

**Tool**: `get_figma_data`

Input:
- `fileKey`: Figma file key
- `nodeId`: Node ID (optional)
- `simplified`: `true` để lấy simplified screen data (screen, components, fields, actions)
- `simplified`: `false` (default) để lấy full design data

**Simplified Output** (khi `simplified=true`):
```json
{
  "screen": "Login",
  "components": ["EmailInput", "PasswordInput", "SubmitButton"],
  "fields": [
    { "name": "email", "type": "text" },
    { "name": "password", "type": "password" }
  ],
  "actions": ["submit"]
}
```

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

**⚠️ Quan trọng**: Luôn truyền `screenContext` từ Figma để chỉ lấy rules/flows liên quan đến screen đó.

Output JSON:
```json
{
  "rules": [
    "Email is required",
    "Password minimum 8 characters"
  ],
  "flows": [
    "User enters email and password",
    "System validates credentials"
  ]
}
```

### 3. Prompt Builder Service (`prompt-builder-mcp/`)

**Mục đích**: Merge JSON từ Figma + Docs → generate prompt.md

**Chức năng**:
- Nhận JSON từ 2 MCP servers
- Merge thành 1 prompt duy nhất
- Không thêm suy luận
- Không đoán logic backend

**Output**: `prompt.md` theo template chuẩn

## Cài đặt

### Prerequisites

- Node.js >= 18
- Docker & Docker Compose (optional)
- Figma API Key

### Setup từng service

#### Figma MCP

```bash
cd figma-mcp
cp env.example .env
# Edit .env với FIGMA_API_KEY của bạn
npm install
npm run build
```

#### Docs Parser MCP

```bash
cd docs_parser-mcp
npm install
npm run build
```

#### Prompt Builder

```bash
cd prompt-builder-mcp
npm install
npm run build
```

### Docker Compose (Recommended)

```bash
# Tạo .env file ở root
FIGMA_API_KEY=figd_xxx

# Start tất cả services
docker-compose up -d

# Check logs
docker-compose logs -f
```

## Sử dụng

### Bước 1: Lấy data từ Figma

```bash
# Gọi MCP tool get_figma_data với simplified=true
# Output: figma-screen.json
# {
#   "screen": "Login",
#   "components": ["EmailInput", "PasswordInput"],
#   "fields": [{"name": "email", "type": "text"}, ...],
#   "actions": ["submit"]
# }
```

### Bước 2: Parse tài liệu với screen context

```bash
# Gọi MCP tool parse_docs với filePath VÀ screenContext từ Figma
# parse_docs({
#   filePath: "./docs/requirements.md",
#   screenContext: figmaScreenData  // <-- Quan trọng!
# })
# Output: docs-data.json (chỉ rules/flows liên quan đến Login screen)
```

### Bước 3: Build prompt

```bash
# Option 1: CLI
cd prompt-builder-mcp
node dist/main.js ../data/figma-screen.json ../data/docs-data.json ../prompts/login.prompt.md

# Option 2: HTTP API
curl -X POST http://localhost:3001/build-prompt-from-files \
  -H "Content-Type: application/json" \
  -d '{
    "figmaJsonPath": "./data/figma-screen.json",
    "docsJsonPath": "./data/docs-data.json",
    "outputPath": "./prompts/login.prompt.md"
  }'
```

### Bước 4: Sử dụng prompt trong Cursor

1. Mở Cursor với source code local
2. Paste prompt vào Cursor
3. Cursor sẽ:
   - Đọc source code
   - Mapping UI → API → service
   - Generate Unit Tests
   - Ghi vào `ut-docs/<screen-name>/<screen-name>.ut.md`

## Output Structure

```
ut-docs/
├─ login/
│  └─ login.ut.md
├─ register/
│  └─ register.ut.md
└─ ...
```

Mỗi screen = 1 folder, Cursor tự động tạo structure này.

## Development

### Run từng service riêng lẻ

```bash
# Figma MCP (HTTP mode)
cd figma-mcp
npm start

# Docs Parser MCP (stdio mode)
cd docs_parser-mcp
npm start

# Prompt Builder (HTTP mode)
cd prompt-builder-mcp
npm run http
```

### Test

```bash
# Test Figma MCP
cd figma-mcp
npm test

# Test integration
# (TBD)
```

## Cấu trúc thư mục

```
.
├── figma-mcp/          # Figma MCP Server
├── docs_parser-mcp/    # Docs Parser MCP Server
├── prompt-builder-mcp/ # Prompt Builder Service
├── docker-compose.yml  # Docker orchestration
├── prompts/            # Generated prompts (gitignored)
├── data/               # Temporary JSON data (gitignored)
└── ut-docs/            # Generated UT docs (gitignored)
```

## License

MIT

