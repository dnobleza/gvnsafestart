import { CircleNotchIcon } from '@phosphor-icons/react';

import Button from './Button';

export default function SubmitButton({ loading, loadingLabel, children, ...rest }) {
  return (
    <Button type="submit" size="lg" disabled={loading} aria-busy={loading || undefined} {...rest}>
      {loading ? (
        <>
          <CircleNotchIcon size={18} className="animate-spin" aria-hidden="true" />
          {loadingLabel}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
