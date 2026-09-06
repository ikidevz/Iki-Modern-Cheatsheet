export default function Loading() {
	return (
		<div className='flex min-h-[50vh] items-center justify-center'>
			<div className='w-full max-w-md space-y-4' aria-busy='true'>
				<div className='flex items-center gap-3'>
					<div className='h-8 w-8 animate-pulse rounded-md bg-primary/20' />
					<div className='h-5 w-48 animate-pulse rounded bg-muted' />
				</div>
				<div className='h-3 w-32 animate-pulse rounded bg-muted' />
				<div className='space-y-2'>
					<div className='h-3 w-full animate-pulse rounded bg-muted' />
					<div className='h-3 w-5/6 animate-pulse rounded bg-muted' />
					<div className='h-3 w-2/3 animate-pulse rounded bg-muted' />
				</div>
				<p className='text-center text-xs text-muted-foreground'>
					Loading sheet...
				</p>
			</div>
		</div>
	);
}
