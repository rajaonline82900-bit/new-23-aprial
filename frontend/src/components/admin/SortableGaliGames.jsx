import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Loader2, Save } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const SortableRow = ({ game, renderContent }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: game.game_id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 20 : 'auto',
    opacity: isDragging ? 0.85 : 1,
    boxShadow: isDragging ? '0 8px 20px rgba(0,0,0,0.55)' : 'none',
  };
  return (
    <div ref={setNodeRef} style={style} className="relative">
      <div className="flex items-stretch">
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          data-testid={`drag-handle-${game.game_id}`}
          aria-label="Reorder game"
          className="shrink-0 flex items-center justify-center px-1.5 mr-1 rounded-l-lg cursor-grab active:cursor-grabbing touch-none"
          style={{
            background: 'linear-gradient(180deg, rgba(212,175,55,0.20) 0%, rgba(212,175,55,0.08) 100%)',
            border: '1px dashed rgba(212,175,55,0.45)',
            borderRight: 'none',
          }}
        >
          <GripVertical className="w-5 h-5 text-[#D4AF37]" />
        </button>
        <div className="flex-1">{renderContent(game)}</div>
      </div>
    </div>
  );
};

const SortableGaliGames = ({ games, renderRow }) => {
  const [items, setItems] = useState(games);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  // Reset local state whenever parent games prop changes (e.g. after add/edit)
  useEffect(() => { setItems(games); setDirty(false); }, [games]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
  );

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((g) => g.game_id === active.id);
    const newIndex = items.findIndex((g) => g.game_id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(items, oldIndex, newIndex);
    setItems(reordered);
    setDirty(true);
  };

  const saveOrder = async () => {
    setSaving(true);
    try {
      await axios.post(
        `${API}/api/admin/games/reorder`,
        { order: items.map((g) => g.game_id) },
        { withCredentials: true }
      );
      toast.success('Game order save ho gaya');
      setDirty(false);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Save failed');
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-3">
      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
        💡 Finger se pakadke drag karo ↕ position change karne ke liye
      </p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((g) => g.game_id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {items.map((g) => (
              <SortableRow key={g.game_id} game={g} renderContent={renderRow} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      {dirty && (
        <button
          onClick={saveOrder}
          disabled={saving}
          data-testid="save-game-order-btn"
          className="w-full mt-2 py-3 rounded-xl font-black text-sm text-white bg-gradient-to-r from-emerald-500 to-emerald-700 shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save new order
        </button>
      )}
    </div>
  );
};

export default SortableGaliGames;
