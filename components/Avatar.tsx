'use client';

import clsx from 'clsx';

export default function Avatar({
  src,
  name,
  size = 40,
  online,
  ring,
}: {
  src: string;
  name: string;
  size?: number;
  online?: boolean;
  ring?: boolean;
}) {
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <img
        src={src}
        alt={name}
        title={name}
        className={clsx(
          'h-full w-full rounded-full border border-white/10 bg-white/5 object-cover',
          ring && 'shadow-neon'
        )}
      />
      {online !== undefined && (
        <span
          className={clsx(
            'absolute bottom-0 right-0 block rounded-full border-2 border-void-950',
            online ? 'bg-emerald-400' : 'bg-white/20'
          )}
          style={{ width: size * 0.28, height: size * 0.28 }}
        />
      )}
    </div>
  );
}
