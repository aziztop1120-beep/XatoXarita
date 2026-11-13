import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Loader from './components/Loader.jsx';
import Layout from './components/Layout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import TeacherRoute from './components/TeacherRoute.jsx';
import Home from './pages/Home.jsx';
import Register from './pages/Register.jsx';
import Login from './pages/Login.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import UpdatePassword from './pages/UpdatePassword.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Tests from './pages/Tests.jsx';
import ErrorMap from './pages/ErrorMap.jsx';
import Topics from './pages/Topics.jsx';
import Results from './pages/Results.jsx';
import Profile from './pages/Profile.jsx';
import NotFound from './pages/NotFound.jsx';

// Ustoz paneli alohida bo'lak (chunk) sifatida yuklanadi — o'quvchilar saytining hajmiga ta'sir qilmaydi
const AdminShell = lazy(() => import('./pages/admin/AdminShell.jsx'));
const Overview = lazy(() => import('./pages/admin/Overview.jsx'));
const Students = lazy(() => import('./pages/admin/Students.jsx'));
const StudentDetail = lazy(() => import('./pages/admin/StudentDetail.jsx'));
const AdminResults = lazy(() => import('./pages/admin/Results.jsx'));
const Progress = lazy(() => import('./pages/admin/Progress.jsx'));
const Integrity = lazy(() => import('./pages/admin/Integrity.jsx'));
const Live = lazy(() => import('./pages/admin/Live.jsx'));
const Errors = lazy(() => import('./pages/admin/Errors.jsx'));
const Reports = lazy(() => import('./pages/admin/Reports.jsx'));

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/update-password" element={<UpdatePassword />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/tests" element={<Tests />} />
          <Route path="/error-map" element={<ErrorMap />} />
          <Route path="/topics" element={<Topics />} />
          <Route path="/results" element={<Results />} />
          <Route path="/profile" element={<Profile />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Route>
      <Route element={<ProtectedRoute />}>
        <Route element={<TeacherRoute />}>
          <Route path="/admin" element={<Suspense fallback={<Loader full />}><AdminShell /></Suspense>}>
            <Route index element={<Suspense fallback={<Loader />}><Overview /></Suspense>} />
            <Route path="students" element={<Suspense fallback={<Loader />}><Students /></Suspense>} />
            <Route path="students/:id" element={<Suspense fallback={<Loader />}><StudentDetail /></Suspense>} />
            <Route path="results" element={<Suspense fallback={<Loader />}><AdminResults /></Suspense>} />
            <Route path="progress" element={<Suspense fallback={<Loader />}><Progress /></Suspense>} />
            <Route path="integrity" element={<Suspense fallback={<Loader />}><Integrity /></Suspense>} />
            <Route path="live" element={<Suspense fallback={<Loader />}><Live /></Suspense>} />
            <Route path="errors" element={<Suspense fallback={<Loader />}><Errors /></Suspense>} />
            <Route path="reports" element={<Suspense fallback={<Loader />}><Reports /></Suspense>} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  );
}
