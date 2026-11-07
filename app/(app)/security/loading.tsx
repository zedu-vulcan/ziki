import { Bar, SkeletonPage } from "@/components/ui/skeleton";

export default function SecurityLoading() {
  return (
    <SkeletonPage label="Loading security findings">
      <div className="flex justify-center">
        <Bar className="h-10 w-full max-w-md rounded-lg" />
      </div>
      <div className="overflow-hidden rounded-[20px] border border-zk-border bg-zk-surface">
        <div className="divide-y divide-zk-divider">
          {[0, 1, 2].map((row) => (
            <div key={row} className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_7rem_12rem_7rem] sm:px-5">
              <div className="min-w-0 space-y-2">
                <Bar className="h-3 w-16" />
                <Bar className="h-4 w-4/5" />
              </div>
              <Bar className="h-7 w-16 rounded-full" />
              <Bar className="hidden h-4 w-32 sm:block" />
              <Bar className="hidden h-4 w-16 sm:block" />
            </div>
          ))}
        </div>
      </div>
    </SkeletonPage>
  );
}
