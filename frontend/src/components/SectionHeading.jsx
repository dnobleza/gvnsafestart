// Headline plus optional body, stacked. Deliberately not a left-headline /
// right-floating-paragraph split: that pattern reads as a template.
export default function SectionHeading({ title, body, className = '' }) {
  return (
    <div className={className}>
      <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{title}</h2>
      {body ? (
        <p className="text-ink-400 mt-4 max-w-[60ch] text-base leading-relaxed">{body}</p>
      ) : null}
    </div>
  );
}
