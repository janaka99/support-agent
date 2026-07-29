import { ReactNode, useEffect } from "react";
import { Card } from "./card";

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
}

export function Dialog({ isOpen, onClose, title, description, children }: DialogProps) {
  // Prevent scrolling when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />
      <Card className="relative w-full max-w-lg p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="mb-6">
          <h2 className="text-xl font-semibold tracking-tight text-[--text-primary]">{title}</h2>
          {description && <p className="text-sm text-[--text-muted] mt-1.5">{description}</p>}
        </div>
        {children}
      </Card>
    </div>
  );
}
