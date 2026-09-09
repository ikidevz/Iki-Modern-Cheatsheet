import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Sidebar } from "@/components/sidebar";
import { themeInitScript } from "@/lib/apply-theme";
import { ibmPlexMono, ibmPlexSans } from "@/lib/fonts";

import "./globals.css";

export const metadata: Metadata = {
	title: "Iki's Modern Cheatsheets",
	description: "A working index of reference sheets for data work.",
	metadataBase: new URL(
		process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
	),
	applicationName: "Iki's Modern Data Cheatsheets",
	icons: {
		icon: [
			{
				url: "/assets/img/icon_light.png",
				media: "(prefers-color-scheme: light)",
			},
			{
				url: "/assets/img/icon_dark.png",
				media: "(prefers-color-scheme: dark)",
			},
		],
	},
	openGraph: {
		type: "website",
		locale: "en_US",
		siteName: "Iki's Modern Data Cheatsheets",
		title: "Iki's Modern Data Cheatsheets",
		description: "A working index of reference sheets for data work.",
		images: [
			{
				url: "/assets/img/header_logo_light.png",
				alt: "Iki's Modern Data Cheatsheets",
			},
		],
	},
	twitter: {
		card: "summary_large_image",
		title: "Iki's Modern Data Cheatsheets",
		description: "A working index of reference sheets for data work.",
		images: ["/assets/img/header_logo_light.png"],
	},
	robots: {
		index: true,
		follow: true,
	},
};

export const viewport: Viewport = {
	width: "device-width",
	initialScale: 1,
	viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
	return (
		<html lang='en' suppressHydrationWarning>
			<head>
				<meta name='theme-color' content='hsl(0 0% 100%)' />
			</head>
			<body
				className={`${ibmPlexSans.variable} ${ibmPlexMono.variable} font-sans antialiased`}>
				<Script id='theme-init' strategy='beforeInteractive'>
					{themeInitScript()}
				</Script>
				<div className='flex flex-col md:flex-row h-screen overflow-hidden bg-background text-foreground'>
					<Sidebar />
					<main className='flex-1 overflow-y-auto'>
						<div
							className='mx-auto px-6 md:px-10 py-10 md:py-14 pb-24'
							style={{
								paddingBottom: "max(6rem, env(safe-area-inset-bottom))",
							}}>
							{children}
						</div>
					</main>
				</div>
			</body>
		</html>
	);
}
