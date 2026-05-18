import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import AntdProvider from '../components/AntdProvider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'GoalSync | Enterprise Performance Management',
  description: 'In-House Goal Setting & Tracking Portal for enterprise employee performance management',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AntdProvider>
          {children}
        </AntdProvider>
      </body>
    </html>
  );
}
