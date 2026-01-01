# Figma MCP Server

A Model Context Protocol (MCP) server that provides AI assistants with comprehensive access to Figma design data. This server enables AI tools like Cursor and Claude Desktop to fetch design information, extract component details, and download assets from Figma files.

## Prerequisites

- Node.js >= 18.0.0
- Figma API key ([Get one here](https://www.figma.com/developers/api#access-tokens))

## Installation

```bash
# Clone the repository
git clone <https://github.com/bzetsu92/figma-mcp-server.git>
cd figma-mcp-server

# Install dependencies
npm install

# Build the project
npm run build
```

## Adding to Cursor

1. Open Cursor Settings → Features → Model Context Protocol

2. Click "Add MCP Server" or edit your MCP settings file (usually `~/.cursor/mcp.json` or in Cursor settings)

3. Add the following configuration:

```json
{
  "mcpServers": {
    "figma": {
      "transport": "http",
      "url": "http://localhost:3333/mcp"
    }
  }
}
```

**Important**: Replace `/absolute/path/to/Figma-Context-MCP` with the actual absolute path to your project directory.

4. Restart Cursor

5. Verify the MCP server is connected by checking the MCP status in Cursor settings

## Usage

Once configured, you can use the MCP tools in your AI assistant:

### Get Figma Data

Ask your AI assistant to fetch Figma design data:

```
"Get the design data from this Figma file: https://www.figma.com/design/oXcy3FGjqSqYiiHJc3CAJb/MCP_Testing?node-id=1005-3058"
```

The AI will use the `get_figma_data` tool to fetch:
- Layout information
- Component properties and variants
- Design tokens and styles
- Text content
- Visual elements

## MCP Tools

### `get_figma_data`

Fetches comprehensive Figma file data including layout, content, visuals, and component information.

**Parameters:**
- `fileKey` (string, required): The Figma file key from the URL
- `nodeId` (string, optional): Specific node ID to fetch (reduces API calls)
- `depth` (number, optional): How many levels deep to traverse (use sparingly)

**Example Response:**
```yaml
nodes:
  - id: "1005:3058"
    type: "FRAME"
    name: "Screen"
    layout:
      x: 0
      y: 0
      width: 375
      height: 812
    styles:
      backgroundColor: "#FFFFFF"
    children: [...]
globalVars:
  styles: {...}
metadata:
  name: "MCP_Testing"
  lastModified: "2024-01-01T00:00:00Z"
```

### `download_figma_images`

Downloads PNG or SVG images from Figma nodes. Only available if `SKIP_IMAGE_DOWNLOADS=false`.

**Parameters:**
- `fileKey` (string, required): The Figma file key
- `nodes` (array, required): Array of node objects with `nodeId` and `fileName`
- `localPath` (string, required): Directory to save images
- `pngScale` (number, optional): PNG export scale (default: 2)

## API Endpoints (HTTP Mode)

When running in HTTP mode (not stdio), the server provides:

- `GET /health` - Health check
- `GET /docs` - Swagger UI documentation
- `POST /mcp` - MCP protocol endpoint

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
