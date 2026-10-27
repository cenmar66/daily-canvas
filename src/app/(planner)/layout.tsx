import { CanvasProvider } from "@/components/provider";
import { Shell } from "@/components/shell";
import { RegisterServiceWorker } from "@/components/register-sw";
import "./canvas.css";

// The planner renders on the device from IndexedDB (after a client boot), so the server
// "instant navigation" check has nothing to validate here.
export const instant = false;

export default function PlannerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dc-root" data-theme="system" data-density="comfortable">
      <CanvasProvider>
        <Shell>{children}</Shell>
      </CanvasProvider>
      <RegisterServiceWorker />
    </div>
  );
}
