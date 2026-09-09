import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Nebula — Private Encrypted Chat',
  description: 'Password-protected, end-to-end encrypted chat and calls.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>
        <div className="nebula-bg" />
        <div className="relative z-10 h-screen w-screen">{children}</div>
      </body>
    </html>
  );
}
