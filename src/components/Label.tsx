import React from 'react';

const Label = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <label className={`text-xs font-bold uppercase tracking-wider text-muted-foreground ${className}`}>
    {children}
  </label>
);

export default Label;
