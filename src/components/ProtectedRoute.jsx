// import React from 'react';
// import { Navigate, Outlet } from 'react-router-dom';
// import useAuthStore from '../hooks/useAuth';
// import PageLoader from '../pages/PageLoader';

// export default function ProtectedRoute() {
//   const { user, profile, loading } = useAuthStore();

//   if (loading) return <PageLoader />;
//   if (!user)   return <Navigate to="/login" replace />;

//   // BUG FIX: Block invited users from accessing the dashboard before they complete
//   // setup on /accept-invite. Without this, clicking an invite link auto-signs the
//   // user in (Supabase magic link) and ProtectedRoute lets them through even though
//   // their account_status is still 'invited' and they haven't set a password yet.
//   if (profile?.account_status === 'invited') {
//     return <Navigate to="/accept-invite" replace />;
//   }

//   // Block disabled users from accessing the app.
//   // is_active: false is the existing disable mechanism; account_status: 'disabled'
//   // is the new one added alongside it. Check both for safety.
//   if (profile?.is_active === false || profile?.account_status === 'disabled') {
//     return <Navigate to="/login" replace />;
//   }

//   return <Outlet />;
// }
import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';

export default function ProtectedRoute() {
  const token = localStorage.getItem("token");

  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}