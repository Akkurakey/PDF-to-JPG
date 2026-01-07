
import { PDFDocument } from 'pdf-lib';
import * as pdfjs from 'pdfjs-dist';
import JSZip from 'jszip';

// Configure PDF.js worker - matching the version in index.html import map
const PDFJS_VERSION = '5.4.530';
pdfjs.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.mjs`;

/**
 * Converts multiple JPG/PNG images into a single PDF.
 */
export const imagesToPdf = async (images: File[]): Promise<Uint8Array> => {
  const pdfDoc = await PDFDocument.create();

  for (const imageFile of images) {
    const arrayBuffer = await imageFile.arrayBuffer();
    let embeddedImage;
    
    if (imageFile.type === 'image/jpeg' || imageFile.type === 'image/jpg') {
      embeddedImage = await pdfDoc.embedJpg(arrayBuffer);
    } else {
      embeddedImage = await pdfDoc.embedPng(arrayBuffer);
    }

    const page = pdfDoc.addPage([embeddedImage.width, embeddedImage.height]);
    page.drawImage(embeddedImage, {
      x: 0,
      y: 0,
      width: embeddedImage.width,
      height: embeddedImage.height,
    });
  }

  return await pdfDoc.save();
};

/**
 * Merges multiple PDF files into one.
 */
export const mergePdfs = async (pdfFiles: File[]): Promise<Uint8Array> => {
  const mergedPdf = await PDFDocument.create();

  for (const file of pdfFiles) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await PDFDocument.load(arrayBuffer);
    const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    copiedPages.forEach((page) => mergedPdf.addPage(page));
  }

  return await mergedPdf.save();
};

/**
 * Converts a PDF file into an array of JPG images (one for each page).
 */
export const pdfToImages = async (
  pdfFile: File,
  onProgress?: (progress: number) => void
): Promise<{ dataUrl: string; page: number }[]> => {
  const arrayBuffer = await pdfFile.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) });
  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;
  const results: { dataUrl: string; page: number }[] = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    if (!context) throw new Error('Could not create canvas context');

    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({ canvasContext: context, viewport }).promise;
    
    results.push({
      dataUrl: canvas.toDataURL('image/jpeg', 0.9),
      page: i,
    });

    if (onProgress) {
      onProgress(Math.round((i / numPages) * 100));
    }
  }

  return results;
};

/**
 * Creates a ZIP file from an array of image results.
 */
export const createZipFromImages = async (
  images: { dataUrl: string; page: number }[],
  baseName: string
): Promise<Blob> => {
  const zip = new JSZip();
  const folder = zip.folder(baseName) || zip;

  images.forEach((img) => {
    const base64Data = img.dataUrl.split(';base64,')[1];
    folder.file(`page_${img.page}.jpg`, base64Data, { base64: true });
  });

  return await zip.generateAsync({ type: 'blob' });
};

/**
 * Helper to download a blob
 */
export const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
};
