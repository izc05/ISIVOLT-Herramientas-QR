import AppRoot from './AppRoot';
import AdminAccessGuide from './features/auth/AdminAccessGuide';
import LocalRegistrationPilot from './features/auth/LocalRegistrationPilot';
import PendingReturnApprovalManager from './features/operations/PendingReturnApprovalManager';
import TechnicianQuickScan from './features/operations/TechnicianQuickScan';

export default function AppRootRC52() {
  return (
    <>
      <AppRoot />
      <AdminAccessGuide />
      <LocalRegistrationPilot />
      <TechnicianQuickScan />
      <PendingReturnApprovalManager />
    </>
  );
}
