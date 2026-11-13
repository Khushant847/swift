import { getGallery, getGalleryTags } from '@/lib/api';
import { pageMetadata } from '@/lib/seo';
import { PageHero } from '@/components/PageHero';
import { GalleryGrid } from '@/components/GalleryGrid';

export const metadata = pageMetadata({
  title: 'Gallery',
  description: 'Explore our laboratories, manufacturing floor, office and team at Swift Instruments in Faridabad.',
  path: '/gallery',
});

export default async function GalleryPage() {
  const [items, tags] = await Promise.all([getGallery(), getGalleryTags()]);
  return (
    <>
      <PageHero
        title="Internal Gallery"
        subtitle="A transparent look inside the facility, laboratories and people behind Swift Instruments."
        breadcrumb={[{ label: 'Home', href: '/' }, { label: 'Gallery' }]}
      />
      <GalleryGrid items={items} tags={tags} />
    </>
  );
}
