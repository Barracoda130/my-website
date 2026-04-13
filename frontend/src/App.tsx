import ExpenseDashboard from "./expenses/ExpenseDashboard";
import HealthPage from "./health/HealthPage";
import "./App.css";

function App() {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";

  if (path === "/health") {
    return <HealthPage />;
  }

  return <ExpenseDashboard />;
}

export default App;
