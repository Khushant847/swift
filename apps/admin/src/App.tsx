import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { FullPageSpinner } from './components/ui/Feedback';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/Login';
import { DashboardPage } from './pages/Dashboard';
import { BannersPage } from './pages/Banners';
import { NavigationPage } from './pages/Navigation';
import { WhyChooseUsPage } from './pages/WhyChooseUs';
import { ProductsPage } from './pages/Products';
import { UpcomingPage } from './pages/Upcoming';
import { GalleryPage } from './pages/Gallery';
import { ReviewsPage } from './pages/Reviews';
import { CompanyPage } from './pages/Company';
import { EnquiriesPage } from './pages/Enquiries';
import { MediaPage } from './pages/Media';
import { UsersPage } from './pages/Users';
import { AuditPage } from './pages/Audit';
import { SettingsPage } from './pages/Settings';
import { NotFoundPage } from './pages/NotFound';

function Protected({ children }: { children: React.ReactNode }) {
  const { admin, loading } = useAuth();
  if (loading) return <FullPageSpinner label="Verifying session…" />;
  if (!admin) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

function SuperOnly({ children }: { children: React.ReactNode }) {
  const { admin } = useAuth();
  if (admin?.role !== 'super_admin') return <Navigate to="/" replace />;
  return <>{children}</>;
}

export function App() {
  const { admin, loading } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={loading ? <FullPageSpinner /> : admin ? <Navigate to="/" replace /> : <LoginPage />}
      />
      <Route path="/" element={<Protected><DashboardPage /></Protected>} />
      <Route path="/banners" element={<Protected><BannersPage /></Protected>} />
      <Route path="/navigation" element={<Protected><NavigationPage /></Protected>} />
      <Route path="/why-choose-us" element={<Protected><WhyChooseUsPage /></Protected>} />
      <Route path="/products" element={<Protected><ProductsPage /></Protected>} />
      <Route path="/upcoming" element={<Protected><UpcomingPage /></Protected>} />
      <Route path="/gallery" element={<Protected><GalleryPage /></Protected>} />
      <Route path="/reviews" element={<Protected><ReviewsPage /></Protected>} />
      <Route path="/company" element={<Protected><CompanyPage /></Protected>} />
      <Route path="/enquiries" element={<Protected><EnquiriesPage /></Protected>} />
      <Route path="/media" element={<Protected><MediaPage /></Protected>} />
      <Route path="/users" element={<Protected><SuperOnly><UsersPage /></SuperOnly></Protected>} />
      <Route path="/audit" element={<Protected><AuditPage /></Protected>} />
      <Route path="/settings" element={<Protected><SettingsPage /></Protected>} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
