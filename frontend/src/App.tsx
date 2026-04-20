import ExpenseDashboard from "./expenses/ExpenseDashboard";
import FamilyFinancesPage from "./family-finances/FamilyFinancesPage";
import HealthPage from "./health/HealthPage";
import "./App.css";

function App() {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";

  if (path === "/health") {
    return <HealthPage />;
  }

  if (path === "/family-finances") {
    return <FamilyFinancesPage />;
  }

  return <ExpenseDashboard />;
}

export default App;
