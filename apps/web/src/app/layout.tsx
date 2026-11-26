import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/components/ThemeProvider';
import { Navbar } from '@/components/Navbar';

export const metadata: Metadata = {
  title: 'WordShift — Real-Time Word Transformation Duel',
  description:
    'Two players share one evolving word chain. Change one letter per turn to reach the target word first.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] antialiased">
        <ThemeProvider>
          <Navbar />
          <main className="mx-auto max-w-5xl px-4 py-6 sm:py-10">{children}</main>
        </ThemeProvider>
      </body>
    </html>
  );
}
