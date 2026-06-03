import type { Task, TaskUser } from '../../api/tasks';
import { CalendarDays, Clock } from 'lucide-react';

interface PatchCardProps {
  task: Task;
  onClick: (task: Task) => void;
}

/** Safely get a one-letter initial from a user object.
 *  Backend stores `name` (single field); frontend interface also has
 *  optional `firstName`/`lastName`. We fall back gracefully. */
function getUserInitial(user?: TaskUser | null): string {
  if (!user) return '?';
  // firstName from interface
  if (user.firstName && user.firstName.length > 0) return user.firstName[0].toUpperCase();
  // name from DB (backend may return this directly)
  const anyUser = user as any;
  if (anyUser.name && anyUser.name.length > 0) return anyUser.name[0].toUpperCase();
  // username fallback
  if (anyUser.username && anyUser.username.length > 0) return anyUser.username[0].toUpperCase();
  return '?';
}

/** Safely get a display label for a user. */
function getUserDisplayName(user?: TaskUser | null): string {
  if (!user) return 'Unknown';
  if (user.firstName) {
    return user.lastName ? `${user.firstName} ${user.lastName}` : user.firstName;
  }
  const anyUser = user as any;
  return anyUser.name || anyUser.username || 'Unknown';
}

export function PatchCard({ task, onClick }: PatchCardProps) {
  // Guard against invalid/missing dates
  const createdAt = task.createdAt ? new Date(task.createdAt) : new Date();
  const updatedAt = task.updatedAt ? new Date(task.updatedAt) : createdAt;

  const createdDateStr = createdAt.toLocaleDateString(undefined, { 
    month: 'short', day: 'numeric'
  });
  
  const updatedDateStr = updatedAt.toLocaleDateString(undefined, { 
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
  });

  const renderAvatar = (user?: TaskUser | null, label: string = 'User', bgClass: string = 'bg-primary-700') => {
    if (!user) return null;
    const initial = getUserInitial(user);
    const displayName = getUserDisplayName(user);
    return (
      <div 
        className={`w-6 h-6 rounded-full border border-gray-900 flex items-center justify-center text-[10px] font-bold text-white shadow-sm ${bgClass}`}
        title={`${label}: ${displayName}`}
      >
        {initial}
      </div>
    );
  };

  const statusLabel = task.status
    ? task.status.replace(/STEP_\d+_/, '').replace(/_/g, ' ')
    : 'Unknown';

  return (
    <div 
      onClick={() => onClick(task)}
      className="bg-gray-900 border border-gray-700/80 hover:border-primary-500/50 transition-all p-3.5 rounded-xl shadow-md cursor-pointer hover:shadow-lg hover:shadow-primary-500/10 active:scale-[0.98] group flex flex-col gap-3"
    >
      <div className="flex justify-between items-start gap-2">
        <span className="text-[10px] font-bold tracking-wider uppercase text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full truncate max-w-[120px]">
          {task.module?.name || 'No Module'}
        </span>
        <div className="flex flex-col items-end gap-1 text-gray-500 text-[10px]">
          <div className="flex items-center gap-1" title="Created At">
            <CalendarDays size={10} />
            <span>{createdDateStr}</span>
          </div>
          <div className="flex items-center gap-1" title="Last Updated">
            <Clock size={10} />
            <span>{updatedDateStr}</span>
          </div>
        </div>
      </div>

      <h4 className="text-white text-sm font-semibold leading-snug line-clamp-2 group-hover:text-primary-400 transition-colors" title={task.title}>
        {task.title || 'Untitled Change'}
      </h4>
      {/* Show Change ID */}
      {(() => {
        const m = task.description?.match(/\[CHANGE_ID:\s*([^\]]+)\]/);
        const displayId = (task.id && /^\d{12}$/.test(task.id)) ? task.id : (m ? m[1] : task.id);
        return displayId ? (
          <div className="text-[9px] font-mono text-primary-400/70 tracking-wider">#{displayId}</div>
        ) : null;
      })()}

      {task.plannedEndDate && (
        <div className={`text-[10px] font-semibold flex items-center gap-1.5 px-2 py-0.5 rounded bg-gray-950/40 border border-gray-800 self-start ${
          new Date(task.plannedEndDate).getTime() < Date.now() ? 'text-rose-400 border-rose-900/30' : 'text-amber-400 border-amber-900/30'
        }`}>
          <Clock size={10} className="shrink-0" />
          <span>Deadline: {new Date(task.plannedEndDate).toLocaleDateString()}</span>
        </div>
      )}
      
      <div className="flex items-center justify-between border-t border-gray-800 pt-3 mt-1">
        <div className="flex -space-x-2 overflow-hidden">
          {task.client && renderAvatar(task.client, 'Client', 'bg-gray-600')}
          {renderAvatar(task.manager, 'Manager', 'bg-yellow-600')}
          {task.developers && task.developers.map((d) => renderAvatar(d, `Developer`, 'bg-primary-600'))}
          {task.verifiers && task.verifiers.map((v) => renderAvatar(v, `Verifier`, 'bg-purple-600'))}
        </div>
        
        <div className="text-xs font-medium text-gray-400">
          {statusLabel}
        </div>
      </div>
    </div>
  );
}
