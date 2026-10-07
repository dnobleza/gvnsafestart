import Button from '../components/Button';
import Container from '../components/Container';
import useSignOut from '../features/auth/hooks/useSignOut';

export default function NotAuthorizedPage() {
  const { signOut, signingOut } = useSignOut();

  return (
    <main className="flex min-h-[100dvh] items-center py-16">
      <Container className="max-w-md text-center">
        <p className="text-ink-500 font-mono text-sm">403</p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">You do not have access to this page</h1>
        <p className="text-ink-400 mt-4 leading-relaxed">
          Your account does not have permission for this area. If you think it should, ask an admin.
        </p>
        <div className="mt-8 flex flex-col gap-3">
          <Button to="/">Back to home</Button>
          <Button variant="ghost" onClick={signOut} disabled={signingOut}>
            {signingOut ? 'Signing out…' : 'Sign out'}
          </Button>
        </div>
      </Container>
    </main>
  );
}
