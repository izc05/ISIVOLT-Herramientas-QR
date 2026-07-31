import AppRoot from './AppRoot';
import ReleaseBannerRC54 from './components/ReleaseBannerRC54';
import AdminAccessGuide from './features/auth/AdminAccessGuide';
import LocalRegistrationPilot from './features/auth/LocalRegistrationPilot';
import PendingReturnApprovalManager from './features/operations/PendingReturnApprovalManager';
import TechnicianQuickScan from './features/operations/TechnicianQuickScan';
import WorkspaceResetCenterRC57 from './features/workspace/WorkspaceResetCenterRC57';

export default function AppRootRC52() {
  return (
    <>
      <AppRoot />
      <ReleaseBannerRC54 />
      <AdminAccessGuide />
      <LocalRegistrationPilot />
      <TechnicianQuickScan />
      <PendingReturnApprovalManager />
      <WorkspaceResetCenterRC57 />
    </>
  );
}
