import React from 'react';
import { Trash2, X } from 'lucide-react';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  title: string;
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  title,
  isDeleting,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-modal-title"
    >
      <div className="relative w-full max-w-md bg-[#1c1c20] border border-[rgba(255,255,255,0.08)] rounded-[18px] shadow-2xl overflow-hidden p-6 space-y-4 animate-modal-enter text-[#f5f5f7]">
        <div className="flex items-start justify-between">
          <div>
            <h3 id="delete-modal-title" className="text-[17px] font-semibold text-[#f5f5f7] tracking-tight">
              Delete Reflection
            </h3>
            <p className="text-[12.5px] text-[#86868b] mt-0.5">
              This action cannot be undone.
            </p>
          </div>
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="p-1 text-[#86868b] hover:text-[#f5f5f7] rounded-[6px] transition-colors cursor-pointer disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-[13.5px] text-[#86868b] leading-relaxed">
          Are you sure you want to permanently delete{' '}
          <span className="text-[#f5f5f7] font-medium">&ldquo;{title || 'Untitled Entry'}&rdquo;</span>?
          The journal entry and its conversations will be permanently removed.
        </p>

        <div className="flex items-center justify-end space-x-2.5 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="h-8 px-3.5 text-[13px] text-[#86868b] hover:text-[#f5f5f7] bg-[#242428] hover:bg-[#2c2c32] rounded-[8px] transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            id="confirm-delete-btn"
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="h-8 px-4 text-[13px] font-medium text-white bg-[#ff453a] hover:bg-[#d93a30] rounded-[8px] transition-colors cursor-pointer disabled:opacity-50 flex items-center space-x-1.5 btn-press shadow-xs"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{isDeleting ? 'Deleting...' : 'Delete'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
