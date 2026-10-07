import { useState } from 'react';
import { CheckCircleIcon, CopyIcon, WarningCircleIcon } from '@phosphor-icons/react';

import { getPaymentProvider, testPaymentProvider } from '../../api/admin';
import Button from '../../components/Button';
import useAction from '../../hooks/useAction';
import useResource from '../../hooks/useResource';

const MODE_LABEL = {
  fake: 'Fake (development, no money moves)',
  test: 'PayMongo test mode',
  live: 'PayMongo LIVE',
  unknown: 'PayMongo (unrecognised key)',
};

function Check({ ok, children }) {
  const Icon = ok ? CheckCircleIcon : WarningCircleIcon;
  return (
    <li className="flex items-start gap-2">
      <Icon size={16} className={ok ? 'text-accent-300 mt-0.5' : 'text-danger-300 mt-0.5'} aria-hidden="true" />
      <span>{children}</span>
    </li>
  );
}

export default function PaymentProviderCard() {
  const { data: status, loading, error, refetch } = useResource(getPaymentProvider);
  const test = useAction(testPaymentProvider);
  const [copied, setCopied] = useState(false);
  const [result, setResult] = useState(null);

  const runTest = async () => {
    setResult(null);
    const outcome = await test.run();
    if (outcome.ok) setResult(outcome.data.result);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(status.webhookUrl);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className="border-surface-700 bg-surface-900 flex max-w-2xl flex-col gap-4 rounded-xl border p-5" aria-labelledby="paymongo-heading">
      <div>
        <h2 id="paymongo-heading" className="text-sm font-semibold tracking-tight">
          Online payments (PayMongo)
        </h2>
        <p className="text-ink-500 text-xs">Keys are kept in the server&apos;s backend/.env file, never in the browser.</p>
      </div>

      {loading && !status ? (
        <div className="bg-surface-800 h-24 animate-pulse rounded-xl" aria-busy="true" />
      ) : error ? (
        <div role="alert" className="flex items-center gap-3">
          <p className="text-danger-300 text-sm">{error.message}</p>
          <Button variant="secondary" size="sm" onClick={refetch}>
            Retry
          </Button>
        </div>
      ) : status ? (
        <>
          <ul className="flex flex-col gap-1.5 text-sm">
            <Check ok={status.provider === 'paymongo'}>Provider: {MODE_LABEL[status.mode]}</Check>
            <Check ok={status.secretKeySet}>Secret key {status.secretKeySet ? 'set' : 'missing'} (PAYMONGO_SECRET_KEY)</Check>
            <Check ok={status.webhookSecretSet}>
              Webhook signing secret {status.webhookSecretSet ? 'set' : 'missing'} (PAYMONGO_WEBHOOK_SECRET)
            </Check>
            <Check ok={!status.webhookUrlIsLocal}>
              {status.webhookUrlIsLocal
                ? 'API_PUBLIC_URL is localhost, which PayMongo cannot reach. Use a public URL or a tunnel.'
                : 'API_PUBLIC_URL is public'}
            </Check>
          </ul>

          <div>
            <p className="text-ink-400 text-xs">Webhook URL to register in PayMongo (event: {status.webhookEvent})</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <code className="bg-surface-800 text-ink-100 rounded-xl px-3 py-1.5 text-xs break-all">{status.webhookUrl}</code>
              <Button variant="ghost" size="sm" onClick={copy} aria-label="Copy webhook URL">
                <CopyIcon size={14} aria-hidden="true" />
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm" variant="secondary" onClick={runTest} disabled={test.loading}>
              {test.loading ? 'Testing…' : 'Test connection'}
            </Button>
            {test.error ? <span className="text-danger-300 text-sm">{test.error.message}</span> : null}
          </div>
          {result ? (
            <p role="status" className={`text-sm ${result.ok ? 'text-accent-300' : 'text-danger-300'}`}>
              {result.message}
            </p>
          ) : null}

          <details className="text-ink-400 text-xs">
            <summary className="text-ink-100 cursor-pointer text-sm">How to connect PayMongo</summary>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>PayMongo dashboard → Developers → API keys: copy the secret key (sk_test_… while testing).</li>
              <li>Developers → Webhooks → Create: paste the webhook URL above, select {status.webhookEvent}, save, and copy its signing secret.</li>
              <li>
                In backend/.env set PAYMENT_PROVIDER=paymongo, PAYMONGO_SECRET_KEY, PAYMONGO_WEBHOOK_SECRET, API_PUBLIC_URL and
                APP_BASE_URL, then restart the API.
              </li>
              <li>Come back here and press Test connection.</li>
            </ol>
          </details>
        </>
      ) : null}
    </section>
  );
}
