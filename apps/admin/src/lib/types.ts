export type Role = 'super_admin' | 'content_editor';

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  role: Role;
  isActive?: boolean;
  mfaEnabled?: boolean;
  lastLoginAt?: string | null;
  createdAt?: string;
}

export interface LoginResponse {
  mfaRequired?: boolean;
  method?: 'totp' | 'email';
  challengeId?: string;
  admin?: AdminUser;
}

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
  displayOrder: number;
  intervalSeconds: number;
  isActive: boolean;
}

export interface WhyItem {
  id: string;
  title: string;
  description: string;
  icon: string;
  displayOrder: number;
  isActive: boolean;
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
}

export interface UpcomingProduct {
  id: string;
  title: string;
  teaserDesc: string;
  expectedLaunch: string;
  imageUrl?: string | null;
  displayOrder: number;
  isActive: boolean;
}

export interface GalleryItem {
  id: string;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  categoryTag: string;
  caption?: string | null;
  uploadedAt?: string;
}

export interface Review {
  id: string;
  authorName: string;
  rating: number;
  text: string;
  profilePhotoUrl?: string | null;
  source: string;
  isFeatured: boolean;
  isHidden: boolean;
  reviewTime: string;
}

export interface Enquiry {
  id: string;
  name: string;
  email: string;
  phone: string;
  companyName?: string | null;
  subject?: string | null;
  message: string;
  status: 'new' | 'contacted' | 'closed';
  notes?: string | null;
  createdAt: string;
}

export interface MediaItem {
  id: string;
  url: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  folder: string;
  tags?: string | null;
  uploadedAt: string;
  mediaType?: 'image' | 'video';
}

export interface AuditEntry {
  id: string;
  adminEmail: string;
  action: string;
  entity: string;
  entityId?: string | null;
  details?: string | null;
  ipAddress?: string | null;
  createdAt: string;
}

export interface DashboardData {
  stats: {
    totalEnquiries: number;
    newEnquiries: number;
    contactedEnquiries: number;
    activeProducts: number;
    featuredProducts: number;
    mediaCount: number;
    galleryCount: number;
    upcomingCount: number;
    reviewCount: number;
    navigationCount: number;
    bannerCount: number;
  };
  recentEnquiries: Enquiry[];
  recentAudit: AuditEntry[];
  trend: { date: string; count: number }[];
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
