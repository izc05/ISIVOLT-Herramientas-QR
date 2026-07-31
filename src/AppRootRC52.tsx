import AppRoot from './AppRoot';
import EcosystemIdentityRC57 from './components/EcosystemIdentityRC57';
import ReleaseBannerRC54 from './components/ReleaseBannerRC54';
import AdminAccessGuide from './features/auth/AdminAccessGuide';
import LocalRegistrationPilot from './features/auth/LocalRegistrationPilot';
import PendingReturnApprovalManager from './features/operations/PendingReturnApprovalManager';
import TechnicianQuickScan from './features/operations/TechnicianQuickScan';
import WorkflowCommandCenterRC57 from './features/workspace/WorkflowCommandCenterRC57';
import WorkspaceOnboardingRC57 from './features/workspace/WorkspaceOnboardingRC57';
import WorkspaceResetCenterRC57 from './features/workspace/WorkspaceResetCenterRC57';

export default function AppRootRC52() {
  return (
    <>
      <AppRoot />
      <ReleaseBannerRC54 />
      <EcosystemIdentityRC57 />
      <AdminAccessGuide />
      <LocalRegistrationPilot />
      <TechnicianQuickScan />
      <PendingReturnApprovalManager />
      <WorkflowCommandCenterRC57 />
      <WorkspaceOnboardingRC57 />
      <WorkspaceResetCenterRC57 />
    </>
  );
}
