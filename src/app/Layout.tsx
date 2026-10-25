/** App frame: top nav (Playbook, Install, Roster, Suggest, Cài đặt), DbErrorBanner, <Outlet/>, "?" shortcut sheet. */
import { Outlet } from 'react-router-dom';

export function Layout(): JSX.Element {
  return <Outlet />;
}
