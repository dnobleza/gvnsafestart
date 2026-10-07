import { Link } from 'react-router-dom';

const BASE =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium ' +
  'transition-[transform,background-color,border-color,color] duration-200 active:scale-[0.98] ' +
  'disabled:pointer-events-none disabled:opacity-50';

// White on gold measures about 2.2:1, so the gold button takes a near-black
// label. Every pairing here is checked against the dark surface it sits on.
const VARIANTS = {
  primary: 'bg-accent-500 text-surface-950 hover:bg-accent-400',
  secondary:
    'border border-surface-600 bg-surface-900 text-ink-100 hover:border-accent-600 hover:text-accent-300',
  ghost: 'text-ink-100 hover:bg-surface-800 hover:text-accent-300',
  // Sits on photography or the dark sweep, so it holds one appearance.
  onMedia: 'bg-accent-500 text-surface-950 hover:bg-accent-400',
  outlineOnMedia: 'border border-accent-500/70 text-accent-300 hover:bg-accent-500/15',
  danger: 'border border-danger-500/70 text-danger-300 hover:bg-danger-500/15',
};

const SIZES = {
  sm: 'h-8 px-3.5 text-xs',
  md: 'h-10 px-5',
  lg: 'h-12 px-7 text-base',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  to,
  href,
  className = '',
  children,
  ...rest
}) {
  const classes = `${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${className}`;

  if (to) {
    return (
      <Link to={to} className={classes} {...rest}>
        {children}
      </Link>
    );
  }

  if (href) {
    return (
      <a href={href} className={classes} {...rest}>
        {children}
      </a>
    );
  }

  return (
    <button type="button" className={classes} {...rest}>
      {children}
    </button>
  );
}
