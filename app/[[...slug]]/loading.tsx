export default function Loading() {
	return (
		<div className='min-h-[50vh]' aria-busy='true'>
			<div className='w-full max-w-5xl space-y-7'>
				<div className='h-4 w-28 animate-pulse rounded bg-muted' />

				<div className='space-y-3'>
					<div className='h-8 w-3/5 animate-pulse rounded bg-muted' />
					<div className='h-3 w-48 animate-pulse rounded bg-muted' />
					<div className='h-5 w-24 animate-pulse rounded-full bg-primary/20' />
				</div>

				<div className='space-y-2'>
					<div className='h-4 w-4/5 animate-pulse rounded bg-muted' />
					<div className='h-4 w-3/5 animate-pulse rounded bg-muted' />
				</div>

				<div className='space-y-4'>
					<div className='h-5 w-44 animate-pulse rounded bg-muted' />
					<div className='space-y-2'>
						<div className='h-3 w-full animate-pulse rounded bg-muted' />
						<div className='h-3 w-11/12 animate-pulse rounded bg-muted' />
						<div className='h-3 w-4/5 animate-pulse rounded bg-muted' />
					</div>
				</div>

				<div className='space-y-4'>
					<div className='h-5 w-56 animate-pulse rounded bg-muted' />
					<div className='overflow-hidden rounded-lg border border-border bg-muted/40 p-4'>
						<div className='space-y-2'>
							<div className='h-3 w-4/5 animate-pulse rounded bg-muted' />
							<div className='h-3 w-full animate-pulse rounded bg-muted' />
							<div className='h-3 w-3/4 animate-pulse rounded bg-muted' />
							<div className='h-3 w-11/12 animate-pulse rounded bg-muted' />
							<div className='h-3 w-2/5 animate-pulse rounded bg-muted' />
						</div>
					</div>
				</div>

				<div className='space-y-2'>
					<div className='h-5 w-36 animate-pulse rounded bg-muted' />
					<div className='h-3 w-full animate-pulse rounded bg-muted' />
					<div className='h-3 w-5/6 animate-pulse rounded bg-muted' />
				</div>

				<p className='text-center text-xs text-muted-foreground'>
					Loading sheet...
				</p>
			</div>
		</div>
	);
}
