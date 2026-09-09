'use client';

import { HTMLAttributes } from 'react';
import clsx from 'clsx';

type Props = HTMLAttributes<HTMLDivElement> & { strong?: boolean };

export default function GlassPanel({ className, strong, children, ...rest }: Props) {
  return (
    <div className={clsx(strong ? 'glass-strong' : 'glass', 'rounded-2xl shadow-glass', className)} {...rest}>
      {children}
    </div>
  );
}
