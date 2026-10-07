import Button from '../components/Button';
import Container from '../components/Container';

export default function NotFoundPage() {
  return (
    <main className="flex min-h-[100dvh] items-center py-16">
      <Container className="max-w-md text-center">
        <p className="text-ink-500 font-mono text-sm">404</p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">We cannot find that page</h1>
        <p className="text-ink-400 mt-4 leading-relaxed">
          The link may be out of date, or the page may have moved.
        </p>
        <Button to="/" className="mt-8">
          Back to home
        </Button>
      </Container>
    </main>
  );
}
