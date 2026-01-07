import React, { useState, useCallback, useRef } from 'react';
import { 
  Upload, 
  Files, 
  FileImage, 
  FileText, 
  Download, 
  Trash2, 
  ArrowRightLeft,
  Loader2,
  AlertCircle,
  Plus
} from 'lucide-react';
import { ManagedFile, FileType, ProcessingStatus } from './types';
import FileCard from './components/FileCard';
import { imagesToPdf, mergePdfs, pdfToImages, downloadBlob, createZipFromImages } from './services/pdfTools';

const App: React.FC = () => {
  const [files, setFiles] = useState<ManagedFile[]>([]);
  const [status, setStatus] = useState<ProcessingStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).map((file: File) => {
        const type = file.type as FileType;
        return {
          id: Math.random().toString(36).substring(2, 11),
          file,
          name: file.name,
          size: file.size,
          type,
          previewUrl: URL.createObjectURL(file)
        };
      });
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (id: string) => {
    setFiles(prev => {
      const filtered = prev.filter(f => f.id !== id);
      const removed = prev.find(f => f.id === id);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return filtered;
    });
  };

  const clearAll = () => {
    files.forEach(f => URL.revokeObjectURL(f.previewUrl));
    setFiles([]);
    setError(null);
    setStatus('idle');
  };

  const handleMergeToPdf = async () => {
    if (files.length === 0) return;
    setStatus('processing');
    setProgress(10);
    setError(null);

    try {
      const imageFiles = files.filter(f => f.type !== FileType.PDF).map(f => f.file);
      const pdfFiles = files.filter(f => f.type === FileType.PDF).map(f => f.file);
      
      let finalPdfBytes: Uint8Array;

      if (pdfFiles.length > 0 && imageFiles.length === 0) {
        finalPdfBytes = await mergePdfs(pdfFiles);
      } else if (imageFiles.length > 0 && pdfFiles.length === 0) {
        finalPdfBytes = await imagesToPdf(imageFiles);
      } else {
        const tempImagePdfBytes = await imagesToPdf(imageFiles);
        const tempImageFile = new File([tempImagePdfBytes], 'temp.pdf', { type: 'application/pdf' });
        finalPdfBytes = await mergePdfs([...pdfFiles, tempImageFile]);
      }

      downloadBlob(new Blob([finalPdfBytes], { type: 'application/pdf' }), 'merged_document.pdf');
      setStatus('completed');
    } catch (err) {
      console.error(err);
      setError('An error occurred during PDF merging. Please try again.');
      setStatus('error');
    } finally {
      setProgress(0);
    }
  };

  const handlePdfToJpg = async () => {
    const pdfFile = files.find(f => f.type === FileType.PDF);
    if (!pdfFile) {
      setError('Please upload at least one PDF file to convert.');
      return;
    }

    setStatus('processing');
    setError(null);
    try {
      const results = await pdfToImages(pdfFile.file, (p) => setProgress(p));
      
      if (results.length === 0) throw new Error('No pages found in PDF.');

      const cleanName = pdfFile.name.replace('.pdf', '');

      if (results.length === 1) {
        const parts = results[0].dataUrl.split(';base64,');
        const raw = window.atob(parts[1]);
        const uInt8Array = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; ++i) uInt8Array[i] = raw.charCodeAt(i);
        downloadBlob(new Blob([uInt8Array], { type: 'image/jpeg' }), `${cleanName}.jpg`);
      } else {
        const zipBlob = await createZipFromImages(results, cleanName);
        downloadBlob(zipBlob, `${cleanName}_images.zip`);
      }

      setStatus('completed');
    } catch (err) {
      console.error('PDF to Image conversion error:', err);
      setError(`Conversion failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setStatus('error');
    } finally {
      setProgress(0);
    }
  };

  const isAllImages = files.length > 0 && files.every(f => f.type !== FileType.PDF);
  const hasPdf = files.some(f => f.type === FileType.PDF);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Files className="text-white" size={18} />
            </div>
            <h1 className="font-bold text-xl text-gray-900 tracking-tight">MasterPDF</h1>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full p-4 md:p-8 space-y-8">

        {/* 关键修复点在这里 */}
        <p className="text-xs text-gray-500 mt-1">
          Export PDF pages as images (ZIP if &gt; 1p)
        </p>

      </main>
    </div>
  );
};

export default App;
