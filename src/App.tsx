import { ClaimsProvider } from './context/ClaimsContext';
import { DashboardLayout } from './components/DashboardLayout';

export function App() {
  return (
    <ClaimsProvider>
      <DashboardLayout />
    </ClaimsProvider>
  );
}

export default App;
