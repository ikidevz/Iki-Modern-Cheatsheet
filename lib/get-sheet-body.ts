import { readFile } from "fs/promises";
import path from "path";

export async function getSheetBody(
	file: string | undefined,
): Promise<string | null> {
	if (file === undefined) return null;

	try {
		const filePath = path.join(process.cwd(), "content", "sheets", file);
		return await readFile(filePath, "utf8");
	} catch {
		return null;
	}
}
