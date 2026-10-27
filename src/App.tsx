import React, { useEffect } from 'react';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import { RoleProtectedRoute } from './components/Layout';
import { AuthProvider } from './context/AuthContext';
import {
  AdminDashboardPage,
  HelpFaqPage,
  PrivacyPolicyPage,
  TermsPage,
} from './pages/AdminAndDocsPages';
import {
  BatchSuccessPage,
  FarmerDashboardPage,
  FarmerPriceHistoryPage,
  QrLabelPrintPage,
  RegisterProducePage,
} from './pages/FarmerPages';
import {
  ForgotPasswordPage,
  LandingPage,
  LoginPage,
  RegisterPage,
  RoleSelectionPage,
} from './pages/LandingAndAuthPages';
import {
  NotificationCentrePage,
  PaymentPage,
  PaymentReceiptPage,
  ProfileSettingsPage,
  SubscriptionPage,
} from './pages/PaymentAndAccountPages';
import {
  ConsumerDashboardPage,
  PartnerDashboardPage,
  RetailerDashboardPage,
  TransporterDashboardPage,
  WholesalerDashboardPage,
} from './pages/RoleDashboards';
import {
  BatchDetailsPage,
  FreshnessDetailsPage,
  InvalidQrPage,
  PublicTrackingPage,
  QrScannerPage,
  TrackingHistoryPage,
} from './pages/TrackingAndScannerPages';

const ScrollToTop: React.FC = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
};

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(err: Error): ErrorBoundaryState {
    return { hasError: true, message: err.message || 'Unexpected error occurred.' };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#F1FAF0] p-6">
          <div className="max-w-md w-full bg-white border border-[#E5E7EB] rounded-2xl p-6 space-y-4 text-center">
            <h1 className="text-xl font-bold text-[#18261E] font-display">
              Something went wrong
            </h1>
            <p className="text-sm text-[#4B5563]">{this.state.message}</p>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, message: '' });
                window.location.href = '/';
              }}
              className="px-4 py-2.5 rounded-xl bg-[#36A853] text-white text-sm font-semibold cursor-pointer"
            >
              Reload TraceRoots
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <AppErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <ScrollToTop />
          <Routes>
            {/* Public Marketing, Auth, Legal & Consumer QR Routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/roles" element={<RoleSelectionPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/track/:token" element={<PublicTrackingPage />} />
            <Route path="/scan" element={<QrScannerPage />} />
            <Route path="/freshness" element={<FreshnessDetailsPage />} />
            <Route path="/payment" element={<PaymentPage />} />
            <Route path="/payment/receipt/:paymentId" element={<PaymentReceiptPage />} />
            <Route path="/help" element={<HelpFaqPage />} />
            <Route path="/privacy" element={<PrivacyPolicyPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/invalid-qr" element={<InvalidQrPage />} />

            {/* Farmer Protected Routes */}
            <Route
              path="/farmer"
              element={
                <RoleProtectedRoute allowedRoles={['farmer']}>
                  <FarmerDashboardPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/farmer/register-produce"
              element={
                <RoleProtectedRoute allowedRoles={['farmer']}>
                  <RegisterProducePage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/farmer/batch-success/:batchId"
              element={
                <RoleProtectedRoute allowedRoles={['farmer', 'admin']}>
                  <BatchSuccessPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/farmer/qr-label/:batchId"
              element={
                <RoleProtectedRoute allowedRoles={['farmer', 'admin']}>
                  <QrLabelPrintPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/farmer/price-history"
              element={
                <RoleProtectedRoute allowedRoles={['farmer', 'admin']}>
                  <FarmerPriceHistoryPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/subscription"
              element={
                <RoleProtectedRoute allowedRoles={['farmer']}>
                  <SubscriptionPage />
                </RoleProtectedRoute>
              }
            />

            {/* Other Supply-Chain Role Dashboards */}
            <Route
              path="/wholesaler"
              element={
                <RoleProtectedRoute allowedRoles={['wholesaler']}>
                  <WholesalerDashboardPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/retailer"
              element={
                <RoleProtectedRoute allowedRoles={['retailer']}>
                  <RetailerDashboardPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/consumer"
              element={
                <RoleProtectedRoute allowedRoles={['consumer']}>
                  <ConsumerDashboardPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/transporter"
              element={
                <RoleProtectedRoute allowedRoles={['transporter']}>
                  <TransporterDashboardPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/partner"
              element={
                <RoleProtectedRoute allowedRoles={['partner']}>
                  <PartnerDashboardPage />
                </RoleProtectedRoute>
              }
            />

            {/* Shared Authenticated Workspace Routes */}
            <Route
              path="/batches/:batchId"
              element={
                <RoleProtectedRoute
                  allowedRoles={[
                    'farmer',
                    'wholesaler',
                    'retailer',
                    'transporter',
                    'partner',
                    'consumer',
                    'admin',
                  ]}
                >
                  <BatchDetailsPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/history"
              element={
                <RoleProtectedRoute
                  allowedRoles={[
                    'farmer',
                    'wholesaler',
                    'retailer',
                    'transporter',
                    'partner',
                    'consumer',
                    'admin',
                  ]}
                >
                  <TrackingHistoryPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/notifications"
              element={
                <RoleProtectedRoute
                  allowedRoles={[
                    'farmer',
                    'wholesaler',
                    'retailer',
                    'transporter',
                    'partner',
                    'consumer',
                    'admin',
                  ]}
                >
                  <NotificationCentrePage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <RoleProtectedRoute
                  allowedRoles={[
                    'farmer',
                    'wholesaler',
                    'retailer',
                    'transporter',
                    'partner',
                    'consumer',
                    'admin',
                  ]}
                >
                  <ProfileSettingsPage />
                </RoleProtectedRoute>
              }
            />

            {/* Protected Administrator Console */}
            <Route
              path="/admin"
              element={
                <RoleProtectedRoute allowedRoles={['admin']}>
                  <AdminDashboardPage />
                </RoleProtectedRoute>
              }
            />

            {/* Fallback Unknown Route -> Invalid QR / Not Found */}
            <Route path="*" element={<InvalidQrPage />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </AppErrorBoundary>
  );
}
