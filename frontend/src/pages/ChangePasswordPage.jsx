import { useNavigate } from 'react-router-dom';

import AuthLayout from '../components/AuthLayout';
import ChangePasswordForm from '../features/auth/ChangePasswordForm';
import useReturnTo from '../features/auth/hooks/useReturnTo';
import { useAuthStore } from '../store/authStore';

export default function ChangePasswordPage() {
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();
  const { returnTo } = useReturnTo(user?.role);
  const forced = Boolean(user?.mustChangePassword);

  return (
    <AuthLayout
      title={forced ? 'Set a new password' : 'Change password'}
      subtitle={
        forced
          ? 'Your account was set up with a temporary password. Choose your own to continue.'
          : 'Enter your current password and choose a new one.'
      }
    >
      <ChangePasswordForm onSuccess={() => navigate(returnTo, { replace: true })} />
    </AuthLayout>
  );
}
