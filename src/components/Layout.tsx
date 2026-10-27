import React, { useState } from 'react';
import { Link, NavLink, Navigate, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  BookOpen,
  CreditCard,
  FileSpreadsheet,
  HelpCircle,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  PackagePlus,
  QrCode,
  ShieldCheck,
  Sprout,
  Truck,
  UserCheck,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getDashboardPathForRole } from '../lib/api';
import type { UserRole } from '../shared/types';
import { BrandLogoMark } from './BrandLogo';

export const PublicLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const primaryHref = user ? getDashboardPathForRole(user.role) : '/roles';
  const primaryLabel = user ? 'Open Dashboard' : 'Get Started';

  return (
    <div className="min-h-screen flex flex-col bg-white text-[#18261E]">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-[#E5E7EB] no-print">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-8 px-4 sm:px-6 lg:px-8 h-16">
          {/* Zone 1: Single-line Brand Wordmark */}
          <Link
            to="/"
            className="inline-flex items-center gap-2.5 text-lg font-bold tracking-tight text-[#18261E] whitespace-nowrap shrink-0 font-display"
          >
            <BrandLogoMark className="w-8 h-8 shrink-0" />
            <span>TraceRoots</span>
          </Link>

          {/* Zone 2: 5 concise single-line text links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-[#4B5563]">
            <Link
              to="/roles"
              className="hover:text-[#18261E] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Who Are You
            </Link>
            <Link
              to="/scan"
              className="hover:text-[#18261E] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Scan QR
            </Link>
            <Link
              to="/freshness"
              className="hover:text-[#18261E] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Freshness Guide
            </Link>
            <Link
              to="/help"
              className="hover:text-[#18261E] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Help & FAQ
            </Link>
            {!user && (
              <Link
                to="/login"
                className="hover:text-[#18261E] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
              >
                Sign In
              </Link>
            )}
          </nav>

          {/* Zone 3: 1 Primary Action */}
          <div className="flex items-center gap-3 shrink-0">
            <Link
              to={primaryHref}
              className="px-4 py-2 text-sm font-semibold text-white bg-[#36A853] hover:bg-[#2B8A43] rounded-xl transition-colors whitespace-nowrap shrink-0"
            >
              {primaryLabel}
            </Link>
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="Toggle navigation menu"
              className="md:hidden p-2 rounded-lg text-[#4B5563] hover:bg-[#F1FAF0] cursor-pointer"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-[#E5E7EB] bg-white px-4 py-3 space-y-2">
            <Link
              to="/roles"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-sm font-medium text-[#18261E]"
            >
              Who Are You (Role Selection)
            </Link>
            <Link
              to="/scan"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-sm font-medium text-[#18261E]"
            >
              Scan Produce QR
            </Link>
            <Link
              to="/freshness"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-sm font-medium text-[#18261E]"
            >
              Freshness Estimation Guide
            </Link>
            <Link
              to="/help"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-sm font-medium text-[#18261E]"
            >
              Help & FAQ
            </Link>
            {!user && (
              <Link
                to="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="block py-2 text-sm font-medium text-[#36A853]"
              >
                Sign In to Account
              </Link>
            )}
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      {/* Quiet Trustworthy Footer */}
      <footer className="border-t border-[#E5E7EB] bg-[#F1FAF0]/60 py-10 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 font-display font-bold text-[#18261E]">
              <BrandLogoMark className="w-6 h-6" />
              <span>TraceRoots</span>
            </div>
            <p className="mt-1.5 text-sm text-[#4B5563]">
              From Farm to Fork, Every Step Tracked. Transparent QR agricultural traceability.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-[#4B5563]">
            <Link to="/roles" className="hover:text-[#18261E] whitespace-nowrap">
              Register by Role
            </Link>
            <Link to="/scan" className="hover:text-[#18261E] whitespace-nowrap">
              QR Scanner
            </Link>
            <Link to="/freshness" className="hover:text-[#18261E] whitespace-nowrap">
              Freshness Model
            </Link>
            <Link to="/help" className="hover:text-[#18261E] whitespace-nowrap">
              Help & Setup Guide
            </Link>
            <Link to="/privacy" className="hover:text-[#18261E] whitespace-nowrap">
              Privacy Policy
            </Link>
            <Link to="/terms" className="hover:text-[#18261E] whitespace-nowrap">
              Terms & Conditions
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

interface NavItemConfig {
  to: string;
  label: string;
  icon: React.FC<{ className?: string }>;
}

function getSidebarNavForRole(role: UserRole): NavItemConfig[] {
  const baseDashboard = getDashboardPathForRole(role);

  if (role === 'farmer') {
    return [
      { to: '/farmer', label: 'Farmer Dashboard', icon: LayoutDashboard },
      { to: '/farmer/register-produce', label: 'Register Produce', icon: PackagePlus },
      { to: '/history', label: 'Produce & Tracking', icon: History },
      { to: '/farmer/price-history', label: 'Price History', icon: FileSpreadsheet },
      { to: '/subscription', label: 'Monthly Plan (₹100)', icon: CreditCard },
      { to: '/freshness', label: 'Freshness Guide', icon: Sprout },
      { to: '/notifications', label: 'Notifications', icon: Bell },
      { to: '/profile', label: 'Profile & Settings', icon: UserCheck },
      { to: '/help', label: 'Help & Setup', icon: HelpCircle },
    ];
  }

  if (role === 'admin') {
    return [
      { to: '/admin', label: 'Admin Console', icon: ShieldCheck },
      { to: '/history', label: 'All Batches & Search', icon: History },
      { to: '/farmer/price-history', label: 'Global Price Audit', icon: FileSpreadsheet },
      { to: '/scan', label: 'QR Scanner', icon: QrCode },
      { to: '/freshness', label: 'Freshness Engine', icon: Sprout },
      { to: '/notifications', label: 'Notifications', icon: Bell },
      { to: '/profile', label: 'Profile & Settings', icon: UserCheck },
      { to: '/help', label: 'System Docs', icon: BookOpen },
    ];
  }

  if (role === 'consumer') {
    return [
      { to: '/consumer', label: 'Consumer Hub', icon: LayoutDashboard },
      { to: '/scan', label: 'Scan Produce QR', icon: QrCode },
      { to: '/freshness', label: 'Freshness Guide', icon: Sprout },
      { to: '/notifications', label: 'Notifications', icon: Bell },
      { to: '/profile', label: 'Profile & Settings', icon: UserCheck },
      { to: '/help', label: 'Help & FAQ', icon: HelpCircle },
    ];
  }

  // Wholesaler, Retailer, Transporter, Partner
  return [
    { to: baseDashboard, label: 'Role Dashboard', icon: LayoutDashboard },
    { to: '/scan', label: 'Scan Produce QR', icon: QrCode },
    { to: '/history', label: 'Tracking Records', icon: History },
    { to: '/freshness', label: 'Freshness Guide', icon: Truck },
    { to: '/notifications', label: 'Notifications', icon: Bell },
    { to: '/profile', label: 'Profile & Settings', icon: UserCheck },
    { to: '/help', label: 'Help & Setup', icon: HelpCircle },
  ];
}

export const WorkspaceLayout: React.FC<{
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}> = ({ title, subtitle, children }) => {
  const { user, unreadNotifications, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  if (!user) {
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />;
  }

  const navItems = getSidebarNavForRole(user.role);

  const primaryAction =
    user.role === 'farmer'
      ? { to: '/farmer/register-produce', label: 'Register Produce' }
      : { to: '/scan', label: 'Scan Produce QR' };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const roleDisplay: Record<UserRole, string> = {
    farmer: 'Farmer Account',
    wholesaler: 'Wholesaler Account',
    retailer: 'Retailer Account',
    consumer: 'Consumer Account',
    transporter: 'Transporter Account',
    partner: 'Supply Chain Partner',
    admin: 'Platform Administrator',
  };

  return (
    <div className="min-h-screen bg-[#F9FBF9] text-[#18261E] flex">
      {/* Desktop Sidebar (256px) */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-white border-r border-[#E5E7EB] no-print">
        <div className="h-16 px-5 flex items-center border-b border-[#E5E7EB]">
          <Link
            to="/"
            className="inline-flex items-center gap-2.5 text-lg font-bold tracking-tight text-[#18261E] font-display whitespace-nowrap"
          >
            <BrandLogoMark className="w-8 h-8" />
            <span>TraceRoots</span>
          </Link>
        </div>

        <div className="px-5 py-4 border-b border-[#E5E7EB] bg-[#F1FAF0]/50">
          <p className="text-sm font-semibold text-[#18261E] truncate">{user.fullName}</p>
          <p className="text-xs text-[#4B5563] mt-0.5 truncate">
            {roleDisplay[user.role]} · <span className="font-mono">{user.publicCode}</span>
          </p>
          {user.isDemo && (
            <p className="text-[11px] font-medium text-[#B45309] mt-1">
              Demo Sandbox Profile
            </p>
          )}
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isNotif = item.to === '/notifications';
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/farmer' || item.to === '/admin'}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-[#F1FAF0] text-[#1D6F34] font-semibold'
                      : 'text-[#4B5563] hover:bg-gray-50 hover:text-[#18261E]'
                  }`
                }
              >
                <span className="inline-flex items-center gap-2.5 truncate">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </span>
                {isNotif && unreadNotifications > 0 && (
                  <span className="text-xs font-mono font-semibold text-[#1D6F34] tabular-nums">
                    {unreadNotifications}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="p-3 border-t border-[#E5E7EB]">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-[#4B5563] hover:bg-red-50 hover:text-red-700 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Workspace Header */}
        <header className="sticky top-0 z-30 h-14 sm:h-16 bg-white/95 backdrop-blur border-b border-[#E5E7EB] px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4 no-print">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open menu"
              className="lg:hidden p-2 rounded-lg text-[#4B5563] hover:bg-[#F1FAF0] cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs text-[#6B7280] truncate">
                <span>Workspace</span>
                <span aria-hidden="true">/</span>
                <span className="truncate">{roleDisplay[user.role]}</span>
              </div>
              <h1 className="text-base sm:text-lg font-bold text-[#18261E] truncate font-display">
                {title}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Link
              to="/notifications"
              aria-label="Notifications"
              className="relative p-2 rounded-xl border border-[#E5E7EB] text-[#4B5563] hover:text-[#18261E] hover:bg-[#F1FAF0]/60 transition-colors"
            >
              <Bell className="w-4 h-4" />
              {unreadNotifications > 0 && (
                <span className="ml-1 text-xs font-mono font-semibold text-[#36A853] tabular-nums">
                  {unreadNotifications}
                </span>
              )}
            </Link>
            <Link
              to={primaryAction.to}
              className="px-3.5 py-2 rounded-xl bg-[#36A853] hover:bg-[#2B8A43] text-white text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0"
            >
              {primaryAction.label}
            </Link>
          </div>
        </header>

        {/* Mobile Slide-out Sidebar */}
        {drawerOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex no-print">
            <div
              className="fixed inset-0 bg-black/30"
              onClick={() => setDrawerOpen(false)}
              aria-hidden="true"
            />
            <div className="relative w-72 max-w-[82vw] bg-white h-full flex flex-col border-r border-[#E5E7EB] z-10">
              <div className="h-14 px-4 flex items-center justify-between border-b border-[#E5E7EB]">
                <Link
                  to="/"
                  onClick={() => setDrawerOpen(false)}
                  className="inline-flex items-center gap-2 font-display font-bold text-[#18261E]"
                >
                  <BrandLogoMark className="w-7 h-7" />
                  <span>TraceRoots</span>
                </Link>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="p-1.5 rounded-lg text-[#4B5563]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="px-4 py-3 border-b border-[#E5E7EB] bg-[#F1FAF0]/50">
                <p className="text-sm font-semibold text-[#18261E]">{user.fullName}</p>
                <p className="text-xs text-[#4B5563]">
                  {roleDisplay[user.role]} · {user.publicCode}
                </p>
              </div>
              <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={() => setDrawerOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium ${
                          isActive
                            ? 'bg-[#F1FAF0] text-[#1D6F34] font-semibold'
                            : 'text-[#4B5563]'
                        }`
                      }
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span>{item.label}</span>
                    </NavLink>
                  );
                })}
              </nav>
              <div className="p-3 border-t border-[#E5E7EB]">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-red-700 hover:bg-red-50"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          </div>
        )}

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {subtitle && (
            <p className="text-sm text-[#4B5563] mb-6 no-print">{subtitle}</p>
          )}
          {children}
        </main>
      </div>
    </div>
  );
};

export const RoleProtectedRoute: React.FC<{
  allowedRoles: UserRole[];
  children: React.ReactNode;
}> = ({ allowedRoles, children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-sm font-medium text-[#4B5563]">Loading TraceRoots workspace...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    return (
      <WorkspaceLayout title="Restricted Role Access">
        <div className="max-w-xl bg-white border border-[#E5E7EB] rounded-2xl p-6 space-y-4">
          <h2 className="text-lg font-bold text-[#18261E]">
            Access Restricted for Role: {user.role}
          </h2>
          <p className="text-sm text-[#4B5563]">
            Your signed-in account does not have permission to view this dashboard. Role-based access control is enforced both in the interface and on the server.
          </p>
          <div className="pt-2">
            <Link
              to={getDashboardPathForRole(user.role)}
              className="inline-flex items-center px-4 py-2.5 rounded-xl bg-[#36A853] text-white text-sm font-semibold hover:bg-[#2B8A43]"
            >
              Return to My Dashboard
            </Link>
          </div>
        </div>
      </WorkspaceLayout>
    );
  }

  return <>{children}</>;
};
