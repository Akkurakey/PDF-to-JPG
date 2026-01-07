
import React from 'react';
import { FileText, Image as ImageIcon, X, GripVertical } from 'lucide-react';
import { ManagedFile, FileType } from '../types';

interface FileCardProps {
  file: ManagedFile;
  onRemove: (id: string) => void;
}

const FileCard: React.FC<FileCardProps> = ({ file, onRemove }) => {
  const isPdf = file.type === FileType.PDF;

  return (
    <div className="flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow group">
      <div className="text-gray-400 cursor-grab active:cursor-grabbing">
        <GripVertical size={20} />
      </div>
      
      <div className="w-12 h-12 flex-shrink-0 bg-gray-50 rounded-lg overflow-hidden flex items-center justify-center border border-gray-100">
        {isPdf ? (
          <FileText className="text-red-500" size={24} />
        ) : (
          <img 
            src={file.previewUrl} 
            alt={file.name} 
            className="w-full h-full object-cover"
          />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
        <p className="text-xs text-gray-500">
          {(file.size / (1024 * 1024)).toFixed(2)} MB • {file.type.split('/')[1].toUpperCase()}
        </p>
      </div>

      <button 
        onClick={() => onRemove(file.id)}
        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors opacity-0 group-hover:opacity-100"
      >
        <X size={18} />
      </button>
    </div>
  );
};

export default FileCard;
