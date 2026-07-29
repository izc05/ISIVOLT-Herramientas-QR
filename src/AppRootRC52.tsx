import AppRoot from './AppRoot';
import AdminAccessGuide from './features/auth/AdminAccessGuide';
import LocalRegistrationPilot from './features/auth/LocalRegistrationPilot';

export default function AppRootRC52() {
  return (
    <>
      <AppRoot />
      <AdminAccessGuide />
      <LocalRegistrationPilot />
    </>
  );
}
