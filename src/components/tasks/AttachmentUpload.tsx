// src/components/tasks/AttachmentUpload.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Upload,
  File,
  Image,
  FileText,
  Film,
  Music,
  Trash2,
  Download,
  X,
  Loader2,
} from 'lucide-react';
import type { Attachment } from '@/types/task';

interface AttachmentUploadProps {
  entityType: 'task' | 'lead' | 'kanban_card' | 'goal' | 'comment';
  entityId: string;
  readOnly?: boolean;
}

export function AttachmentUpload({ entityType, entityId, readOnly = false }: AttachmentUploadProps) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchAttachments();
  }, [entityType, entityId]);

  const fetchAttachments = async () => {
    try {
      const response = await fetch(
        `/api/attachments?entityType=${entityType}&entityId=${entityId}`
      );
      if (response.ok) {
        const data = await response.json();
        setAttachments(data);
      }
    } catch (error) {
      console.error('Erro ao buscar anexos:', error);
    }
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setUploadProgress(0);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Validar tamanho (10MB)
      if (file.size > 10 * 1024 * 1024) {
        alert(`Arquivo "${file.name}" é muito grande. Máximo: 10MB`);
        continue;
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('entityType', entityType);
      formData.append('entityId', entityId);

      try {
        const response = await fetch('/api/attachments', {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          const attachment = await response.json();
          setAttachments((prev) => [attachment, ...prev]);
        } else {
          const error = await response.json();
          alert(`Erro ao enviar "${file.name}": ${error.error}`);
        }
      } catch (error) {
        console.error('Erro no upload:', error);
      }

      setUploadProgress(((i + 1) / files.length) * 100);
    }

    setIsUploading(false);
    setUploadProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este anexo?')) return;

    try {
      const response = await fetch(`/api/attachments/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setAttachments((prev) => prev.filter((a) => a.id !== id));
      }
    } catch (error) {
      console.error('Erro ao deletar:', error);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleUpload(e.dataTransfer.files);
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <Image size={20} className="text-green-500" />;
    if (mimeType.startsWith('video/')) return <Film size={20} className="text-purple-500" />;
    if (mimeType.startsWith('audio/')) return <Music size={20} className="text-pink-500" />;
    if (mimeType.includes('pdf')) return <FileText size={20} className="text-red-500" />;
    return <File size={20} className="text-gray-500" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium text-gray-700">
        Anexos ({attachments.length})
      </h4>

      {/* Upload area */}
      {!readOnly && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
            dragOver
              ? 'border-indigo-500 bg-indigo-50'
              : 'border-gray-300 hover:border-gray-400'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={(e) => handleUpload(e.target.files)}
            className="hidden"
            id="file-upload"
          />

          {isUploading ? (
            <div className="space-y-2">
              <Loader2 className="mx-auto animate-spin text-indigo-600" size={32} />
              <p className="text-sm text-gray-600">Enviando... {Math.round(uploadProgress)}%</p>
              <div className="w-full max-w-xs mx-auto bg-gray-200 rounded-full h-2">
                <div
                  className="bg-indigo-600 h-2 rounded-full transition-all"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          ) : (
            <>
              <Upload className="mx-auto text-gray-400 mb-2" size={32} />
              <p className="text-sm text-gray-600 mb-1">
                Arraste arquivos aqui ou{' '}
                <label
                  htmlFor="file-upload"
                  className="text-indigo-600 hover:text-indigo-700 cursor-pointer font-medium"
                >
                  clique para selecionar
                </label>
              </p>
              <p className="text-xs text-gray-500">Máximo: 10MB por arquivo</p>
            </>
          )}
        </div>
      )}

      {/* Lista de anexos */}
      {attachments.length > 0 && (
        <div className="space-y-2">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg group"
            >
              {/* Preview ou ícone */}
              {attachment.mimeType.startsWith('image/') ? (
                <img
                  src={attachment.url}
                  alt={attachment.originalName}
                  className="w-10 h-10 object-cover rounded"
                />
              ) : (
                <div className="w-10 h-10 flex items-center justify-center bg-white rounded border">
                  {getFileIcon(attachment.mimeType)}
                </div>
              )}

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {attachment.originalName}
                </p>
                <p className="text-xs text-gray-500">
                  {formatFileSize(attachment.size)}
                  {attachment.uploadedBy && ` • ${attachment.uploadedBy.name}`}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <a
                  href={attachment.url}
                  download={attachment.originalName}
                  className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-white rounded"
                  title="Baixar"
                >
                  <Download size={16} />
                </a>
                {!readOnly && (
                  <button
                    onClick={() => handleDelete(attachment.id)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-white rounded"
                    title="Excluir"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {attachments.length === 0 && readOnly && (
        <p className="text-sm text-gray-500 text-center py-4">Nenhum anexo.</p>
      )}
    </div>
  );
}
