import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
    title: "el Agénte - Investigation Dashboard",
    description: "AI-Powered SRE Investigation Dashboard",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body>
                {children}
            </body>
        </html>
    );
}
