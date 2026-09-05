import { readFile } from "fs/promises";
import path from "path";

export async function getSheetBody(id: string): Promise<string | null> {
	const file = path.join(process.cwd(), "content", "sheets", `${id}.md`);
	try {
		return await readFile(file, "utf8");
	} catch {
		return null;
	}
}
