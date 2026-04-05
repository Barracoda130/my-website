import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import { bootstrapCsrf, getCurrentUser, login, logout } from "./auth/authService";
import type { AuthUser } from "./auth/types";
import "./App.css";

function App() {
  const [username, setUsername] = useState("testuser");
  const [password, setPassword] = useState("StrongPassword123!");
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState("Initializing...");

  useEffect(() => {
    const initialize = async () => {
      try {
        await bootstrapCsrf();
        const user = await getCurrentUser();
        setCurrentUser(user);
        setStatus(`Signed in as ${user.username}`);
      } catch {
        setStatus("Not signed in");
      }
    };

    void initialize();
  }, []);

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const user = await login({ username, password });
      setCurrentUser(user);
      setStatus(`Signed in as ${user.username}`);
    } catch {
      setStatus("Login failed. Check credentials.");
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      setCurrentUser(null);
      setStatus("Signed out");
    } catch {
      setStatus("Logout failed");
    }
  };

  return (
    <main className="shell">
      <h1>Platform Auth Bootstrap</h1>
      <p className="status" aria-live="polite">
        {status}
      </p>

      {currentUser ? (
        <section className="panel">
          <h2>Current Session</h2>
          <p>
            <strong>User:</strong> {currentUser.username}
          </p>
          <p>
            <strong>Email:</strong> {currentUser.email || "(none)"}
          </p>
          <button type="button" onClick={handleLogout}>
            Logout
          </button>
        </section>
      ) : (
        <section className="panel">
          <h2>Sign In</h2>
          <form onSubmit={handleLogin}>
            <label htmlFor="username">Username</label>
            <input
              id="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
            />

            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
            />

            <button type="submit">Login</button>
          </form>
        </section>
      )}
    </main>
  );
}

export default App;
