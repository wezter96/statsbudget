const Skeleton = ({ className = '' }: { className?: string }) => (
  <div
    className={`rounded-lg bg-gradient-to-r from-secondary via-muted to-secondary bg-[length:200%_100%] animate-shimmer ${className}`}
  />
);

export const TreemapSkeleton = () => (
  <div className="space-y-3">
    <Skeleton className="h-6 w-32" />
    <div className="grid grid-cols-3 gap-2">
      <Skeleton className="h-32 col-span-2" />
      <Skeleton className="h-32" />
      <Skeleton className="h-24" />
      <Skeleton className="h-24" />
      <Skeleton className="h-24" />
    </div>
  </div>
);

export const ChartSkeleton = () => (
  <div className="space-y-3">
    <Skeleton className="h-6 w-48" />
    <Skeleton className="h-64 w-full" />
  </div>
);

export const BarListSkeleton = () => (
  <div className="space-y-3">
    {Array.from({ length: 6 }).map((_, i) => (
      <div key={i} className="flex items-center gap-3">
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 flex-1" />
        <Skeleton className="h-4 w-16" />
      </div>
    ))}
  </div>
);

export default Skeleton;
