import { MarkdownContent } from "@/components/markdown-content";
import type { CustomizedComponentProps } from ".";
import { FeatureEngineeringControls } from "./featureeng-controls";
import { FEATURE_ENGINEERING_DATA } from "./featureeng-data";

type Feature = { category: string; name: string; code: string };

const SECTORS = FEATURE_ENGINEERING_DATA as Record<string, readonly Feature[]>;
const SECTOR_LABELS: Record<string, string> = {
	FINANCE: "Finance",
	MARKETING: "Marketing",
	HEALTHCARE: "Healthcare",
	RETAIL: "Retail",
	MANUFACTURING: "Manufacturing",
	ECOMMERCE: "E-Commerce",
	LOGISTICS: "Logistics",
	SUPPLY_CHAIN: "Supply Chain",
	TELECOM: "Telecommunications",
	ENERGY: "Energy & Utilities",
	AGRICULTURE: "Agriculture",
	TRANSPORTATION: "Transportation",
	REAL_ESTATE: "Real Estate",
	HUMAN_RESOURCES: "Human Resources",
	INSURANCE: "Insurance",
	CYBERSECURITY: "Cybersecurity",
	ML_OPS: "ML Ops / AI",
	EDUCATION: "Education",
};
const catalog = Object.fromEntries(
	Object.entries(SECTOR_LABELS).map(([key, label]) => [label, SECTORS[key]]),
) as Record<string, readonly Feature[]>;
const SECTOR_NAMES = Object.keys(catalog);
const ALL_FEATURES = SECTOR_NAMES.flatMap((sector) => catalog[sector]);

export function FeatureEngineering({ item }: CustomizedComponentProps) {
	const rows = Object.fromEntries(
		SECTOR_NAMES.map((sector) => [
			sector,
			catalog[sector].map((entry) => ({
				...entry,
				content: (
					<MarkdownContent source={`\`\`\`python\n${entry.code}\n\`\`\``} />
				),
			})),
		]),
	);
	return (
		<div className='space-y-6'>
			<div>
				<div className='flex flex-wrap gap-2 mb-3 text-xs text-muted-foreground'>
					<span className='rounded-full border border-input px-2.5 py-1'>
						{SECTOR_NAMES.length} sectors
					</span>
					<span className='rounded-full border border-input px-2.5 py-1'>
						{ALL_FEATURES.length} features
					</span>
					<span className='rounded-full border border-input px-2.5 py-1'>
						Pandas + NumPy
					</span>
				</div>
				<p className='text-muted-foreground leading-relaxed'>{item.covers}</p>
			</div>

			<FeatureEngineeringControls
				catalog={rows}
				sectorNames={SECTOR_NAMES}
				allFeatureCount={ALL_FEATURES.length}
			/>
		</div>
	);
}
