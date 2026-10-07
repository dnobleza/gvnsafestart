import { Link, Navigate } from 'react-router-dom';

import AuthLayout from '../components/AuthLayout';
import LoginForm from '../features/auth/LoginForm';
import useReturnTo from '../features/auth/hooks/useReturnTo';
import { useAuthStore } from '../store/authStore';

export default function LoginPage() {
  const status = useAuthStore((state) => state.status);
  const role = useAuthStore((state) => state.user?.role);
  const mustChangePassword = useAuthStore((state) => state.user?.mustChangePassword);
  const { from, returnTo } = useReturnTo(role);

  if (status === 'authenticated' && mustChangePassword) {
    return <Navigate to="/change-password" replace state={{ from: from ?? { pathname: returnTo } }} />;
  }
  if (status === 'authenticated') return <Navigate to={returnTo} replace />;

  return (
    <AuthLayout
      title="Log in"
      subtitle="Sign in to book and manage your driving lessons."
      footer={
        <>
          Don&apos;t have an account?{' '}
          <Link to="/register" state={{ from }} className="text-accent-300 hover:text-accent-200 font-medium">
            Register
          </Link>
        </>
      }
    >
      <LoginForm />
    </AuthLayout>
  );
}
