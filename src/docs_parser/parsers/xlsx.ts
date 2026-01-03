import * as XLSX from "xlsx";
import * as fs from "fs";

export function parseXLSX(filePath: string): string {
    if (!fs.existsSync(filePath)) {
        throw new Error(`XLSX file not found: ${filePath}`);
    }

    try {
        const wb = XLSX.readFile(filePath);
        
        if (wb.SheetNames.length === 0) {
            throw new Error("Excel file has no sheets");
        }

        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });

        if (rows.length === 0) {
            return "";
        }

        const headers = (rows[0] as string[]) || [];
        if (headers.length === 0) {
            return rows.map((row) => (row as unknown[]).join(", ")).join("\n");
        }

        return rows
            .slice(1)
            .map((row: unknown[]) =>
                headers.map((h, i) => `${h}: ${(row[i] ?? "").toString()}`).join(", ")
            )
            .filter((line) => line.trim().length > 0)
            .join("\n");
    } catch (error) {
        throw new Error(`Failed to parse XLSX: ${error instanceof Error ? error.message : String(error)}`);
    }
}

