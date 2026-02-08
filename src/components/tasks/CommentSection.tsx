// src/components/tasks/CommentSection.tsx
'use client';

import { useState, useEffect } from 'react';
import { Send, MoreVertical, Edit2, Trash2, Reply, User } from 'lucide-react';
import type { Comment, CommentCreate } from '@/types/task';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CommentSectionProps {
  entityType: 'task' | 'lead' | 'kanban_card' | 'goal';
  entityId: string;
  currentUserId?: string;
}

export function CommentSection({ entityType, entityId, currentUserId }: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  // Fetch comments
  useEffect(() => {
    fetchComments();
  }, [entityType, entityId]);

  const fetchComments = async () => {
    try {
      const response = await fetch(
        `/api/comments?entityType=${entityType}&entityId=${entityId}`
      );
      if (response.ok) {
        const data = await response.json();
        setComments(data);
      }
    } catch (error) {
      console.error('Erro ao buscar comentários:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: newComment.trim(),
          entityType,
          entityId,
        }),
      });

      if (response.ok) {
        const comment = await response.json();
        setComments((prev) => [...prev, comment]);
        setNewComment('');
      }
    } catch (error) {
      console.error('Erro ao criar comentário:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReply = async (parentId: string) => {
    if (!replyContent.trim()) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: replyContent.trim(),
          entityType,
          entityId,
          parentId,
        }),
      });

      if (response.ok) {
        const reply = await response.json();
        setComments((prev) =>
          prev.map((c) =>
            c.id === parentId
              ? { ...c, replies: [...(c.replies || []), reply] }
              : c
          )
        );
        setReplyingTo(null);
        setReplyContent('');
      }
    } catch (error) {
      console.error('Erro ao responder:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = async (commentId: string) => {
    if (!editContent.trim()) return;

    try {
      const response = await fetch(`/api/comments/${commentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editContent.trim() }),
      });

      if (response.ok) {
        const updated = await response.json();
        setComments((prev) =>
          prev.map((c) => {
            if (c.id === commentId) return { ...c, ...updated };
            if (c.replies) {
              return {
                ...c,
                replies: c.replies.map((r) =>
                  r.id === commentId ? { ...r, ...updated } : r
                ),
              };
            }
            return c;
          })
        );
        setEditingId(null);
        setEditContent('');
      }
    } catch (error) {
      console.error('Erro ao editar:', error);
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!confirm('Excluir este comentário?')) return;

    try {
      const response = await fetch(`/api/comments/${commentId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setComments((prev) =>
          prev
            .filter((c) => c.id !== commentId)
            .map((c) => ({
              ...c,
              replies: c.replies?.filter((r) => r.id !== commentId),
            }))
        );
      }
    } catch (error) {
      console.error('Erro ao deletar:', error);
    }
  };

  const formatDate = (dateStr: string) => {
    return formatDistanceToNow(new Date(dateStr), {
      addSuffix: true,
      locale: ptBR,
    });
  };

  const CommentItem = ({ comment, isReply = false }: { comment: Comment; isReply?: boolean }) => {
    const isOwner = comment.authorId === currentUserId;

    return (
      <div className={`flex gap-3 ${isReply ? 'ml-10 mt-3' : ''}`}>
        {/* Avatar */}
        <div className="flex-shrink-0">
          {comment.author.avatarUrl ? (
            <img
              src={comment.author.avatarUrl}
              alt={comment.author.name}
              className="w-8 h-8 rounded-full"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
              <User size={16} className="text-indigo-600" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium text-sm text-gray-900">
                {comment.author.name}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">{formatDate(comment.createdAt)}</span>
                {isOwner && (
                  <div className="relative">
                    <button
                      onClick={() => setMenuOpen(menuOpen === comment.id ? null : comment.id)}
                      className="p-1 hover:bg-gray-200 rounded"
                    >
                      <MoreVertical size={14} />
                    </button>
                    {menuOpen === comment.id && (
                      <div className="absolute right-0 mt-1 w-32 bg-white rounded-lg shadow-lg border py-1 z-10">
                        <button
                          onClick={() => {
                            setEditingId(comment.id);
                            setEditContent(comment.content);
                            setMenuOpen(null);
                          }}
                          className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-gray-50"
                        >
                          <Edit2 size={14} /> Editar
                        </button>
                        <button
                          onClick={() => {
                            handleDelete(comment.id);
                            setMenuOpen(null);
                          }}
                          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                        >
                          <Trash2 size={14} /> Excluir
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {editingId === comment.id ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleEdit(comment.id);
                    if (e.key === 'Escape') {
                      setEditingId(null);
                      setEditContent('');
                    }
                  }}
                  autoFocus
                  className="flex-1 px-2 py-1 text-sm border rounded"
                />
                <button
                  onClick={() => handleEdit(comment.id)}
                  className="px-2 py-1 text-sm bg-indigo-600 text-white rounded"
                >
                  Salvar
                </button>
              </div>
            ) : (
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{comment.content}</p>
            )}
          </div>

          {/* Actions */}
          {!isReply && !editingId && (
            <button
              onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
              className="flex items-center gap-1 mt-1 text-xs text-gray-500 hover:text-indigo-600"
            >
              <Reply size={12} /> Responder
            </button>
          )}

          {/* Reply input */}
          {replyingTo === comment.id && (
            <div className="flex gap-2 mt-2">
              <input
                type="text"
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleReply(comment.id);
                  if (e.key === 'Escape') {
                    setReplyingTo(null);
                    setReplyContent('');
                  }
                }}
                placeholder="Escreva uma resposta..."
                autoFocus
                className="flex-1 px-3 py-2 text-sm border rounded-lg"
              />
              <button
                onClick={() => handleReply(comment.id)}
                disabled={!replyContent.trim() || isLoading}
                className="px-3 py-2 bg-indigo-600 text-white rounded-lg disabled:opacity-50"
              >
                <Send size={14} />
              </button>
            </div>
          )}

          {/* Replies */}
          {comment.replies?.map((reply) => (
            <CommentItem key={reply.id} comment={reply} isReply />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium text-gray-700">
        Comentários ({comments.length})
      </h4>

      {/* Lista de comentários */}
      <div className="space-y-4">
        {comments.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">
            Nenhum comentário ainda. Seja o primeiro!
          </p>
        ) : (
          comments.map((comment) => <CommentItem key={comment.id} comment={comment} />)
        )}
      </div>

      {/* Input novo comentário */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Escreva um comentário..."
          className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
        <button
          type="submit"
          disabled={!newComment.trim() || isLoading}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}
