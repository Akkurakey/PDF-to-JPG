
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
        // Single page: Direct JPG download
        const parts = results[0].dataUrl.split(';base64,');
        const raw = window.atob(parts[1]);
        const uInt8Array = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; ++i) uInt8Array[i] = raw.charCodeAt(i);
        downloadBlob(new Blob([uInt8Array], { type: 'image/jpeg' }), `${cleanName}.jpg`);
      } else {
        // Multi-page: Bundle into ZIP
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
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2 py-1 rounded">v1.2</span>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full p-4 md:p-8 space-y-8">
        <section className="text-center space-y-2">
          <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
            Modern PDF & Image Utilities
          </h2>
          <p className="text-gray-500 max-w-2xl mx-auto">
            Convert between formats and merge documents effortlessly. All processing happens 
            locally in your browser—your files never leave your device.
          </p>
        </section>

        <div 
          className={`relative border-2 border-dashed rounded-2xl p-8 transition-all flex flex-col items-center justify-center text-center
            ${files.length > 0 ? 'bg-white border-gray-200' : 'bg-indigo-50/30 border-indigo-200 hover:border-indigo-400 cursor-pointer'}`}
          onClick={() => files.length === 0 && fileInputRef.current?.click()}
        >
          <input 
            type="file" 
            multiple 
            accept="application/pdf,image/jpeg,image/png"
            className="hidden" 
            ref={fileInputRef}
            onChange={handleFileChange}
          />
          
          {files.length === 0 ? (
            <div className="space-y-4">
              <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto">
                <Upload className="text-indigo-600" size={32} />
              </div>
              <div>
                <p className="text-lg font-semibold text-gray-900">Drop files here or click to upload</p>
                <p className="text-sm text-gray-500 mt-1">Supports PDF, JPG, and PNG up to 50MB</p>
              </div>
            </div>
          ) : (
            <div className="w-full space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                  <Files size={18} />
                  Queue ({files.length} files)
                </h3>
                <div className="flex gap-2">
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <Plus size={16} /> Add more
                  </button>
                  <button 
                    onClick={clearAll}
                    className="flex items-center gap-1 text-sm font-medium text-red-600 hover:text-red-700 bg-red-50 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <Trash2 size={16} /> Clear
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {files.map(file => (
                  <FileCard key={file.id} file={file} onRemove={removeFile} />
                ))}
              </div>
            </div>
          )}
        </div>

        {files.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button 
              onClick={handleMergeToPdf}
              disabled={status === 'processing'}
              className="group relative flex flex-col items-center gap-4 p-6 bg-white border border-gray-200 rounded-2xl hover:border-indigo-500 hover:shadow-xl hover:-translate-y-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center group-hover:bg-indigo-600 transition-colors">
                <Files className="text-indigo-600 group-hover:text-white" size={24} />
              </div>
              <div className="text-center">
                <p className="font-bold text-gray-900">Merge to PDF</p>
                <p className="text-xs text-gray-500 mt-1">Combine all items into one PDF</p>
              </div>
            </button>

            <button 
              onClick={handlePdfToJpg}
              disabled={status === 'processing' || !hasPdf}
              className="group relative flex flex-col items-center gap-4 p-6 bg-white border border-gray-200 rounded-2xl hover:border-orange-500 hover:shadow-xl hover:-translate-y-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center group-hover:bg-orange-600 transition-colors">
                <FileImage className="text-orange-600 group-hover:text-white" size={24} />
              </div>
              <div className="text-center">
                <p className="font-bold text-gray-900">PDF to JPG</p>
                <p className="text-xs text-gray-500 mt-1">Export PDF pages as images (ZIP if >1p)</p>
              </div>
              {!hasPdf && <div className="absolute top-2 right-2"><AlertCircle className="text-gray-300" size={16} /></div>}
            </button>

            <button 
              onClick={handleMergeToPdf}
              disabled={status === 'processing' || !isAllImages}
              className="group relative flex flex-col items-center gap-4 p-6 bg-white border border-gray-200 rounded-2xl hover:border-emerald-500 hover:shadow-xl hover:-translate-y-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center group-hover:bg-emerald-600 transition-colors">
                <ArrowRightLeft className="text-emerald-600 group-hover:text-white" size={24} />
              </div>
              <div className="text-center">
                <p className="font-bold text-gray-900">Images to PDF</p>
                <p className="text-xs text-gray-500 mt-1">Convert photos to single PDF</p>
              </div>
            </button>
          </div>
        )}

        {status === 'processing' && (
          <div className="bg-white border border-indigo-100 rounded-2xl p-8 text-center space-y-4 shadow-sm animate-pulse">
            <Loader2 className="animate-spin text-indigo-600 mx-auto" size={40} />
            <div className="space-y-1">
              <p className="font-bold text-gray-900 text-lg">Processing your files...</p>
              <p className="text-gray-500">This may take a moment depending on file size.</p>
            </div>
            {progress > 0 && (
              <div className="max-w-xs mx-auto w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-indigo-600 h-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3 text-red-700">
            <AlertCircle size={20} />
            <p className="font-medium">{error}</p>
          </div>
        )}

        {status === 'completed' && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center space-y-3">
            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600">
              <Download size={24} />
            </div>
            <div className="space-y-1">
              <p className="font-bold text-emerald-900 text-lg">Success!</p>
              <p className="text-emerald-700">Your download should have started automatically.</p>
            </div>
            <button 
              onClick={() => setStatus('idle')}
              className="text-sm font-semibold text-emerald-600 hover:underline"
            >
              Start another task
            </button>
          </div>
        )}
      </main>

      <footer className="bg-white border-t border-gray-200 py-8 mt-auto">
        <div className="max-w-5xl mx-auto px-4 text-center space-y-4">
          <p className="text-gray-400 text-sm">
            © 2024 MasterPDF Utilities. 100% Client-side. Privacy first.
          </p>
          <div className="flex justify-center gap-6">
            <span className="flex items-center gap-1.5 text-xs text-gray-500">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
              Local Execution
            </span>
            <span className="flex items-center gap-1.5 text-xs text-gray-500">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
              No Data Tracking
            </span>
            <span className="flex items-center gap-1.5 text-xs text-gray-500">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
              Open Source
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
