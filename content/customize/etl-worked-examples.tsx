import { DataModelingExampleSelector } from "@/components/data-modeling-example-selector";
import { getSheetBody } from "@/lib/get-sheet-body";
import { renderMarkdown } from "@/lib/markdown";

const EXAMPLE_FILES = [
	"batch-elt-ecommerce-orders.md",
	"cdc-inventory-sync.md",
	"streaming-clickstream-analytics.md",
	"dbt-medallion-project-structure.md",
	"data-quality-gate-pipeline.md",
	"safe-backfill-after-bug-fix.md",
	"multi-source-customer-360.md",
	"file-landing-zone-ingestion.md",
	"realtime-fraud-detection.md",
	"gdpr-deletion-propagation.md",
];

const EXAMPLE_TITLES = [
	"Batch ELT Pipeline / E-Commerce Orders",
	"CDC-Based Near-Real-Time Inventory Sync",
	"Streaming Clickstream Analytics",
	"Production dbt Project / Medallion Layer Structure",
	"Data Quality Gate Before Publishing to BI",
	"Safe Backfill After a Bug Fix",
	"Multi-Source Customer 360 Pipeline",
	"File-Based Landing Zone Ingestion",
	"Real-Time Fraud Detection Streaming Pipeline",
	"GDPR PII Deletion Propagation Pipeline",
];

export async function ETLWorkedExamples() {
	const examples = await Promise.all(
		EXAMPLE_FILES.map(async (file, index) => ({
			id: file,
			title: EXAMPLE_TITLES[index],
			content: await getSheetBody(`ETLxELT/examples/${file}`),
		})),
	);
	const renderedExamples = await Promise.all(
		examples.map(async (example) => ({
			...example,
			content: example.content ? await renderMarkdown(example.content) : null,
		})),
	);

	return (
		<div>
			<div className='mb-7'>
				<div className='flex items-center gap-1.5 text-muted-foreground text-xs font-medium mb-2.5'>
					<span className='w-1.5 h-1.5 rounded-full bg-cat-etl' />
					ETL / ELT
				</div>
				<h1 className='text-2xl md:text-[27px] font-semibold tracking-tight mb-1.5'>
					ETL / ELT Worked Examples
				</h1>
				<p className='text-base md:text-[16.5px] text-muted-foreground'>
					Ten end-to-end pipelines, operational workflows, and production
					scenarios.
				</p>
			</div>

			<DataModelingExampleSelector examples={renderedExamples} />
		</div>
	);
}
