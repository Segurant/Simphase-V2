import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SimPhase | Prop Firm Challenge Simulator — FTMO, Topstep, FundedNext',
  description: 'Monte Carlo simulator for prop firm challenges. Thousands of rule-accurate simulated attempts of FTMO, Topstep, FundedNext and FundingPips — know if a challenge is playable before you pay another fee.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
