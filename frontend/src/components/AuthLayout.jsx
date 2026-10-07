import BrandMark from './BrandMark';
import Container from './Container';

export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <main className="flex min-h-[100dvh] items-center py-16">
      <Container className="max-w-md">
        <div className="flex justify-center">
          <BrandMark height={54} />
        </div>
        <div className="border-surface-700 bg-surface-900 mt-10 rounded-xl border px-6 py-8 sm:px-8">
          <h1 className="text-center text-3xl font-semibold tracking-tight">{title}</h1>
          {subtitle ? <p className="text-ink-400 mt-3 text-center leading-relaxed">{subtitle}</p> : null}
          <div className="mt-8">{children}</div>
        </div>
        {footer ? <div className="text-ink-400 mt-6 text-center text-sm">{footer}</div> : null}
      </Container>
    </main>
  );
}
