import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/wallet/Providers";

export const metadata: Metadata = {
  title: { default: "GTR", template: "%s · GTR" },
  description: "A launchpad on Robinhood Chain where every token is priced in a word coin that follows daily attention.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
