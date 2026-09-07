import { MarkdownContent } from "@/components/markdown-content";
import { getSheetBody } from "@/lib/get-sheet-body";

const EXAMPLE_FILES = Array.from(
	{ length: 20 },
	(_, index) =>
		`${String(index + 1).padStart(2, "0")}-${
			[
				"ecommerce-order-management",
				"auth-rbac",
				"social-network",
				"booking-reservation",
				"blog-cms",
				"inventory-warehouse",
				"subscription-billing",
				"multi-tenant-saas",
				"hierarchical-data",
				"warehouse-star-schema",
				"banking-ledger",
				"healthcare-patient-records",
				"ride-sharing-logistics",
				"event-ticketing",
				"learning-management-system",
				"messaging-chat-system",
				"job-board-recruitment",
				"polymorphic-associations",
				"survey-dynamic-form-builder",
				"notification-system",
			][index]
		}.md`,
);

const EXAMPLE_TITLES = [
	"E-Commerce / Order Management",
	"Authentication & RBAC",
	"Social Network",
	"Booking & Reservation",
	"Blog / CMS",
	"Inventory & Warehouse",
	"Subscription Billing",
	"Multi-Tenant SaaS",
	"Hierarchical Data",
	"Warehouse Star Schema",
	"Banking Ledger",
	"Healthcare Patient Records",
	"Ride-Sharing / Logistics",
	"Event Ticketing",
	"Learning Management System",
	"Messaging / Chat System",
	"Job Board / Recruitment",
	"Polymorphic Associations",
	"Survey / Dynamic Form Builder",
	"Notification System",
];

export async function DataModelingExamples() {
	const examples = await Promise.all(
		EXAMPLE_FILES.map(async (file, index) => ({
			id: file,
			title: EXAMPLE_TITLES[index],
			content: await getSheetBody(`Data Modeling/examples/${file}`),
		})),
	);

	return (
		<div>
			<div className='mb-7'>
				<div className='flex items-center gap-1.5 text-muted-foreground text-xs font-medium mb-2.5'>
					<span className='w-1.5 h-1.5 rounded-full bg-cat-eng' />
					Data Modeling
				</div>
				<h1 className='text-2xl md:text-[27px] font-semibold tracking-tight mb-1.5'>
					Data Modeling Examples
				</h1>
				<p className='text-base md:text-[16.5px] text-muted-foreground'>
					Twenty practical schemas, relationships, and design patterns.
				</p>
			</div>

			<div className='border-y border-border py-4 mb-8'>
				<p className='text-sm font-medium mb-3'>Choose an example</p>
				<div className='space-y-2' aria-live='polite'>
					{examples.map((example, index) => (
						<details key={example.id} open={index === 0} className='group'>
							<summary className='cursor-pointer list-none rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-muted [&::-webkit-details-marker]:hidden'>
								{String(index + 1).padStart(2, "0")} - {example.title}
							</summary>
							<div className='px-3 pt-4'>
								{example.content ? (
									<MarkdownContent source={example.content} />
								) : (
									<p className='text-muted-foreground'>
										Example content is unavailable.
									</p>
								)}
							</div>
						</details>
					))}
				</div>
			</div>
		</div>
	);
}
