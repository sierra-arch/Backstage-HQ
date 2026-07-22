// Modal.tsx - Unified Reusable Modal Component for Backstage HQ
import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;

  title: string;
  subtitle?: string;

  size?: "small" | "medium" | "large";
  children: React.ReactNode;

  // ✅ Optional enhancements (used by some parts of the refactor)
  coverImage?: string;              // shows a header image (like Task cover)
  hideCloseButton?: boolean;        // rare, but sometimes useful
  disableBackdropClose?: boolean;   // prevent accidental close
  className?: string;              // extra wrapper classes if needed
}

/**
 * Named export (so `import { Modal } from "./Modal"` works)
 */
export function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  size = "medium",
  children,
  coverImage,
  hideCloseButton = false,
  disableBackdropClose = false,
  className = "",
}: ModalProps) {
  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) onClose();
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev || "unset";
    };
  }, [isOpen]);

  const sizeClasses: Record<NonNullable<ModalProps["size"]>, string> = {
    small: "max-w-md",
    medium: "max-w-2xl",
    large: "max-w-4xl",
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              if (!disableBackdropClose) onClose();
            }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          />

          {/* Modal Container */}
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 18 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 18 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                onClick={(e) => e.stopPropagation()}
                className={`relative w-full ${sizeClasses[size]} bg-white rounded-2xl shadow-2xl overflow-hidden ${className}`}
              >
                {/* Optional cover image */}
                {coverImage && (
                  <div
                    className="h-48 bg-cover bg-center"
                    style={{ backgroundImage: `url(${coverImage})` }}
                  />
                )}

                {/* Header (sticky keeps title visible on long content) */}
                <div className="sticky top-0 bg-white/95 backdrop-blur border-b px-6 py-4 flex items-start justify-between gap-4 z-10">
                  <div className="min-w-0">
                    <h2 className="text-xl font-semibold text-neutral-900 truncate">
                      {title}
                    </h2>
                    {subtitle && (
                      <p className="text-sm text-neutral-500 mt-0.5">
                        {subtitle}
                      </p>
                    )}
                  </div>

                  {!hideCloseButton && (
                    <button
                      onClick={onClose}
                      className="p-2 rounded-lg hover:bg-neutral-100 transition-colors"
                      aria-label="Close modal"
                    >
                      <svg
                        className="w-5 h-5 text-neutral-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  )}
                </div>

                {/* Content */}
                <div className="px-6 py-4">{children}</div>
              </motion.div>
            </div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

/**
 * Default export (so `import Modal from "./Modal"` works)
 */
export default Modal;

/**
 * Optional: simpler version without framer-motion if needed
 */
export function SimpleModal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  hideCloseButton = false,
  disableBackdropClose = false,
  className = "",
}: Omit<ModalProps, "size" | "coverImage">) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => {
          if (!disableBackdropClose) onClose();
        }}
      />
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className={`relative bg-white rounded-2xl shadow-xl max-w-2xl w-full overflow-hidden ${className}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="sticky top-0 bg-white/95 backdrop-blur border-b px-6 py-4 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-xl font-semibold text-neutral-900 truncate">
                {title}
              </h2>
              {subtitle && (
                <p className="text-sm text-neutral-500 mt-0.5">{subtitle}</p>
              )}
            </div>
            {!hideCloseButton && (
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-neutral-100"
                aria-label="Close modal"
              >
                ×
              </button>
            )}
          </div>

          <div className="px-6 py-4">{children}</div>
        </div>
      </div>
    </div>
  );
}
