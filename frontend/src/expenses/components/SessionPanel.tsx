import type { AuthUser } from "../../auth/types";

interface SessionPanelProps {
  user: AuthUser;
  onLogout: () => void;
}

function SessionPanel({ user, onLogout }: SessionPanelProps) {
  return (
    <section className="panel session-panel">
      <div>
        <h2>Current Session</h2>
        <p>
          <strong>User:</strong> {user.username}
        </p>
        <p>
          <strong>Email:</strong> {user.email || "(none)"}
        </p>
      </div>
      <button type="button" onClick={onLogout}>
        Logout
      </button>
    </section>
  );
}

export default SessionPanel;
