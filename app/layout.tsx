import type { Metadata, Viewport } from "next";
import { ibmPlexSans, ibmPlexMono } from "@/lib/fonts";
import { Sidebar } from "@/components/sidebar";
import { themeInitScript } from "@/lib/apply-theme";
import Script from "next/script";

import "./globals.css";

export const metadata: Metadata = {
	title: "Iki's Modern Cheatsheets",
	description: "A working index of reference sheets for data work.",
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
