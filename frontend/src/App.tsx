import { useEffect, useState } from "react";
import ExpenseDashboard from "./expenses/ExpenseDashboard";
import FamilyFinancesPage from "./family-finances/FamilyFinancesPage";
import HealthPage from "./health/HealthPage";
import Navigation from "./components/Navigation";
import ProfilePage from "./auth/ProfilePage";
import { getCurrentUser, logout } from "./auth/authService";
import type { AuthUser } from "./auth/types";
import "./App.css";

function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const path = window.location.pathname.replace(/\/+$/, "") || "/";

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await getCurrentUser();
        setUser(currentUser);
      } catch {
        // User is not authenticated
        setUser(null);
      }
    };

    void loadUser();
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      setUser(null);
      window.location.href = "/";
    } catch {
      window.location.href = "/";
    }
  };

  // Only show navigation if user is authenticated
  const showNavigation = user !== null;

  // Health check page should not show navigation
  if (path === "/health") {
    return <HealthPage />;
  }

  if (showNavigation) {
    return (
      <>
        <Navigation user={user} currentPath={path} onLogout={handleLogout} />
        {path === "/family-finances" ? (
          <FamilyFinancesPage />
        ) : path === "/profile" ? (
          <ProfilePage user={user} />
        ) : (
          <ExpenseDashboard />
        )}
      </>
    );
  }

  // Default view for unauthenticated users
  return <ExpenseDashboard />;
}

export default App;
