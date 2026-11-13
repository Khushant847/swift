import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { FloatingActions } from '@/components/FloatingActions';
import { ApiStatusWatcher } from '@/components/ApiStatusWatcher';
import { JsonLd } from '@/components/JsonLd';
import { getCompanyInfo, getNav, getPublicSettings } from '@/lib/api';
import { SITE_NAME, SITE_URL, absoluteUrl } from '@/lib/seo';
import { organizationSchema, websiteSchema } from '@/lib/schema';

export async function generateMetadata(): Promise<Metadata> {
  const company = await getCompanyInfo();
  const name = company.company_name || SITE_NAME;
  const tagline = company.tagline || 'Precision Weighing & Measurement Solutions';
  const logo = company.logo_url || company.logo;
  const location = company.address ? 'Faridabad (NCR-Delhi), India' : null;
  const description = [
    tagline,
    'Laboratory balances, industrial scales and calibration services.',
    location ? `Based in ${location}.` : null,
  ]
    .filter(Boolean)
    .join(' ');
  // Preview deployments must never compete with the production domain in
  // search results. Production (and self-hosted builds) stay indexable.
  const isPreview = Boolean(process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production');

  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: `${name} — ${tagline}`,
      template: `%s | ${name}`,
    },
    description,
    applicationName: name,
    authors: [{ name }],
    creator: name,
    publisher: name,
    openGraph: {
      title: `${name} — ${tagline}`,
      description,
      url: SITE_URL,
      siteName: name,
      locale: 'en_IN',
      type: 'website',
      ...(logo ? { images: [{ url: absoluteUrl(logo), alt: name }] } : {}),
    },
    twitter: {
      card: logo ? 'summary_large_image' : 'summary',
      title: `${name} — ${tagline}`,
      description,
      ...(logo ? { images: [absoluteUrl(logo)] } : {}),
    },
    robots: isPreview
      ? { index: false, follow: false }
      : { index: true, follow: true },
  };
}

export const viewport: Viewport = {
  themeColor: '#0b3d91',
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [nav, company, settings] = await Promise.all([getNav(), getCompanyInfo(), getPublicSettings()]);
  const headerNav = nav.filter((n) => n.location === 'header');
  const footerNav = nav.filter((n) => n.location === 'footer');

  const schemas = [organizationSchema(company, settings), websiteSchema(company)].filter(
    (schema): schema is Record<string, unknown> => schema !== null,
  );

  return (
    <html lang="en-IN">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>
        {schemas.length ? <JsonLd data={schemas} /> : null}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-brand-800 focus:px-4 focus:py-2 focus:text-white"
        >
          Skip to content
        </a>
        <Header nav={headerNav} company={company} />
        <main id="main" tabIndex={-1}>{children}</main>
        <Footer nav={footerNav} company={company} settings={settings} />
        <FloatingActions phone={company.mobile} whatsapp={company.whatsapp} />
        <ApiStatusWatcher />
      </body>
    </html>
  );
}
