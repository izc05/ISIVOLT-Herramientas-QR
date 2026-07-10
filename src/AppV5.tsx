import { useState } from 'react';
import AppV4 from './AppV4';
import ReportCenter from './components/ReportCenter';

export default function AppV5() {
  const [revision, setRevision] = useState(0);

  return (
    <>
      <AppV4 key={revision} />
      <ReportCenter onRestore={() => setRevision((value) => value + 1)} />
    </>
  );
}
