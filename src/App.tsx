import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { HomeScreen } from "@/components/home/HomeScreen";
import { ExploreScreen } from "@/components/explore/ExploreScreen";
import { ProjectsScreen } from "@/components/projects/ProjectsScreen";
import { SettingsScreen } from "@/components/auth/SettingsScreen";
import { SupportScreen } from "@/components/auth/SupportScreen";
import { DownloadScreen } from "@/components/download/DownloadScreen";
import { GeneratedInterface } from "@/components/generated-interface/GeneratedInterface";
import { InterfaceErrorBoundary } from "@/components/shared/ErrorBoundary";
import { useNavStore, useSessionStore } from "@/stores";
import { OfflineGraceIndicator } from "@/components/messages";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

function MainView() {
  const nav = useNavStore((s) => s.active);
  const session = useSessionStore((s) => s.session);

  // If a session is classified, show the generated interface (unless the user
  // explicitly navigates elsewhere). Keeps the drop → classify → run flow tight.
  if (session.phase === "classified" || session.phase === "running" || session.phase === "done" || session.phase === "stopped" || session.phase === "error") {
    if (nav === "home") {
      return (
        <InterfaceErrorBoundary>
          <GeneratedInterface />
        </InterfaceErrorBoundary>
      );
    }
  }

  switch (nav) {
    case "home":
      return <HomeScreen />;
    case "explore":
      return <ExploreScreen />;
    case "projects":
      return <ProjectsScreen />;
    case "settings":
      return <SettingsScreen />;
    case "support":
      return <SupportScreen />;
    case "download":
      return <DownloadScreen />;
    default:
      return <HomeScreen />;
  }
}

export default function App() {
  const [offlineDays, setOfflineDays] = useState<number | null>(null);

  // Placeholder offline-grace check (Section 11). Real impl reads the stored
  // last-successful license check timestamp.
  useEffect(() => {
    const last = localStorage.getItem("reporun:lastLicenseCheck");
    if (!last) return;
    const days = Math.floor(
      (Date.now() - parseInt(last, 10)) / (1000 * 60 * 60 * 24),
    );
    if (days > 0 && days <= 14) setOfflineDays(14 - days);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex h-full">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          {offlineDays != null ? (
            <div className="flex justify-end px-5 pt-2">
              <OfflineGraceIndicator daysLeft={offlineDays} />
            </div>
          ) : null}
          <div className="min-h-0 flex-1">
            <MainView />
          </div>
        </div>
      </div>
    </QueryClientProvider>
  );
}
