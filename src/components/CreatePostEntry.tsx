import React, { useState } from 'react';
import type { Usuario } from '../types';
import CreatePost from './CreatePost';
import CreatePostCarousel from './CreatePostCarousel';

interface Props {
  onPostCreated?: () => void;
  currentUser: Usuario;
}

export default function CreatePostEntry(props: Props) {
  const [mode, setMode] = useState<'SIMPLES' | 'CARROSSEL'>('SIMPLES');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setMode('SIMPLES')}
          className={`rounded-lg border px-4 py-2 text-sm font-semibold ${
            mode === 'SIMPLES' ? 'border-brand-secondary bg-brand-light text-brand-secondary' : 'border-slate-200 text-slate-700'
          }`}
        >
          Post simples
        </button>
        <button
          type="button"
          onClick={() => setMode('CARROSSEL')}
          className={`rounded-lg border px-4 py-2 text-sm font-semibold ${
            mode === 'CARROSSEL' ? 'border-brand-secondary bg-brand-light text-brand-secondary' : 'border-slate-200 text-slate-700'
          }`}
        >
          Carrossel
        </button>
      </div>

      {mode === 'CARROSSEL' ? <CreatePostCarousel {...props} /> : <CreatePost {...props} />}
    </div>
  );
}
