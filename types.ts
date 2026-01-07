
export enum FileType {
  PDF = 'application/pdf',
  JPG = 'image/jpeg',
  PNG = 'image/png'
}

export interface ManagedFile {
  id: string;
  file: File;
  previewUrl: string;
  type: FileType;
  name: string;
  size: number;
}

export type ProcessingStatus = 'idle' | 'processing' | 'completed' | 'error';

export interface AppState {
  files: ManagedFile[];
  status: ProcessingStatus;
  progress: number;
  error?: string;
}
