import { useState, useEffect } from "react";
import type { FormEvent } from "react";
import type { AuthUser } from "../auth/types";
import { getCurrentUser, updateEmail, changePassword } from "../auth/authService";
import "./ProfilePage.css";

interface ProfilePageProps {
  user: AuthUser;
}

function ProfilePage({ user: initialUser }: ProfilePageProps) {
  const [user, setUser] = useState<AuthUser>(initialUser);
  const [email, setEmail] = useState(initialUser.email || "");
  const [emailStatus, setEmailStatus] = useState("");
  const [emailIsSaving, setEmailIsSaving] = useState(false);
  const [showEmailFields, setShowEmailFields] = useState(false);

  const [showPasswordFields, setShowPasswordFields] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordStatus, setPasswordStatus] = useState("");
  const [passwordIsSaving, setPasswordIsSaving] = useState(false);

  useEffect(() => {
    const refreshUser = async () => {
      try {
        const updatedUser = await getCurrentUser();
        setUser(updatedUser);
        setEmail(updatedUser.email || "");
      } catch (error) {
        setEmailStatus("Failed to load user information.");
      }
    };

    void refreshUser();
  }, []);

  const toggleEmailFields = () => {
    setShowEmailFields(!showEmailFields);
    setEmailStatus("");
    setEmail(user.email || "");
  };

  const handleUpdateEmail = async (event: FormEvent) => {
    event.preventDefault();

    if (!email.trim()) {
      setEmailStatus("Email is required.");
      return;
    }

    setEmailIsSaving(true);
    setEmailStatus("");

    try {
      const updatedUser = await updateEmail(email.trim());
      setUser(updatedUser);
      setEmail(updatedUser.email || "");
      setEmailStatus("Email updated successfully.");
      setShowEmailFields(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to update email. Please try again.";
      setEmailStatus(errorMessage);
    } finally {
      setEmailIsSaving(false);
    }
  };

  const handleChangePassword = async (event: FormEvent) => {
    event.preventDefault();

    if (!currentPassword.trim()) {
      setPasswordStatus("Current password is required.");
      return;
    }

    if (!newPassword.trim()) {
      setPasswordStatus("New password is required.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordStatus("New passwords do not match.");
      return;
    }

    if (newPassword.length < 8) {
      setPasswordStatus("New password must be at least 8 characters.");
      return;
    }

    setPasswordIsSaving(true);
    setPasswordStatus("");

    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordStatus("Password changed successfully.");
      setShowPasswordFields(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to change password. Please try again.";
      setPasswordStatus(errorMessage);
    } finally {
      setPasswordIsSaving(false);
    }
  };

  const togglePasswordFields = () => {
    setShowPasswordFields(!showPasswordFields);
    setPasswordStatus("");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  return (
    <main className="shell profile-page">
      <h1>User Profile</h1>

      <article className="profile-card">
        <div className="profile-section">
          <h2>Account Information</h2>
          <div className="info-group">
            <label>Username</label>
            <p className="info-value">{user.username}</p>
            <small className="info-hint">Username cannot be changed</small>
          </div>
        </div>

        <div className="profile-section">
          <div className="email-header">
            <h2>Email Address</h2>
            <button
              type="button"
              className="toggle-email-btn"
              onClick={toggleEmailFields}
              aria-expanded={showEmailFields}
            >
              {showEmailFields ? "Cancel" : "Edit"}
            </button>
          </div>

          {!showEmailFields && (
            <p className="email-display">{user.email || "(not set)"}</p>
          )}

          {showEmailFields && (
            <>
              <p className="status" aria-live="polite">
                {emailStatus}
              </p>

              <form onSubmit={(event) => void handleUpdateEmail(event)}>
                <label htmlFor="profile-email">Email</label>
                <input
                  id="profile-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="your@email.com"
                />

                <button type="submit" disabled={emailIsSaving}>
                  {emailIsSaving ? "Saving..." : "Update Email"}
                </button>
              </form>
            </>
          )}
        </div>

        <div className="profile-section">
          <div className="password-header">
            <h2>Password</h2>
            <button
              type="button"
              className="toggle-password-btn"
              onClick={togglePasswordFields}
              aria-expanded={showPasswordFields}
            >
              {showPasswordFields ? "Cancel" : "Change Password"}
            </button>
          </div>

          {showPasswordFields && (
            <>
              <p className="status" aria-live="polite">
                {passwordStatus}
              </p>

              <form onSubmit={(event) => void handleChangePassword(event)}>
                <label htmlFor="current-password">Current Password</label>
                <input
                  id="current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  placeholder="Enter your current password"
                />

                <label htmlFor="new-password">New Password</label>
                <input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="Enter a new password (min. 8 characters)"
                />

                <label htmlFor="confirm-password">Confirm New Password</label>
                <input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Confirm your new password"
                />

                <button type="submit" disabled={passwordIsSaving}>
                  {passwordIsSaving ? "Changing..." : "Change Password"}
                </button>
              </form>
            </>
          )}
        </div>
      </article>
    </main>
  );
}

export default ProfilePage;
