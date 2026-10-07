import { Link, Navigate } from 'react-router-dom';

import AuthLayout from '../components/AuthLayout';
import RegisterForm from '../features/auth/RegisterForm';
import useReturnTo from '../features/auth/hooks/useReturnTo';
import { useAuthStore } from '../store/authStore';

export default function RegisterPage() {
  const status = useAuthStore((state) => state.status);
  const role = useAuthStore((state) => state.user?.role);
  const { from, returnTo } = useReturnTo(role);

  if (status === 'authenticated') return <Navigate to={returnTo} replace />;

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Register once, then book lessons whenever you need them."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" state={{ from }} className="text-accent-300 hover:text-accent-200 font-medium">
            Log in
          </Link>
        </>
      }
    >
      <RegisterForm />
    </AuthLayout>
  );
}
