import type { FormEvent } from "react";

interface LoginFormProps {
  username: string;
  password: string;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
}

function LoginForm({
  username,
  password,
  onUsernameChange,
  onPasswordChange,
  onSubmit,
}: LoginFormProps) {
  return (
    <section className="panel">
      <h2>Sign In</h2>
      <form onSubmit={onSubmit}>
        <label htmlFor="username">Username</label>
        <input
          id="username"
          value={username}
          onChange={(event) => onUsernameChange(event.target.value)}
          autoComplete="username"
        />

        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(event) => onPasswordChange(event.target.value)}
          autoComplete="current-password"
        />

        <button type="submit">Login</button>
      </form>
    </section>
  );
}

export default LoginForm;
