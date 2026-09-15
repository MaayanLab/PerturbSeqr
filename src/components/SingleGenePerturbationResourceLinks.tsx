import Image from 'next/image';

const resources = [
  { name: 'Harmonizome', base: 'https://maayanlab.cloud/Harmonizome/gene/', icon: '/images/harmonizome_logo_30x26.png' },
  { name: 'ARCHS4', base: 'https://archs4.org/gene/', icon: '/images/archs4-icon.png' },
  { name: 'GDLPA', base: 'https://cfde-gene-pages.cloud/gene/', icon: '/images/gdlpa-logo.png' },
  { name: 'GSFM', base: 'https://gsfm.maayanlab.cloud/gene/', icon: '/images/gsfm-icon.svg' },
];

export default function SingleGenePerturbationResourceLinks({ perturbation }: { perturbation?: string | null }) {
  const symbol = perturbation?.trim().toUpperCase();
  // Raw single-gene targets only; excludes combinations and mutation-qualified labels.
  if (!symbol || !/^[A-Z][A-Z0-9.-]*$/.test(symbol)) return null;

  return (
    <span className="inline-flex min-w-max shrink-0 items-center gap-1.5">
      {resources.map(({ name, base, icon }) => (
        <a
          key={name}
          href={`${base}${encodeURIComponent(symbol)}`}
          target="_blank"
          rel="noopener noreferrer"
          title={`View ${symbol} on ${name}`}
          aria-label={`View ${symbol} on ${name}`}
        >
          <Image
            src={icon}
            width={20}
            height={20}
            alt={name}
            className={`h-5 w-5 object-contain${name === 'GDLPA' ? ' rounded bg-slate-700 p-0.5' : ''}`}
          />
        </a>
      ))}
    </span>
  );
}
