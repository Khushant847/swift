export interface NavLink {
  id: string;
  title: string;
  url: string;
  position: number;
  location: 'header' | 'footer';
  isActive: boolean;
}

export interface Banner {
  id: string;
  title?: string | null;
  subtitle?: string | null;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  intervalSeconds: number;
  displayOrder: number;
}

export interface WhyItem {
  id: string;
  title: string;
  description: string;
  icon: string;
  displayOrder: number;
}

export interface Product {
  id: string;
  title: string;
  slug: string;
  category: string;
  shortDesc?: string | null;
  description: string;
  imageUrl?: string | null;
  specs?: string | null;
  isFeatured: boolean;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface UpcomingProduct {
  id: string;
  title: string;
  teaserDesc: string;
  expectedLaunch: string;
  imageUrl?: string | null;
}

export interface GalleryItem {
  id: string;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  categoryTag: string;
  caption?: string | null;
}

export interface Review {
  id: string;
  authorName: string;
  rating: number;
  text: string;
  profilePhotoUrl?: string | null;
  source: string;
  isFeatured: boolean;
  reviewTime: string;
}

export interface ReviewsResponse {
  items: Review[];
  average: number;
  count: number;
}

export interface PublicSettings {
  footer_text?: string;
  social_links?: string;
  copyright?: string;
  legal_disclaimer?: string;
}

export type CompanyInfo = Record<string, string>;

export interface ProductsResponse {
  items: Product[];
  total: number;
  page: number;
  pageSize: number;
}
