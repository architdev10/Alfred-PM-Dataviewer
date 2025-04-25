import React from 'react';
import { cn } from '@/lib/utils';

interface ScrollContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  children: React.ReactNode;
  maxHeight?: string;
}

/**
 * A custom scroll container component that handles overflow properly
 * and prevents scroll bounce issues across the application.
 */
export function ScrollContainer({
  className,
  children,
  maxHeight = 'calc(100vh - 220px)',
  ...props
}: ScrollContainerProps) {
  return (
    <div
      className={cn(
        'overflow-y-auto overscroll-none',
        className
      )}
      style={{
        maxHeight,
        scrollBehavior: 'smooth',
        WebkitOverflowScrolling: 'touch',
      }}
      {...props}
    >
      <div className="p-4 h-fit">
        {children}
      </div>
    </div>
  );
}
