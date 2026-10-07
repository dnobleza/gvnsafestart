import { useState } from 'react';
import { CheckIcon, CopyIcon, WarningIcon } from '@phosphor-icons/react';

import Button from '../../components/Button';
import Modal from '../../components/Modal';

// The API returns a temporary password exactly once and keeps only its hash, so
// this is the admin's only chance to see it. It lives in the parent's state
// until this closes and is never written anywhere else.
export default function TemporaryPasswordDialog({ reveal, onClose }) {
  const [copied, setCopied] = useState(false);

  if (!reveal) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(reveal.password);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const close = () => {
    setCopied(false);
    onClose();
  };

  return (
    <Modal
      open
      title={reveal.title}
      onClose={close}
      footer={<Button onClick={close}>I have saved it</Button>}
    >
      <p className="text-ink-400 text-sm">
        Give this temporary password to <span className="text-ink-100">{reveal.name}</span> ({reveal.email}). They
        will be asked to choose their own the first time they sign in.
      </p>
      <div className="border-surface-600 bg-surface-950 mt-4 flex items-center gap-2 rounded-xl border p-2 pl-4">
        <code className="text-accent-300 flex-1 font-mono text-base break-all" aria-label="Temporary password">
          {reveal.password}
        </code>
        <Button variant="secondary" size="sm" onClick={copy}>
          {copied ? <CheckIcon size={14} aria-hidden="true" /> : <CopyIcon size={14} aria-hidden="true" />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      <p className="text-danger-300 mt-4 flex items-start gap-2 text-sm">
        <WarningIcon size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
        This password will not be shown again.
      </p>
    </Modal>
  );
}
