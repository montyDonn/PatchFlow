import React from 'react';
import type { Task } from '../../api/tasks';
import { PatchCard } from './PatchCard';

interface PatchColumnProps {
  id: string;
  title: string;
  icon: React.ReactNode;
  borderClass: string;
  bgClass: string;
  tasks: Task[];
  onTaskClick: (task: Task) => void;
}

export function PatchColumn({ title, icon, borderClass, bgClass, tasks, onTaskClick }: PatchColumnProps) {
  return (
    <div className="w-72 flex flex-col shrink-0">
      {/* Column Header */}
      <div className={`flex items-center gap-2 mb-3 px-1 border-b-2 pb-2 ${borderClass}`}>
        {icon}
        <h3 className="font-semibold text-sm text-gray-200">{title}</h3>
        <span className="ml-auto bg-gray-800 text-gray-400 text-xs px-2 py-0.5 rounded-full font-bold">
          {tasks.length}
        </span>
      </div>

      {/* Cards Container */}
      <div className={`rounded-xl p-2.5 border border-gray-700/50 space-y-3 min-h-[150px] ${bgClass}`}>
        {tasks.length === 0 ? (
          <div className="text-center py-6 text-xs text-gray-600 font-medium">Empty</div>
        ) : (
          tasks.map(task => (
            <PatchCard key={task.id} task={task} onClick={onTaskClick} />
          ))
        )}
      </div>
    </div>
  );
}
