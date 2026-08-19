import React, { useState, useRef } from 'react';

interface VideoUploaderProps {
  tenantId: string;
  onUploadComplete: (files: { path: string, name: string }[]) => void;
  onUploadStart: () => void;
  mode?: 'single' | 'batch';
  maxSize?: number;
}

export default function VideoUploader({ tenantId, onUploadComplete, onUploadStart, mode = 'single', maxSize = 100 * 1024 * 1024 }: VideoUploaderProps) {
  const [dragActive, setDragActive] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<{ id: string, name: string, progress: number | null, error: string | null }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const validateAndUploadMultiple = async (filesList: FileList) => {
    setError(null);
    const filesArray = Array.from(filesList);
    
    // 1. Validaciones de tipo y tamaño
    const validFiles: File[] = [];
    
    for (const file of filesArray) {
      const isVideo = file.type.startsWith('video/') || file.name.endsWith('.mp4') || file.name.endsWith('.mov');
      if (!isVideo) {
        setError(`El archivo "${file.name}" no es un formato soportado. Sube videos MP4 o MOV.`);
        return;
      }
      if (file.size > maxSize) {
        setError(`El archivo "${file.name}" supera el límite de ${maxSize / (1024 * 1024)} MB.`);
        return;
      }
      validFiles.push(file);
    }

    if (validFiles.length === 0) return;

    // Si el modo es single, tomamos solo el primer archivo válido
    const filesToUpload = mode === 'batch' ? validFiles : [validFiles[0]];

    onUploadStart();

    // Crear elementos iniciales en la cola
    const initialQueue = filesToUpload.map(f => ({
      id: Math.random().toString(36).substring(2, 9),
      name: f.name,
      progress: 0,
      error: null as string | null
    }));

    setUploadQueue(prev => [...prev, ...initialQueue]);

    const uploadPromises = filesToUpload.map(async (file, idx) => {
      const queueItem = initialQueue[idx];
      try {
        // 1. Obtener la URL firmada de subida para R2
        const getUrlRes = await fetch(`/api/panel/social/storage?action=upload&filename=${encodeURIComponent(file.name)}&contentType=${encodeURIComponent(file.type)}&size=${file.size}`, {
          credentials: 'same-origin',
          cache: 'no-store',
        });
        if (!getUrlRes.ok) {
          const errData = await getUrlRes.json();
          throw new Error(errData.error || 'Error al obtener la URL de subida de R2');
        }
        const { uploadUrl, key: filePath } = await getUrlRes.json();

        console.log(`[R2 Storage Upload] Subiendo a Cloudflare R2, path: ${filePath}`);

        // 2. Subir el archivo usando XMLHttpRequest para poder reportar progreso
        await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('PUT', uploadUrl);
          xhr.setRequestHeader('Content-Type', file.type);

          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              const percent = Math.round((event.loaded / event.total) * 100);
              setUploadQueue(prev =>
                prev.map(item => item.id === queueItem.id ? { ...item, progress: percent } : item)
              );
            }
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve(null);
            } else {
              reject(new Error(`Error al subir a R2: ${xhr.status} ${xhr.statusText}`));
            }
          };

          xhr.onerror = () => {
            reject(new Error('Error de red al subir a R2.'));
          };

          xhr.send(file);
        });

        const confirmResponse = await fetch('/api/panel/social/storage', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: filePath }),
        });
        if (!confirmResponse.ok) {
          const confirmationError = await confirmResponse.json().catch(() => ({}));
          throw new Error(confirmationError.error || 'No se pudo confirmar la subida');
        }

        setUploadQueue(prev =>
          prev.map(item => item.id === queueItem.id ? { ...item, progress: 100 } : item)
        );

        return { path: filePath, name: file.name };
      } catch (err: any) {
        console.error(`Upload error for ${file.name}:`, err);
        setUploadQueue(prev =>
          prev.map(item => item.id === queueItem.id ? { ...item, progress: null, error: err.message || 'Error de subida' } : item)
        );
        return null;
      }
    });

    const results = await Promise.all(uploadPromises);
    const successfulUploads = results.filter((r): r is { path: string, name: string } => r !== null);
    
    if (successfulUploads.length > 0) {
      onUploadComplete(successfulUploads);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndUploadMultiple(e.dataTransfer.files);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files.length > 0) {
      validateAndUploadMultiple(e.target.files);
    }
  };

  const onButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="w-full">
      <div
        className={`relative border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center transition-all duration-200 cursor-pointer ${
          dragActive
            ? 'border-indigo-500 bg-indigo-500/5'
            : 'border-[#2d3139] bg-[#111318]/50 hover:bg-[#111318]/80 hover:border-[#3a3f4d]'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={onButtonClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="video/mp4,video/quicktime"
          multiple={mode === 'batch'}
          onChange={handleChange}
        />

        <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 mb-4">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </div>

        <p className="text-sm font-medium text-white text-center">
          {mode === 'batch' 
            ? 'Arrastra tus videos aquí o busca en tu equipo' 
            : 'Arrastra tu video aquí o busca en tu equipo'}
        </p>
        <p className="text-[11px] text-[#727785] mt-1.5 text-center">
          Formatos admitidos: MP4, MOV (Hasta {maxSize / (1024 * 1024)} MB {mode === 'batch' && 'por archivo'})
        </p>

        {dragActive && (
          <div className="absolute inset-0 rounded-2xl bg-indigo-500/5 pointer-events-none" />
        )}
      </div>

      {uploadQueue.map((item) => (
        <div key={item.id} className="mt-3 p-3 bg-[#111318] border border-[#2d3139] rounded-xl flex items-center justify-between">
          <div className="flex items-center space-x-3 overflow-hidden">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 flex-shrink-0">
              <svg className="w-4 h-4 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-medium text-white truncate">{item.name}</p>
              {item.progress !== null && (
                <div className="w-48 bg-[#2d3139] h-1.5 rounded-full mt-1 overflow-hidden">
                  <div
                    className="bg-indigo-500 h-full rounded-full transition-all duration-300"
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
              )}
              {item.error && (
                <p className="text-[10px] text-red-400 mt-0.5">{item.error}</p>
              )}
            </div>
          </div>
          <span className="text-xs text-[#727785] font-semibold flex-shrink-0">
            {item.error ? 'Falló' : item.progress !== null ? `${item.progress}%` : 'Subiendo...'}
          </span>
        </div>
      ))}

      {error && (
        <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl flex items-center space-x-2">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
