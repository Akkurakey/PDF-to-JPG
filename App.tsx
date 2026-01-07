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
// 假设这些类型和你本地的一致
import { ManagedFile, FileType, ProcessingStatus } from './types';
import FileCard from './components/FileCard';
import { imagesToPdf, mergePdfs, pdfToImages, downloadBlob, createZipFromImages } from './services/pdfTools';

const App: React.FC = () => {
  const [files, setFiles] = useState<ManagedFile[]>([]);
  const [status, setStatus] = useState<ProcessingStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- 逻辑处理部分保持不变 ---
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).map((file: File) => {
        // 简单的类型判断逻辑，实际项目中可能需要更严谨的判断
        let type: FileType = FileType.UNKNOWN;
        if (file.type === 'application/pdf') type = FileType.PDF;
        else if (file.type.startsWith('image/')) type = FileType.IMAGE;

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
    // 重置 input value 允许重复上传同名文件
    if (fileInputRef.current) fileInputRef.current.value = '';
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
      setStatus('idle'); // 任务完成后重置状态，或者你可以保留 completed 状态
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
      setStatus('idle');
    }
  };

  // 辅助变量
  const isProcessing = status === 'processing';
  const hasFiles = files.length > 0;
  const hasPdf = files.some(f => f.type === FileType.PDF);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Files className="text-white" size={18} />
            </div>
            <h1 className="font-bold text-xl text-gray-900 tracking-tight">MasterPDF</h1>
          </div>
          {/* 头部右侧操作区 */}
          {hasFiles && (
            <button 
              onClick={clearAll}
              className="text-gray-500 hover:text-red-600 transition-colors flex items-center gap-1 text-sm font-medium"
              disabled={isProcessing}
            >
              <Trash2 size={16} />
              Clear All
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full p-4 md:p-8 space-y-8">
        
        {/* 1. 错误提示区域 */}
        {error && (
          <div className="bg-red-50 text-red-700 p-4 rounded-lg flex items-center gap-3 border border-red-100">
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
        )}

        {/* 2. 拖拽/上传区域 */}
        <div 
          onClick={() => !isProcessing && fileInputRef.current?.click()}
          className={`
            border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all
            flex flex-col items-center justify-center gap-4 group
            ${isProcessing ? 'opacity-50 cursor-not-allowed border-gray-200 bg-gray-50' : 'border-gray-300 hover:border-indigo-500 hover:bg-indigo-50/30'}
          `}
        >
          <input 
            ref={fileInputRef} 
            type="file" 
            className="hidden" 
            multiple 
            accept="application/pdf,image/png,image/jpeg,image/jpg"
            onChange={handleFileChange}
            disabled={isProcessing}
          />
          
          <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
            {isProcessing ? <Loader2 className="animate-spin" size={32} /> : <Upload size={32} />}
          </div>
          
          <div className="space-y-1">
            <h3 className="font-semibold text-lg text-gray-900">
              {isProcessing ? 'Processing...' : 'Click or Drag files here'}
            </h3>
            <p className="text-gray-500 text-sm">
              Supports PDF, JPG, PNG
            </p>
          </div>
        </div>

        {/* 3. 文件列表区域 (如果 files > 0 才显示) */}
        {hasFiles && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {files.map(file => (
              <FileCard 
                key={file.id} 
                file={file} 
                onRemove={() => removeFile(file.id)} 
              />
            ))}
          </div>
        )}

        {/* 4. 操作按钮区域 */}
        {hasFiles && (
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 md:static md:bg-transparent md:border-0 md:p-0">
                <div className="max-w-5xl mx-auto flex flex-col md:flex-row gap-4 justify-end">
                    
                    {/* 只有存在 PDF 时才显示转图片按钮 */}
                    {hasPdf && (
                        <button
                            onClick={handlePdfToJpg}
                            disabled={isProcessing}
                            className="flex-1 md:flex-none btn-secondary bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-3 px-6 rounded-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                        >
                            <FileImage size={20} />
                            PDF to JPG
                        </button>
                    )}

                    <button
                        onClick={handleMergeToPdf}
                        disabled={isProcessing}
                        className="flex-1 md:flex-none bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-6 rounded-lg flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isProcessing ? <Loader2 className="animate-spin" size={20} /> : <Download size={20} />}
                        {files.length > 1 ? 'Merge Files' : 'Convert/Download'}
                    </button>
                </div>
            </div>
        )}

      </main>
    </div>
  );
};

export default App;
