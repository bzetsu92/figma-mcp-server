import { startServer } from "@mcp/server";
startServer().catch((error) => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Failed to start server:", errorMessage);
    process.exit(1);
});
