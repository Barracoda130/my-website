import type { AuthUser } from "../auth/types";
import "./Navigation.css";

interface NavigationProps {
  user: AuthUser | null;
  currentPath: string;
  onLogout: () => void;
}

function Navigation({ user, currentPath, onLogout }: NavigationProps) {
  const isActive = (path: string) => {
    const normalizedPath = currentPath.replace(/\/+$/, "") || "/";
    return normalizedPath === path;
  };

  const handleLogout = () => {
    onLogout();
  };

  return (
    <nav className="navigation">
      <div className="nav-container">
        <div className="nav-brand">
          <span className="nav-title">Finance</span>
        </div>

        <ul className="nav-links">
          <li>
            <a
              href="/"
              className={`nav-link ${isActive("/") ? "active" : ""}`}
              aria-current={isActive("/") ? "page" : undefined}
            >
              Expenses
            </a>
          </li>
          <li>
            <a
              href="/family-finances"
              className={`nav-link ${isActive("/family-finances") ? "active" : ""}`}
              aria-current={isActive("/family-finances") ? "page" : undefined}
            >
              Family
            </a>
          </li>
          {user && (
            <li>
              <a
                href="/profile"
                className={`nav-link ${isActive("/profile") ? "active" : ""}`}
                aria-current={isActive("/profile") ? "page" : undefined}
              >
                Profile
              </a>
            </li>
          )}
        </ul>

        <div className="nav-user">
          {user ? (
            <>
              <span className="nav-username">{user.username}</span>
              <button type="button" className="nav-logout-btn" onClick={handleLogout}>
                Logout
              </button>
            </>
          ) : null}
        </div>
      </div>
    </nav>
  );
}

export default Navigation;
